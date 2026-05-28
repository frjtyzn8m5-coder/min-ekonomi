# Deploy-guide: Min Ekonomi → GitHub + Vercel

## Förutsättningar
- Git installerat (kolla: `git --version` i terminalen)
- Ett GitHub-konto på github.com
- Node.js 18+ installerat

---

## Steg 1 – Installera nya paket (kör en gång i app/-mappen)

Öppna en terminal i `Ekonomi/app/` och kör:

```
npm install
```

---

## Steg 2 – Generera VAPID-nycklar (push-notiser)

```
npx web-push generate-vapid-keys
```

Spara output – du behöver Public Key och Private Key i steg 5.

---

## Steg 3 – Välj ditt lösenord och generera hash

Byt ut DITTLÖSENORD mot det du vill använda:

**Windows PowerShell:**
```
$pin = "DITTLÖSENORD"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($pin)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
($hash | ForEach-Object { $_.ToString("x2") }) -join ""
```

**Mac/Linux terminal:**
```
echo -n "DITTLÖSENORD" | shasum -a 256
```

Spara den långa hex-strängen (64 tecken) – det är din VITE_APP_PIN_HASH.

---

## Steg 4 – Sätt upp GitHub-repo

1. Gå till github.com → klicka "New repository"
2. Namn: `min-ekonomi` (privat)
3. Klicka "Create repository"
4. Kör dessa kommandon i terminalen (i Ekonomi/app/-mappen):

```
git init
git branch -M main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/DITTANVÄNDARNAMN/min-ekonomi.git
git push -u origin main
```

---

## Steg 5 – Sätt upp Vercel

1. Gå till vercel.com → logga in med GitHub
2. Klicka "Add New Project" → välj min-ekonomi-repot
3. Framework Preset: Vite (väljs automatiskt)
4. Root Directory: `.` (lämna som är)
5. Klicka "Deploy" – appen deployas!

### Sätt miljövariabler i Vercel

Gå till ditt projekt → Settings → Environment Variables och lägg till:

| Variabel | Värde |
|---|---|
| `VITE_APP_PIN_HASH` | hex-strängen från steg 3 |
| `VAPID_PUBLIC_KEY` | från steg 2 |
| `VAPID_PRIVATE_KEY` | från steg 2 |
| `VAPID_EMAIL` | `mailto:benjamin.skold@auagfunds.com` |
| `VITE_VAPID_PUBLIC_KEY` | samma som VAPID_PUBLIC_KEY |
| `CRON_SECRET` | valfri lång slumpsträng (t.ex. generera på passwordsgenerator.net) |

Klicka "Redeploy" efter att du lagt till variablerna.

---

## Steg 6 – Sätt upp Vercel KV (gratis databas för push)

1. I Vercel: gå till Storage-fliken
2. Klicka "Create Database" → välj "KV"
3. Namnge den "ekonomi-kv" → Create
4. Klicka "Connect to Project" → välj min-ekonomi
5. Klicka "Connect" – Vercel sätter automatiskt KV_REST_API_URL och KV_REST_API_TOKEN

Kör "Redeploy" en gång till.

---

## Steg 7 – Lägg till på iPhone

1. Öppna din Vercel-URL i Safari på iPhone (t.ex. min-ekonomi.vercel.app)
2. Tryck på dela-knappen (rutan med pilen uppåt)
3. Välj "Lägg till på hemskärmen"
4. Appen finns nu som en ikon på hemskärmen!
5. Öppna appen → gå till Påminnelser → tryck "Aktivera"

---

## Framtida ändringar

När du vill uppdatera appen:
```
git add .
git commit -m "Ändring"
git push
```
Vercel deployas automatiskt vid varje push.
