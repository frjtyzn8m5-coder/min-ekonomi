import type { Category } from '../types';

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

  // ── Transfers (mark before expense rules) ───────────────────────────────────
  { pattern: /BENJAMIN SKÖ|SKÖLD BENJAM|95544998797|57233541345|50370098927|ÅTERFÖRT|INTERN ÖVERF|SWISH.*TILL.*MIG|KONTOÖVERF/i, category: 'Överföring', isTransfer: true },
  { pattern: /\bAVANZA\b/i, category: 'Överföring', isTransfer: true },

  // ── Housing ──────────────────────────────────────────────────────────────────
  { pattern: /HYRA|RENT\b|BOSTADSRÄTTSFÖRE|HEMFÖRSÄKRING|IF FÖRSÄKRING|TRYGG-HANSA|LÄNSFÖRSÄKRING|VATTENFALL|FORTUM|ELLEVIO|STOCKHOLM EXERGI|E\.ON|TELGE ENERGI/i, category: 'Boende' },
  { pattern: /STIFTELSEN.*GÖTEBORG|GÖTEBORGS.*STU|SGS STUDENTBOST/i, category: 'Boende' },
  { pattern: /GÖTEBORG ENERGI|GÖTEBORGSENERGI/i, category: 'Boende' },
  { pattern: /\bLF\b.*GÖTEBORG|LF GÖTE|LÄNSFÖRS/i, category: 'Boende' },

  // ── Restaurants / take-away (must be before Mat to catch cafés etc.) ─────────
  { pattern: /MCDONALD|MCDONALDS|MCDGBG|BURGER KING|MAX HAMBURGARE|SUBWAY|FIVE GUYS|TGI|NANDOS|SIBYLLA/i, category: 'Restaurang' },
  { pattern: /PIZZA|SUSHI|KEBAB|THAIRESTAURANG|RESTAURANG|BRASSERIE|BISTRO|TAVERNA|GRILL\b/i, category: 'Restaurang' },
  { pattern: /CAFÉ|KAFFE|ESPRESSO|COFFEE|WAYNES|STARBUCKS|JAVA|ESPRESSOHOUSE|BARISTA|DA MATTEO/i, category: 'Restaurang' },
  { pattern: /FOODORA|WOLT|UBER EATS|UBEREATS|JUST EAT|BOLT FOOD/i, category: 'Restaurang' },
  { pattern: /\bBAR\b|\bPUB\b|\bKROG\b|NIGHTCLUB|NATTKLUBB|VINBAR|ÖLHALL/i, category: 'Restaurang' },
  { pattern: /SALLADSBAR|LUNCH|SMÖRGÅSBAR|GATUKÖK|KEBABERI/i, category: 'Restaurang' },
  { pattern: /OMAMI|MOL OMAMI/i, category: 'Restaurang' },

  // ── Groceries ────────────────────────────────────────────────────────────────
  { pattern: /\bICA\b|COOP|WILLYS|LIDL|HEMKÖP|NETTO\b|MAXI\b|CITY GROSS|MATVAROR|SABIS|AXFOOD|MATHEM|MATSMART/i, category: 'Mat' },
  { pattern: /SYSTEMBOLAGET|PRESSBYRÅ|7-ELEVEN|7ELEVEN|RESEBUTIK/i, category: 'Mat' },
  { pattern: /SALUHALL|BONDENS MARKNAD|FRUKT|EKOLOGISK BUTIK/i, category: 'Mat' },

  // ── Transport ────────────────────────────────────────────────────────────────
  { pattern: /\bSL\b|STORSTOCKHOLMS|MTR EXPRESS|\bSJ\b|BUSS\b|TAXI|CABONLINE|SVERIGEBUSS|FLIXBUS/i, category: 'Transport' },
  { pattern: /\bUBER\b|\bBOLT\b|PARKERING|APCOA|Q-PARK|EASYPARK|TRAFIKVERKET|TRAFIKEN/i, category: 'Transport' },
  { pattern: /FLYG|RYANAIR|\bSAS\b|NORWEGIAN|WIZZ|EASYJET|FINNAIR|BRITISH AIRWAYS|LUFTHANSA/i, category: 'Transport' },
  { pattern: /BILTVÄTT|SHELL|PREEM|ST1\b|OKQ8|CIRCLE K|BENSIN|DRIVMEDEL/i, category: 'Transport' },
  { pattern: /VÄTGAS|ELBIL|LADDNING|VATTENFALL CHARGE|TESLA CHARGING/i, category: 'Transport' },
  { pattern: /GULLBERGSBRO/i, category: 'Transport' },

  // ── Phone / Internet ──────────────────────────────────────────────────────────
  { pattern: /TELIA|TELE2|TELENOR|COMVIQ|HALEBOP|THREE|3 SVERIGE|VIMLA|HALLON\b|HI3G/i, category: 'Telefon' },
  { pattern: /BREDBAND|BAHNHOF|BOXER|ITUX|OWNIT|ZITIUS|FIBER|COM HEM|COMHEM|TELE 2/i, category: 'Telefon' },

  // ── Streaming / Subscriptions ─────────────────────────────────────────────────
  { pattern: /SPOTIFY|NETFLIX|DISNEY\+|HBO\b|MAX\b.*STREAMING|APPLE.*SUB|YOUTUBE PREMIUM/i, category: 'Streaming' },
  { pattern: /AMAZON PRIME|VIAPLAY|TV4 PLAY|STORYTEL|NEXTORY|READLY|TIDNING/i, category: 'Streaming' },
  { pattern: /ADOBE|DROPBOX|ICLOUD|MICROSOFT 365|OFFICE 365|GITHUB|NOTION|FIGMA|CANVA/i, category: 'Streaming' },

  // ── Health ────────────────────────────────────────────────────────────────────
  { pattern: /APOTEK|APOTEKET|ICA APOTEK|KRONANS APOTEK|APOTEA|EUROAPOTEK|LÄKARE|DOKTOR/i, category: 'Hälsa' },
  { pattern: /TANDLÄKARE|OPTIKER|SYNCENTRAL|TANDVÅRD|PSYKOLOG|TERAPEUT/i, category: 'Hälsa' },
  { pattern: /\bGYM\b|TRÄNING|FRISKIS|SATS\b|ACTIC|NORDIC WELLNESS|CROSSFIT|YOGASTUDIO|PILATES/i, category: 'Hälsa' },
  { pattern: /1177|VÅRDCENTRALEN|HUSLÄKARE|SJUKHUS|KAROLINSKA|SOPHIAHEMMET/i, category: 'Hälsa' },
  { pattern: /GÖTEBORGS FR|RUDDALENS/i, category: 'Hälsa' },

  // ── Clothes ──────────────────────────────────────────────────────────────────
  { pattern: /H&M|ZARA|ASOS|LINDEX|KAPPAHL|UNIQLO|MONKI|WEEKDAY|\bCOS\b|ARKET|HOUDINI|PEAK PERFORMANCE/i, category: 'Kläder' },
  { pattern: /STADION|SPORTAMORE|INTERSPORT|XXL\b|LÖPLABBET|DECATHLON|ADIDAS|NIKE\b/i, category: 'Kläder' },
  { pattern: /FILIPPA K|ACNE|NUDIE|TIGER OF SWEDEN|GANT|RALPH LAUREN|TOMMY HILFIGER/i, category: 'Kläder' },

  // ── Activities / Entertainment ────────────────────────────────────────────────
  { pattern: /STEAM|EPIC GAMES|PLAYSTATION|XBOX|NINTENDO|APP STORE.*GAME|G2A/i, category: 'Aktiviteter' },
  { pattern: /BIOGRAF|FILMSTADEN|SF BIO|CINEME|BIOPALATSET/i, category: 'Aktiviteter' },
  { pattern: /MUSEUM|KONSERT|EVENTIM|TICKETMASTER|TICNET|STADION.*EVENT|KONSERTHUS/i, category: 'Aktiviteter' },
  { pattern: /BOWLING|LASER|MINIGOLF|PAINTBALL|ESCAPE ROOM|KLÄTTERHALL/i, category: 'Aktiviteter' },
  { pattern: /SURFBOARD|SURF LUXURY|BENGANS|CHALMERS STU|CHS CHALMERS/i, category: 'Aktiviteter' },
  // Swish – Swedish mobile numbers (46 + 9 digits) → social/activities with friends
  { pattern: /^46[0-9]{9}$/, category: 'Aktiviteter' },

  // ── Travel ───────────────────────────────────────────────────────────────────
  { pattern: /HOTEL|HOTELL|AIRBNB|BOOKING\.COM|EXPEDIA|TRIVAGO|HOTELS\.COM/i, category: 'Resor' },
  { pattern: /\bVING\b|\bAPOLLO\b|\bTICKET\b|CHARTERRESA|SEMESTERRESA|GLOBETROTTER/i, category: 'Resor' },
  { pattern: /CHAMONIX|U C P A|UCPA RESOR/i, category: 'Resor' },

  // ── Shopping / Electronics ───────────────────────────────────────────────────
  { pattern: /AMAZON\b|ZALANDO|ELGIGANTEN|MEDIAMARKT|KOMPLETT|INET\b|WEBHALLEN/i, category: 'Handel' },
  { pattern: /IKEA|CLAS OHLSON|BILTEMA|JULA|BAUHAUS|HORNBACH|K-RAUTA/i, category: 'Handel' },
  { pattern: /BLOCKET|TRADERA|FACEBOOK.*MARKET|VINTED|SELLPY/i, category: 'Handel' },
  { pattern: /APPLE STORE|APPLE\.COM|SAMSUNG|KJELL|DUSTIN/i, category: 'Handel' },

  // ── Savings / Investments ─────────────────────────────────────────────────────
  { pattern: /AUTOSPAR|SPARANDE|SAVINGS|SPARKONTO|FOND.*KÖPT|AKTIEKÖP/i, category: 'Sparande' },
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
  'Lön':             '#34c759',
  'CSN Bidrag':      '#30d158',
  'CSN Lån':         '#ffd60a',
  'Investeringsvinst': '#64d2ff',
  'Övrigt Inkomst':  '#5e5ce6',
  'Mat':             '#ff9f0a',
  'Restaurang':      '#ff6b35',
  'Transport':       '#007aff',
  'Boende':          '#5e5ce6',
  'Telefon':         '#64d2ff',
  'Streaming':       '#ff375f',
  'Kläder':          '#bf5af2',
  'Hälsa':           '#30d158',
  'Aktiviteter':     '#ff9f0a',
  'Handel':          '#ff6961',
  'Resor':           '#0071e3',
  'Sparande':        '#34c759',
  'Investering':     '#30d158',
  'Övrigt Utgift':   '#8e8e93',
  'Överföring':      '#c7c7cc',
};
