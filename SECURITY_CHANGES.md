# Säkerhetsändringar — UTKAST (måste granskas av en person före deploy)

Datum: 2026-11-18. Gäller `app/`-repot.

## Vad som ändrades

### 1. Öppet data-API borttaget (kritiskt)
`api/data.ts` lagrade **hela app-datasetet** i en enda Redis-nyckel (`app_data_v1`) utan
inloggning och med `Access-Control-Allow-Origin: *`. Vem som helst på internet kunde läsa
eller skriva över allt. Klienten använder inte endpointen längre (data ligger i Firestore,
per användare under `users/{uid}/…`). Endpointen returnerar nu `410 Gone` och rör aldrig Redis.
→ Filen kan tas bort helt om du vill.

### 2. Firestore-säkerhetsregler (viktigt — här ligger ekonomidatan)
Nya `firestore.rules` + `firebase.json`. Regeln: endast inloggad användare kommer åt
`users/{uid}/…`, allt annat nekas.

**Du måste deploya reglerna separat (de följer inte med Vercel-deployen):**
```bash
npm i -g firebase-tools        # om du inte har den
firebase login
firebase deploy --only firestore:rules --project <ditt-projekt-id>
```
Verifiera sedan i Firebase-konsolen → Firestore → Rules att de är aktiva. **Kontrollera att
du inte haft öppna test-regler (`allow read, write: if true`) liggande tidigare.**

### 3. SSRF-skydd på import-endpoints
`api/fetch-ical.ts` och `api/import-recipe.ts` hämtade en användarangiven URL utan kontroll.
Ny delad `api/_lib/safeFetch.ts` (`assertPublicHttpUrl`) kräver http(s) och blockerar
privata/loopback/link-local-adresser (bl.a. moln-metadata `169.254.169.254`) via DNS-uppslag.

### 4. Autentisering på push-endpoints
`api/subscribe.ts` och `api/sync-reminders.ts` saknade helt auth. De verifierar nu ett
Firebase-ID-token server-side (`api/_lib/verifyUser.ts`, via `firebase-admin`) och avvisar
oautentiserade anrop (401). Klienten (`src/pages/Reminders.tsx`) skickar nu med token.

**⚠️ KRÄVER NY ENV-VARIABEL INNAN DEPLOY — annars slutar push fungera (fail-closed):**
Lägg till `FIREBASE_SERVICE_ACCOUNT` i Vercel (Project → Settings → Environment Variables).
Värdet är hela service-account-JSON:en (Firebase-konsol → Projektinställningar →
Tjänstekonton → "Generera ny privat nyckel") som en enradssträng.

## Checklista före deploy
- [ ] `FIREBASE_SERVICE_ACCOUNT` tillagd i Vercel (alla miljöer du använder)
- [ ] `firebase deploy --only firestore:rules` körd och verifierad
- [ ] Testa: logga in → aktivera push → lägg till påminnelse (ska fungera)
- [ ] Testa: anonymt `curl -XPOST .../api/sync-reminders` → ska ge 401
- [ ] `npm run build` grön (verifierad lokalt 2026-11-18)

## Kvarstående rekommendationer (ej åtgärdade här)
- `api/data.ts`, `prices.ts` m.fl. loggar förfrågningsdata till konsolen — städa vid tillfälle.
- Överväg att sätta hela arbetsmappen (planer/data utanför `app/`) under versionshantering.
