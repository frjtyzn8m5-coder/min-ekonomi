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

  // ── Savings / Investments ─────────────────────────────────────────────────────
  { pattern: /AUTOSPAR|SPARANDE|SAVINGS|SPARKONTO|FOND.*KÖPT|AKTIEKÖP/i, category: 'Sparande' },
  { pattern: /ROCKER AB/i, category: 'Sparande' },
];

const TRANSFER_RX = /BENJAMIN SKÖ|SKÖLD BENJAM|95544998797|57233541345|50370098927|ÅTERFÖRT|INTERN ÖVERF|KONTOÖVERF|\bAVANZA\b/i;

export function autoCat(description: string): Category {
  const desc = description.trim().toUpperCase();
  for (const rule of RULES) {
    if (rule.pattern.test(desc)) return rule.category;
  }
  return 'Övrigt Utgift';
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
export function smartCategorize(txs: Transaction[]): Transaction[] {
  if (!txs.length) return txs;

  // Work on a date-sorted copy; preserve original order in return value
  const indexed = txs.map((tx, origIdx) => ({ tx, origIdx }));
  const byDate = [...indexed].sort((a, b) => a.tx.date.localeCompare(b.tx.date));

  // Build result array with same order as input
  const result: Transaction[] = txs.map(tx => ({ ...tx }));

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
      // Bill-splitting: small Swish next to a restaurant visit
      if (absAmt < 400 && nearbyCats.includes('Restaurang')) {
        result[origIdx].category = 'Restaurang';
        return;
      }
      // Grocery splitting: small Swish next to grocery shopping
      if (absAmt < 200 && nearbyCats.includes('Mat')) {
        result[origIdx].category = 'Mat';
        return;
      }
      // Large Swish (> 1 000 kr): shared rent, deposit, equipment purchase, etc.
      if (absAmt > 1000) {
        result[origIdx].category = 'Övrigt Utgift';
        return;
      }
    }
    // Incoming Swish: keep as Aktiviteter (recipient is paying you back)
  });

  return result;
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
