import type { Category, Transaction } from '../types';

interface Rule {
  pattern: RegExp;
  category: Category;
  isTransfer?: boolean;
}

const RULES: Rule[] = [
  // ── Income ──────────────────────────────────────────────────────────────────
  { pattern: /\bLÖN\b|AIFM CAPITAL|SALARY|ARBETSGIVARE|LÖNEUTBETALNING/i, category: 'Lön' },
  { pattern: /STUDSTÖD|STUDIESTÖD|CSN.*BIDRAG|BIDRAG.*CSN/i, category: 'CSN Bidrag' },
  { pattern: /STUDIELÅN|CSN.*LÅN|LÅN.*CSN|TILLÄGGSLÅN/i, category: 'CSN Lån' },
  { pattern: /UTDELNING|RÄNTA.*FOND|KURSVINST|KAPITALVINST/i, category: 'Investeringsvinst' },
  { pattern: /SUBV GBGVARV|SUBVENTION/i, category: 'Övrigt Inkomst' },

  // ── Transfers (mark before expense rules) ───────────────────────────────────
  { pattern: /BENJAMIN SKÖ|SKÖLD BENJAM|95544998797|57233541345|50370098927|ÅTERFÖRT|INTERN ÖVERF|SWISH.*TILL.*MIG|KONTOÖVERF/i, category: 'Överföring', isTransfer: true },
  { pattern: /\bAVANZA\b/i, category: 'Överföring', isTransfer: true },

  // ── Housing ──────────────────────────────────────────────────────────────────
  { pattern: /HYRA|RENT\b|BOSTADSRÄTTSFÖRE|HEMFÖRSÄKRING|IF FÖRSÄKRING|TRYGG-HANSA|LÄNSFÖRSÄKRING|VATTENFALL|FORTUM|ELLEVIO|STOCKHOLM EXERGI|E\.ON|TELGE ENERGI/i, category: 'Boende' },
  { pattern: /STIFTELSEN.*GÖTEBORG|GÖTEBORGS.*STU|SGS STUDENTBOST/i, category: 'Boende' },
  { pattern: /GÖTEBORG ENERGI|GÖTEBORGSENERGI/i, category: 'Boende' },
  { pattern: /\bLF\b.*GÖTEBORG|LF GÖTE|LÄNSFÖRS/i, category: 'Boende' },

  // ── Phone / Internet (before Transport so TRAFIKEN doesn't grab Telefon) ─────
  { pattern: /TELIA|TELE2|TELENOR|COMVIQ|HALEBOP|THREE|3 SVERIGE|VIMLA|HALLON\b|HI3G/i, category: 'Telefon' },
  { pattern: /BREDBAND|BAHNHOF|BOXER|ITUX|OWNIT|ZITIUS|FIBER|COM HEM|COMHEM|TELE 2/i, category: 'Telefon' },
  // "3 (HI3G ACCESS AB)" — parenthesised variant
  { pattern: /^3\s*\(HI3G/i, category: 'Telefon' },

  // ── Health (BEFORE restaurant to prevent "BARB" → bar false-positive) ────────
  // Barbershops / hair salons first — must come before the generic \bBAR\b rule
  { pattern: /BARBERSHOP|FRISÖR|FRISERING|BARBERARE|\bBARB\b|HÅRSALONG/i, category: 'Hälsa' },
  { pattern: /APOTEK|APOTEKET|ICA APOTEK|KRONANS APOTEK|APOTEA|EUROAPOTEK|LÄKARE|DOKTOR/i, category: 'Hälsa' },
  { pattern: /TANDLÄKARE|OPTIKER|SYNCENTRAL|TANDVÅRD|PSYKOLOG|TERAPEUT/i, category: 'Hälsa' },
  { pattern: /\bGYM\b|TRÄNING|FRISKIS|SATS\b|ACTIC|NORDIC WELLNESS|CROSSFIT|YOGASTUDIO|PILATES/i, category: 'Hälsa' },
  { pattern: /1177|VÅRDCENTRALEN|HUSLÄKARE|SJUKHUS|KAROLINSKA|SOPHIAHEMMET/i, category: 'Hälsa' },
  { pattern: /GÖTEBORGS FR|RUDDALENS/i, category: 'Hälsa' },
  // Göteborg climbing/fitness venues
  { pattern: /FYSIKEN|ZETTLE\s+FYSI|KLATTERHALL|KLÄTTERHALL/i, category: 'Hälsa' },
  // Health/supplement/beauty stores
  { pattern: /IHERB|GYMGROSSISTEN|K\*GYMGROS|SPORTREHAB/i, category: 'Hälsa' },
  { pattern: /ORAL CARE|TANDKLINIK|ORTHODON/i, category: 'Hälsa' },
  // Lyko, Kicks — beauty/cosmetics
  { pattern: /LYKO|K\*KICKS|\bKICKS\b/i, category: 'Hälsa' },
  // Klarna GYMGROSSISTEN payments
  { pattern: /KLARNA GYMGR/i, category: 'Hälsa' },

  // ── Restaurants / take-away ──────────────────────────────────────────────────
  { pattern: /MCDONALD|MCDONALDS|MCDGBG|BURGER KING|MAX HAMBURGARE|SUBWAY|FIVE GUYS|TGI|NANDOS|SIBYLLA/i, category: 'Restaurang' },
  { pattern: /PIZZA|SUSHI|KEBAB|THAIRESTAURANG|RESTAURANG|BRASSERIE|BISTRO|TAVERNA|GRILL\b/i, category: 'Restaurang' },
  { pattern: /CAFÉ|KAFFE|ESPRESSO|COFFEE|WAYNES|STARBUCKS|JAVA|ESPRESSOHOUSE|BARISTA|DA MATTEO/i, category: 'Restaurang' },
  { pattern: /FOODORA|WOLT|UBER EATS|UBEREATS|JUST EAT|BOLT FOOD/i, category: 'Restaurang' },
  { pattern: /\bBAR\b|\bPUB\b|\bKROG\b|NIGHTCLUB|NATTKLUBB|VINBAR|ÖLHALL/i, category: 'Restaurang' },
  { pattern: /SALLADSBAR|LUNCH|SMÖRGÅSBAR|GATUKÖK|KEBABERI/i, category: 'Restaurang' },
  { pattern: /OMAMI|MOL OMAMI/i, category: 'Restaurang' },
  { pattern: /RENINGSBORG|WH GOTEBORG|WH GÖTE/i, category: 'Restaurang' },
  // Gothenburg-specific restaurants and bars
  { pattern: /KAFE MAGASIN|KAFÉ MAGASIN/i, category: 'Restaurang' },
  { pattern: /GREVENS KOK|GREVENS KÖK/i, category: 'Restaurang' },
  { pattern: /BENNE PASTA/i, category: 'Restaurang' },
  { pattern: /LUCKY BURGER/i, category: 'Restaurang' },
  { pattern: /KÅRRESTAURAN/i, category: 'Restaurang' },
  { pattern: /VALAND/i, category: 'Restaurang' },
  { pattern: /SHOTLUCKAN/i, category: 'Restaurang' },
  { pattern: /GASQUEN/i, category: 'Restaurang' },
  { pattern: /OLEARYS|O'LEARYS/i, category: 'Restaurang' },
  { pattern: /DOWN UNDER/i, category: 'Restaurang' },
  { pattern: /J\s*A\s*PRIPPS|PRIPPS/i, category: 'Restaurang' },
  { pattern: /BRYGGERIET/i, category: 'Restaurang' },
  { pattern: /WALLYS PLACE/i, category: 'Restaurang' },
  { pattern: /ZAMENHOF/i, category: 'Restaurang' },
  { pattern: /SKULD PIZZA/i, category: 'Restaurang' },
  { pattern: /ZETTLE\s+(ROTA|FLAV|SAHL)/i, category: 'Restaurang' },
  // Chalmers student unions / pubs
  { pattern: /ZETTLE\s+(CHAL|TEKN|FYSI|ARKI)|NETS CHALM/i, category: 'Aktiviteter' },
  { pattern: /CHING PALACE/i, category: 'Restaurang' },
  { pattern: /INDIAN BARBE/i, category: 'Restaurang' },
  { pattern: /RESTAURANG [A-Z]/i, category: 'Restaurang' },

  // ── Groceries ────────────────────────────────────────────────────────────────
  { pattern: /\bICA\b|COOP|WILLYS|LIDL|HEMKÖP|HEMKOP|NETTO\b|MAXI\b|CITY GROSS|MATVAROR|SABIS|AXFOOD|MATHEM|MATSMART/i, category: 'Mat' },
  { pattern: /SYSTEMBOLAGET|SYSTEMBOLAGE|PRESSBYRÅ|7-ELEVEN|7ELEVEN|RESEBUTIK/i, category: 'Mat' },
  { pattern: /SALUHALL|BONDENS MARKNAD|FRUKT|EKOLOGISK BUTIK/i, category: 'Mat' },
  { pattern: /\bSPAR\b/i, category: 'Mat' },

  // ── Transport ────────────────────────────────────────────────────────────────
  { pattern: /\bSL\b|STORSTOCKHOLMS|AB STORSTOCK|MTR EXPRESS|BUSS\b|TAXI|CABONLINE|SVERIGEBUSS|FLIXBUS/i, category: 'Transport' },
  { pattern: /\bUBER\b|\bBOLT\b|PARKERING|APCOA|Q-PARK|EASYPARK|TRAFIKVERKET|TRAFIKEN/i, category: 'Transport' },
  { pattern: /FLYG|RYANAIR|\bSAS\b|NORWEGIAN|WIZZ|EASYJET|FINNAIR|BRITISH AIRWAYS|LUFTHANSA/i, category: 'Transport' },
  { pattern: /BILTVÄTT|SHELL|PREEM|ST1\b|OKQ8|CIRCLE K|BENSIN|DRIVMEDEL/i, category: 'Transport' },
  { pattern: /VÄTGAS|ELBIL|LADDNING|VATTENFALL CHARGE|TESLA CHARGING/i, category: 'Transport' },
  // Swedish public transit (incl. Västtrafik with different spellings)
  { pattern: /VÄSTTRAFIK|VESTTRAFIK|VASTTRAFIK/i, category: 'Transport' },
  // SJ (train) — standalone match
  { pattern: /\bSJ\b|SJ AB/i, category: 'Transport' },
  // Roedby = ferry Göteborg–Kiel / Helsingborg–Helsingör
  { pattern: /ROEDBY|RØDBY|SCANDLINES/i, category: 'Transport' },

  // ── Streaming / Subscriptions ─────────────────────────────────────────────────
  { pattern: /SPOTIFY|NETFLIX|DISNEY\+|HBO\b|MAX\b.*STREAMING|APPLE.*SUB|YOUTUBE PREMIUM/i, category: 'Streaming' },
  { pattern: /AMAZON PRIME|VIAPLAY|TV4 PLAY|STORYTEL|NEXTORY|READLY|TIDNING/i, category: 'Streaming' },
  { pattern: /ADOBE|DROPBOX|ICLOUD|MICROSOFT 365|OFFICE 365|GITHUB|NOTION|FIGMA|CANVA/i, category: 'Streaming' },
  { pattern: /APPLE[\s.]COM|APPLE COM/i, category: 'Streaming' },
  { pattern: /GOOGLE\s+GOOG|GOOGLE PLAY|GOOGLE ONE/i, category: 'Streaming' },

  // ── Clothes ──────────────────────────────────────────────────────────────────
  // H&M — both card reader formats: "H&M" and "HM SE0221" / "K*HM ONLINE"
  { pattern: /H&M|\bHM\s+SE|\bHM\s+ONLINE|K\*HM/i, category: 'Kläder' },
  { pattern: /ZARA|ASOS|LINDEX|KAPPAHL|UNIQLO|MONKI|WEEKDAY|\bCOS\b|ARKET|HOUDINI|PEAK PERFORMANCE/i, category: 'Kläder' },
  // Stadium — note: STADION ≠ STADIUM; SEB uses "STADIUM OUTL"
  { pattern: /\bSTADIUM\b|\bSTADION\b|SPORTAMORE|INTERSPORT|XXL\b|LÖPLABBET|DECATHLON|ADIDAS|NIKE\b/i, category: 'Kläder' },
  { pattern: /FILIPPA K|ACNE|NUDIE|TIGER OF SWEDEN|GANT|RALPH LAUREN|\bHILFIGER\b|TOMMY HILFIGER/i, category: 'Kläder' },
  { pattern: /JUNKYARD|DRESSMANN|BESTSELLER|ZARA/i, category: 'Kläder' },
  { pattern: /ZALANDO|VINTED|SELLPY/i, category: 'Kläder' },

  // ── Activities / Entertainment ────────────────────────────────────────────────
  { pattern: /STEAM|EPIC GAMES|PLAYSTATION|XBOX|NINTENDO|APP STORE.*GAME|G2A/i, category: 'Aktiviteter' },
  { pattern: /BIOGRAF|FILMSTADEN|SF BIO|CINEME|BIOPALATSET/i, category: 'Aktiviteter' },
  { pattern: /MUSEUM|KONSERT|EVENTIM|TICKETMASTER|TICNET|STADION.*EVENT|KONSERTHUS/i, category: 'Aktiviteter' },
  { pattern: /BOWLING|LASER|MINIGOLF|PAINTBALL|ESCAPE ROOM/i, category: 'Aktiviteter' },
  { pattern: /MEDLEY|KLÄTTERHALL/i, category: 'Aktiviteter' },
  // Gothenburg venues / activities
  { pattern: /SURFBOARD|SURF LUXURY|SURF LUXURYS/i, category: 'Aktiviteter' },
  { pattern: /GULLBERGSBRO/i, category: 'Aktiviteter' },
  { pattern: /LISEBERG/i, category: 'Aktiviteter' },
  { pattern: /UNIVERSEUM/i, category: 'Aktiviteter' },
  { pattern: /GBGVARV|GÖTEBORGSVARVET|GÖTEBORGS VARVET/i, category: 'Aktiviteter' },
  // Student-life / Chalmers
  { pattern: /BENGANS/i, category: 'Aktiviteter' },
  { pattern: /CHALMERS STU|CHS CHALMERS|CHALMERS TEK|CHALMERS BOR/i, category: 'Aktiviteter' },
  { pattern: /VIPMONKEY/i, category: 'Aktiviteter' },
  // Swish — Swedish mobile numbers (46 + 9 digits) → social/activities with friends
  // Note: smartCategorize() will refine this further using surrounding context
  { pattern: /^46[0-9]{9}$/, category: 'Aktiviteter' },

  // ── Travel ───────────────────────────────────────────────────────────────────
  { pattern: /HOTEL|HOTELL|AIRBNB|BOOKING\.COM|EXPEDIA|TRIVAGO|HOTELS\.COM/i, category: 'Resor' },
  { pattern: /\bVING\b|\bAPOLLO\b|\bTICKET\b|CHARTERRESA|SEMESTERRESA|GLOBETROTTER/i, category: 'Resor' },
  { pattern: /CHAMONIX|U C P A|UCPA RESOR|VAL D ISERE|SKISTAR/i, category: 'Resor' },
  // Foreign city names — clearly travel purchases
  { pattern: /\bNAPOLI\b|\bBUDAPEST\b|\bDUBLIN\b|\bPARIS\b|\bESSEN\b|\bZAGREB\b/i, category: 'Resor' },
  { pattern: /\bHAMBURG\b|\bVENEZIA\b|\bTRIESTE\b|\bITTIGEN\b|\bHERBOLZHEIM\b|\bZAVENTEM\b/i, category: 'Resor' },
  { pattern: /\bMILANO\b|\bAACHEN\b|\bROEDBY\b|\bUTRECHT\b|\bKOEBENHAVN\b|\bKOPENHAGEN\b/i, category: 'Resor' },
  { pattern: /\bRIJEKA\b|\bLIMASSOL\b|\bSTOCKHOLM\b.*AIRPORT|\bARLANDA\b|\bLANDVETTER\b/i, category: 'Resor' },

  // ── Shopping / Electronics ───────────────────────────────────────────────────
  { pattern: /AMAZON\b|ZALANDO|ELGIGANTEN|MEDIAMARKT|KOMPLETT|INET\b|WEBHALLEN/i, category: 'Handel' },
  { pattern: /IKEA|CLAS OHLSON|BILTEMA|JULA|BAUHAUS|HORNBACH|K-RAUTA|JYSK/i, category: 'Handel' },
  { pattern: /BLOCKET|TRADERA|FACEBOOK.*MARKET|SELLPY/i, category: 'Handel' },
  { pattern: /APPLE STORE|SAMSUNG|KJELL|DUSTIN/i, category: 'Handel' },
  { pattern: /BLOMSTER|BLOMLAND|BLOMMOR|MAJORNAS BLO/i, category: 'Handel' },
  { pattern: /GULDFYND|SMYCKEN/i, category: 'Handel' },
  { pattern: /AKADEMIBOKHA|ADLIBRIS|BOKHANDEL|PEN STORE/i, category: 'Handel' },
  // BNPL / invoice payment services (Klarna, Walley, Qliro)
  { pattern: /KLARNA BANK/i, category: 'Handel' },
  { pattern: /\bWALLEY\b|\bQLIRO\b/i, category: 'Handel' },
  // Other retail
  { pattern: /TEMU|ALIEXPRESS|WISH\b/i, category: 'Handel' },

  // ── Groceries (extra chains / convenience) ───────────────────────────────────
  { pattern: /STORA COOP|COOP KONSUM|COOP NÄRA|COOP EXTRA|TEMPO\b|HANDLARN|NÄRLIVS|DIREKTEN|MATÖPPET|MATÖPPET|ÖB LIVS|GÅRDSBUTIK/i, category: 'Mat' },
  { pattern: /CIRCLE K.*(KORV|MAT)|OKQ8.*BUTIK|PRESSBYRAN|PRESSBYRÅN|GÖTEBORGS KEX|LINAS MATKASSE|GODISKUNGEN/i, category: 'Mat' },

  // ── Restaurants / café (extra common chains) ──────────────────────────────────
  { pattern: /O'?LEARYS|VAPIANO|VIGÅRDA|BASTARD BURGER|FRASSES|CLuck|TUGG\b|FROTZ|LEVE?LS|TACO BAR|TACOBAR|PINCHOS|PHIL'?S BURGER|BURGERS?\b/i, category: 'Restaurang' },
  { pattern: /ESPRESSO HOUSE|WAYNE'?S|CONDECO|GATEAU|BRÖD & SALT|BROD & SALT|LINDVALLS|JOE & THE JUICE/i, category: 'Restaurang' },
  { pattern: /DELICATO|SEMLA|KONDITORI|BAGERI|FIKA\b/i, category: 'Restaurang' },

  // ── Transport (extra) ─────────────────────────────────────────────────────────
  { pattern: /SKÅNETRAFIK|JÖNKÖPINGS LÄNSTRAFIK|JLT\b|UL\b.*TRAFIK|ÖSTGÖTATRAFIKEN|VÄRMLANDSTRAFIK|LÄNSTRAFIK|TÅGAB|SNÄLLTÅGET|VY\b|FLYGBUSS|FLYGTAXI|ARLANDA EXPRESS/i, category: 'Transport' },
  { pattern: /VOI\b|TIER\b|LIME\b|BOLT.*SCOOT|RYDE\b|DOTT\b|HYRBIL|AVIS|HERTZ|EUROPCAR|SIXT|MABI|HERTZ|GREENMOBILITY|SUNFLEET|M\s+BILPOOL/i, category: 'Transport' },
  { pattern: /INGO\b|QSTAR|TANKA\b|GULF\b|DIN-X|DINX|TANKSTELLE/i, category: 'Transport' },

  // ── Streaming / subscriptions (extra) ─────────────────────────────────────────
  { pattern: /AUDIBLE|PATREON|TWITCH|DISCORD NITRO|OPENAI|CHATGPT|ANTHROPIC|CLAUDE\.AI|MIDJOURNEY|LINKEDIN|DUOLINGO|HEADSPACE|CALM\b|STRAVA|GARMIN CONNECT|MYFITNESSPAL/i, category: 'Streaming' },
  { pattern: /PAYPAL.*(SPOTIFY|NETFLIX|PATREON)|GOOGLE\s*\*|GOOGLE PAYMENT|MICROSOFT\*|MSFT\*|AMZNPRIME|PRIME\b/i, category: 'Streaming' },

  // ── Clothes / sport (extra) ───────────────────────────────────────────────────
  { pattern: /NELLY\b|BOOZT|CARLINGS|JACK & JONES|GINA TRICOT|BIKBOK|CUBUS|VERO MODA|NA-KD|NAKD\b|VOLT\b|MQ\b|MARQET|BUBBLEROOM/i, category: 'Kläder' },
  { pattern: /FOOTWAY|SCOREPLAY|RevOLUTION RACE|REVOLUTIONRACE|CRAFT SPORTS|NEWBODY|BJÖRN BORG|CASALL|ICANIWILL|RYDERWEAR/i, category: 'Kläder' },

  // ── Health / beauty (extra) ───────────────────────────────────────────────────
  { pattern: /MEDS\.SE|MEDS\b|APOHEM|HJÄRTAT APOTEK|APOTEK HJÄRTAT|DOKTOR\.SE|KRY\b|MIN DOKTOR|WELLOBE|LIFESUM|SKÖNHET|PARFYM|NORMAL\b|RITUALS|THE BODY SHOP|LUSH\b|CAIA|NYX|MAC COSMETICS/i, category: 'Hälsa' },
  { pattern: /NOCCO|CELSIUS|BARESO|PROPUD|GAINOMAX|MM SPORTS|BODYSTORE|SVENSKT KOSTTILLSKOTT|TYNGRE|SELF OMNINUTRITION/i, category: 'Hälsa' },

  // ── Activities / entertainment (extra) ────────────────────────────────────────
  { pattern: /GRÖNA LUND|KOLMÅRDEN|SKARA SOMMARLAND|FURUVIK|TROPIKARIET|AKVARIET|DJURPARK|NÖJESPARK|LASERDOME|GOKART|GO-KART|HIGH VALLEY|ACTIONWORLD/i, category: 'Aktiviteter' },
  { pattern: /PADEL|PADELCENTER|TENNIS|BADMINTON|SQUASH|BOULDER|KLÄTTRING|GOLFKLUBB|GOLF\b|SIMHALL|BADHUS|ÄVENTYRSBAD/i, category: 'Aktiviteter' },

  // ── Shopping / electronics / home (extra) ─────────────────────────────────────
  { pattern: /CDON|FYNDIQ|NETONNET|POWER\b|EL-GIGANTEN|TELEKRAM|MAXGAMING|PROSHOP|DATORBUTIK|KOMPONENTGIGANTEN/i, category: 'Handel' },
  { pattern: /RUSTA\b|ÖB\b|ÖOB|DOLLARSTORE|LAGERHAUS|GRANIT\b|CERVERA|HEMTEX|MIO\b|EM HOME|CHILLI\b|SOVA\b|IKANO/i, category: 'Handel' },
  { pattern: /APOTEK.*DJUR|ARKEN ZOO|ZOO\b|GRANNGÅRDEN|HUSDJUR|DJURMAGAZINET|VETERINÄR|AGRIA/i, category: 'Handel' },
  { pattern: /PLANTAGEN|BLOMSTERLANDET|TRÄDGÅRD|BYGGMAX|BESLAG|SILVAN|BECKERS|FLÜGGER/i, category: 'Handel' },
  { pattern: /AMAZON\.|AMZN\b|ETSY|EBAY|SHEIN|BANGGOOD|ASOS\b/i, category: 'Handel' },

  // ── Savings / Investments ─────────────────────────────────────────────────────
  { pattern: /AUTOSPAR|SPARANDE|SAVINGS|SPARKONTO|FOND.*KÖPT|AKTIEKÖP/i, category: 'Sparande' },
  { pattern: /ROCKER AB|LYSA\b|OPTI\b|SIGMASTOCKS|FUNDLER|SAVR\b/i, category: 'Sparande' },
];

const TRANSFER_RX = /BENJAMIN SKÖ|SKÖLD BENJAM|95544998797|57233541345|50370098927|ÅTERFÖRT|INTERN ÖVERF|KONTOÖVERF|\bAVANZA\b/i;

/**
 * Strip card-acquirer noise so more descriptions match the merchant rules.
 * Removes common prefixes (K-star, WWW., card-reader tags like SUMUP, IZ, ZETTLE,
 * PAYPAL, SQ, NETS), card masks (star-star 1234), trailing dates and country codes.
 */
export function normalizeDesc(description: string): string {
  let d = description.trim().toUpperCase();
  d = d.replace(/\*{2,}\s*\d{2,4}/g, ' ');                 // card masks ****1234
  d = d.replace(/\b\d{2}[./-]\d{2}([./-]\d{2,4})?\b/g, ' '); // dates
  d = d.replace(/^(K\*|KK\*|W\*|WWW\.|HTTPS?:\/\/)/i, ' '); // leading acquirer/url tags
  d = d.replace(/\b(SUMUP|IZ|ZETTLE|IZETTLE|SQ|PP|PAYPAL|NETS|SWEDBANK PAY|SWISH|KLARNA\*|STRIPE|PAY\.)\s*[*_]?\s*/gi, ' ');
  d = d.replace(/\b(SE|SWE|SWEDEN|GBG|GÖTEBORG|STOCKHOLM|STHLM|MALMÖ)\b\s*$/i, ' '); // trailing locality
  d = d.replace(/\s{2,}/g, ' ').trim();
  return d;
}

export function autoCat(description: string): Category {
  const desc = description.trim().toUpperCase();
  for (const rule of RULES) {
    if (rule.pattern.test(desc)) return rule.category;
  }
  // Second pass on the normalized form so acquirer-prefixed descriptions still match.
  const norm = normalizeDesc(description);
  if (norm && norm !== desc) {
    for (const rule of RULES) {
      if (rule.pattern.test(norm)) return rule.category;
    }
  }
  return 'Övrigt Utgift';
}

/**
 * A stable merchant key for learning: the normalized description reduced to its
 * leading alphabetic token(s), so "ICA SUPERMARKET 1234" and "ICA SUPERMARKET" share a key.
 * Returns '' for Swish numbers and pure-numeric descriptions (not reliable merchants).
 */
export function merchantKey(description: string): string {
  const norm = normalizeDesc(description);
  if (/^46[0-9]{9}$/.test(description.trim())) return '';
  const letters = norm.replace(/[^A-ZÅÄÖ ]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (letters.length < 3) return '';
  return letters.split(' ').slice(0, 3).join(' ');
}

export function autoIsTransfer(description: string): boolean {
  return TRANSFER_RX.test(description);
}

/**
 * Smart contextual re-categorization.
 *
 * Runs as a second pass over all transactions once they've been individually
 * categorised with autoCat(). Uses surrounding transactions (same day ± 1 day)
 * to make smarter decisions for hard-to-classify entries:
 *
 *  - **Swish (46xxxxxxxxx):** a negative Swish on the same day as a Restaurang/Mat
 *    transaction is most likely bill-splitting → re-categorised to match.
 *    A large negative Swish (> 1 000 kr) is re-categorised to Övrigt Utgift since
 *    it's probably a shared living expense rather than a social activity.
 *
 *  - **Incoming Swish (positive):** almost always someone paying you back; kept as
 *    Aktiviteter since the original purpose can't be determined.
 *
 * Returns a NEW array — does not mutate the input.
 */
/**
 * Learn merchant → category from the user's own manual edits. Any transaction the
 * user has edited (tx.edited) teaches a rule for that merchant, so future (and
 * sibling) transactions from the same merchant inherit the chosen category. This
 * is the single most effective way to shrink "Övrigt Utgift" over time.
 */
export function buildLearnedMap(txs: Transaction[]): Record<string, Category> {
  const map: Record<string, Category> = {};
  for (const tx of txs) {
    if (!tx.edited || tx.isTransfer) continue;
    if (isIncomeCategory(tx.category) || tx.category === 'Överföring') continue;
    const key = merchantKey(tx.description);
    if (key) map[key] = tx.category; // later edits win (array is import order)
  }
  return map;
}

export function smartCategorize(txs: Transaction[]): Transaction[] {
  if (!txs.length) return txs;

  // Work on a date-sorted copy; preserve original order in return value
  const indexed = txs.map((tx, origIdx) => ({ tx, origIdx }));
  const byDate = [...indexed].sort((a, b) => a.tx.date.localeCompare(b.tx.date));

  // Build result array with same order as input
  const result: Transaction[] = txs.map(tx => ({ ...tx }));

  // Pass 0 — apply merchant categories learned from the user's own edits to any
  // NON-edited expense transaction sharing that merchant (never touch user edits).
  const learned = buildLearnedMap(txs);
  if (Object.keys(learned).length) {
    result.forEach(tx => {
      if (tx.edited || tx.isTransfer) return;
      if (tx.type === 'income') return;
      const key = merchantKey(tx.description);
      const learnedCat = key ? learned[key] : undefined;
      if (learnedCat) tx.category = learnedCat;
    });
  }

  const isSwish = (desc: string) => /^46[0-9]{9}$/.test(desc.trim());

  byDate.forEach(({ tx, origIdx }) => {
    if (!isSwish(tx.description) || tx.isTransfer) return;

    // Gather transactions within ±1 calendar day (excluding this tx)
    const txTime = new Date(tx.date).getTime();
    const oneDayMs = 86_400_000;
    const nearby = byDate
      .filter(({ tx: t, origIdx: j }) =>
        j !== origIdx &&
        !t.isTransfer &&
        Math.abs(new Date(t.date).getTime() - txTime) <= oneDayMs,
      )
      .map(({ tx: t }) => t);

    const nearbyCats = nearby.map(t => t.category);
    const absAmt = Math.abs(tx.amount);

    if (tx.amount < 0) {
      // Large Swish (> 2 000 kr): likely shared rent, deposit, or big purchase — not social
      if (absAmt > 2000) {
        result[origIdx].category = 'Övrigt Utgift';
        return;
      }
      // Everything else: default to Aktiviteter (social outings, splitting bills, etc.)
    }
    // Incoming Swish: keep as Aktiviteter (someone paying you back)
  });

  return result;
}

/**
 * Diagnose what still lands on "Övrigt Utgift": groups uncategorised expenses by
 * merchant, summed by amount and count, biggest first. A UI can surface these so
 * the user categorises the few merchants that actually matter.
 */
export function diagnoseUncategorized(
  txs: Transaction[],
  limit = 12,
): { merchant: string; total: number; count: number; sample: string }[] {
  const agg = new Map<string, { total: number; count: number; sample: string }>();
  for (const tx of txs) {
    if (tx.isTransfer || tx.type !== 'expense') continue;
    if (tx.category !== 'Övrigt Utgift') continue;
    const key = merchantKey(tx.description) || tx.description.trim().toUpperCase().slice(0, 24) || '(okänt)';
    const cur = agg.get(key) ?? { total: 0, count: 0, sample: tx.description };
    cur.total += Math.abs(tx.amount);
    cur.count += 1;
    agg.set(key, cur);
  }
  return [...agg.entries()]
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function isIncomeCategory(cat: Category): boolean {
  return ['Lön', 'CSN Bidrag', 'CSN Lån', 'Investeringsvinst', 'Övrigt Inkomst'].includes(cat);
}

export function isSavingsCategory(cat: Category): boolean {
  return ['Sparande', 'Investering'].includes(cat);
}

export const EXPENSE_CATEGORIES: Category[] = [
  'Mat', 'Restaurang', 'Transport', 'Boende', 'Telefon', 'Streaming',
  'Kläder', 'Hälsa', 'Aktiviteter', 'Handel', 'Resor', 'Övrigt Utgift',
];

export const INCOME_CATEGORIES: Category[] = [
  'Lön', 'CSN Bidrag', 'CSN Lån', 'Investeringsvinst', 'Övrigt Inkomst',
];

export const ALL_CATEGORIES: Category[] = [
  ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, 'Sparande', 'Investering', 'Överföring',
];

export const CATEGORY_COLORS: Record<string, string> = {
  'Lön':               '#34c759',
  'CSN Bidrag':        '#30d158',
  'CSN Lån':           '#ffd60a',
  'Investeringsvinst': '#64d2ff',
  'Övrigt Inkomst':    '#5e5ce6',
  'Mat':               '#ff9f0a',
  'Restaurang':        '#ff6b35',
  'Transport':         '#007aff',
  'Boende':            '#5e5ce6',
  'Telefon':           '#64d2ff',
  'Streaming':         '#ff375f',
  'Kläder':            '#bf5af2',
  'Hälsa':             '#30d158',
  'Aktiviteter':       '#ff9f0a',
  'Handel':            '#ff6961',
  'Resor':             '#0071e3',
  'Sparande':          '#34c759',
  'Investering':       '#30d158',
  'Övrigt Utgift':     '#8e8e93',
  'Överföring':        '#c7c7cc',
};
