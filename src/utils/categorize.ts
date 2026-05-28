import type { Category } from '../types';

interface Rule {
  pattern: RegExp;
  category: Category;
  isTransfer?: boolean;
}

const RULES: Rule[] = [
  { pattern: /\bLÖN\b|AIFM CAPITAL|SALARY|ARBETSGIVARE/i, category: 'Lön' },
  { pattern: /STUDSTÖD|STUDIESTÖD|CSN.*BIDRAG|BIDRAG.*CSN/i, category: 'CSN Bidrag' },
  { pattern: /STUDIELÅN|CSN.*LÅN|LÅN.*CSN|TILLÄGGSLÅN/i, category: 'CSN Lån' },
  { pattern: /UTDELNING|RÄNTA.*FOND|KURSVINST/i, category: 'Investeringsvinst' },
  { pattern: /BENJAMIN SKÖ|SKÖLD BENJAM|95544998797|57233541345|50370098927|ÅTERFÖRT|INTERN ÖVERF|SWISH.*TILL.*MIG|KONTOÖVERF/i, category: 'Överföring', isTransfer: true },
  { pattern: /\bAVANZA\b/i, category: 'Överföring', isTransfer: true },
  { pattern: /HYRA|RENT|BOSTADSRÄTTSFÖRE|HEMFÖRSÄKRING|EL|VATTENFALL|FORTUM|ELLEVIO/i, category: 'Boende' },
  { pattern: /ICA|COOP|WILLYS|LIDL|HEMKÖP|NETTO|MAXI|CITY GROSS|MATVAROR/i, category: 'Mat' },
  { pattern: /SYSTEMBOLAGET/i, category: 'Mat' },
  { pattern: /MCDONALD|BURGER|MAX HAMBURGARE|SUBWAY|PIZZA|SUSHI|RESTAURANG|CAFÉ|COFFEE|WAYNES|STARBUCKS|FOODORA|WOLT|UBER EATS/i, category: 'Restaurang' },
  { pattern: /SL |SJ |BUSS|TAXI|UBER|BOLT|PARKERING|TRAFIKEN|FLYG|RYANAIR|SAS |NORWEGIAN/i, category: 'Transport' },
  { pattern: /TELIA|TELE2|TELENOR|COMVIQ|HALEBOP|THREE|3 SVERIGE|VIMLA|BREDBAND|BAHNHOF|BOXER/i, category: 'Telefon' },
  { pattern: /SPOTIFY|NETFLIX|DISNEY\+|HBO|APPLE.*SUB|YOUTUBE|AMAZON PRIME|VIAPLAY|TV4|STORYTEL/i, category: 'Streaming' },
  { pattern: /APOTEK|APOTEKET|ICA APOTEK|KRONANS APOTEK|LÄKARE|TANDLÄKARE|OPTIKER|GYM|TRÄNING|FRISKIS|SATS |ACTIC|NORDIC WELLNESS/i, category: 'Hälsa' },
  { pattern: /H&M|ZARA|ASOS|LINDEX|KappAhl|UNIQLO|MONKI|WEEKDAY|COS |ARKET|STADION|SPORTAMORE/i, category: 'Kläder' },
  { pattern: /STEAM|EPIC GAMES|BIOGRAF|BIO |MUSEUM|KONSERT|EVENTIM|TICKETMASTER/i, category: 'Aktiviteter' },
  { pattern: /HOTEL|AIRBNB|BOOKING\.COM|EXPEDIA|TRIVAGO|VING |APOLLO |TICKET\b/i, category: 'Resor' },
  { pattern: /AMAZON|ZALANDO|ELGIGANTEN|MEDIAMARKT|KOMPLETT|INET|WEBHALLEN|IKEA|CLAS OHLSON|BILTEMA|JULA/i, category: 'Handel' },
  { pattern: /AUTOSPAR|SPARANDE|SAVINGS/i, category: 'Sparande' },
];

const TRANSFER_RX = /BENJAMIN SKÖ|SKÖLD BENJAM|95544998797|57233541345|50370098927|ÅTERFÖRT|INTERN ÖVERF|KONTOÖVERF|\bAVANZA\b/i;

export function autoCat(description: string): Category {
  const desc = description.toUpperCase();
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
  'Lön': '#34c759',
  'CSN Bidrag': '#30d158',
  'CSN Lån': '#ffd60a',
  'Investeringsvinst': '#64d2ff',
  'Övrigt Inkomst': '#5e5ce6',
  'Mat': '#ff9f0a',
  'Restaurang': '#ff6b35',
  'Transport': '#007aff',
  'Boende': '#5e5ce6',
  'Telefon': '#64d2ff',
  'Streaming': '#ff375f',
  'Kläder': '#bf5af2',
  'Hälsa': '#30d158',
  'Aktiviteter': '#ff9f0a',
  'Handel': '#ff6961',
  'Resor': '#0071e3',
  'Sparande': '#34c759',
  'Investering': '#30d158',
  'Övrigt Utgift': '#8e8e93',
  'Överföring': '#c7c7cc',
};
