// ─── Swedish cooking unit converter → grams ──────────────────────────────────

// Volume units → ml
const UNIT_ML: Record<string, number> = {
  l: 1000, liter: 1000,
  dl: 100,
  cl: 10,
  ml: 1,
  msk: 15, matsked: 15, 'msk.': 15,
  tsk: 5, tesked: 5, 'tsk.': 5,
  krm: 0.5, kn: 0.5, nypa: 0.5,
};

// Weight units → g
const UNIT_G: Record<string, number> = {
  kg: 1000,
  hg: 100,
  g: 1, gr: 1,
  mg: 0.001,
};

// Density (g/ml) keyed by ingredient substring — longer keys checked first for specificity
const DENSITIES: [string, number][] = [
  // Dry goods
  ['vetemjöl', 0.60], ['rågmjöl', 0.65], ['dinkelmjöl', 0.60], ['majsmjöl', 0.70],
  ['mjöl', 0.60],
  ['strösocker', 0.85], ['florsocker', 0.50], ['farinsocker', 0.80], ['socker', 0.85],
  ['kakao', 0.50], ['chokladpulver', 0.50],
  ['havregryn', 0.40], ['gryn', 0.40],
  ['mandelmjöl', 0.55], ['kokosmjöl', 0.45],
  ['potatismjöl', 0.80], ['majsstärkelse', 0.70], ['maizena', 0.70], ['maizena', 0.70],
  ['salt', 1.40], ['flingsalt', 0.60],
  ['pasta', 0.70], ['penne', 0.70], ['spaghetti', 0.70], ['rigatoni', 0.70],
  ['ris', 0.80], ['linser', 0.85], ['kikärtor', 0.90], ['bönor', 0.85],
  ['nötter', 0.65], ['valnötter', 0.65], ['mandlar', 0.65], ['jordnötter', 0.65],
  ['russin', 0.65], ['vindruvor', 0.80],
  ['kokos', 0.45],
  ['riven parmesan', 0.50], ['riven ost', 0.50], ['riven', 0.50], ['parmesan', 0.50],
  // Fats
  ['smör', 0.95], ['margarin', 0.95],
  ['olivolja', 0.92], ['rapsolja', 0.90], ['kokosolja', 0.90], ['olja', 0.90],
  // Dairy
  ['standardmjölk', 1.03], ['lättmjölk', 1.03], ['mellanmjölk', 1.03], ['mjölk', 1.03],
  ['vispgrädde', 1.00], ['matlagningsgrädde', 1.00], ['grädde', 1.00],
  ['gräddfil', 1.05], ['filmjölk', 1.04],
  ['crème fraîche', 1.00], ['creme fraiche', 1.00], ['fraiche', 1.00],
  ['yoghurt', 1.05], ['keso', 1.05], ['kvarg', 1.10],
  ['römme', 1.05],
  // Liquids
  ['buljong', 1.00], ['fond', 1.05],
  ['vitt vin', 1.00], ['rödvin', 1.00], ['vitvin', 1.00], ['matlagningsvin', 1.00], ['vin', 1.00],
  ['öl', 1.00], ['juice', 1.05],
  ['sojasås', 1.08], ['soja', 1.08],
  ['honung', 1.40], ['lönnsirap', 1.40], ['sirap', 1.40],
  ['ketchup', 1.10], ['tomatpuré', 1.20], ['tomatpure', 1.20],
  ['senap', 1.10], ['dijonsenap', 1.10],
  ['vatten', 1.00],
];

// Sort by key length descending so "vispgrädde" matches before "grädde"
DENSITIES.sort((a, b) => b[0].length - a[0].length);

// Piece weights (grams per unit) — sorted by key length descending at runtime
const ST_WEIGHTS_RAW: [string, number][] = [
  ['äggula', 20], ['äggvita', 35], ['ägg', 60],
  ['stor gul lök', 200], ['liten gul lök', 100], ['gul lök', 150],
  ['schalottenlök', 40], ['silverlök', 20], ['rödlök', 150],
  ['vitlöksklyfta', 5], ['vitlök', 40], ['lök', 150],
  ['plommontomat', 80], ['körsbärstomat', 15], ['tomat', 120],
  ['stor potatis', 200], ['liten potatis', 100], ['potatis', 150],
  ['stor morot', 150], ['morot', 100],
  ['paprika', 150], ['chili', 15], ['jalapeño', 15],
  ['avocado', 200],
  ['citron', 120], ['lime', 80], ['apelsin', 200],
  ['banan', 120], ['äpple', 180], ['päron', 170],
  ['gurka', 400],
  ['rödbeta', 200], ['palsternacka', 150], ['majskolv', 300],
  ['champinjon', 15], ['shiitake', 12],
  ['persilja', 5], ['dill', 5], ['basilika', 3], ['koriander', 5],
  ['lagerblad', 1], ['timjankvist', 2],
  ['skiva', 25],
  ['kruka', 15],  // fresh herb pot
  ['burk', 400],
  ['förpackning', 500],
];
ST_WEIGHTS_RAW.sort((a, b) => b[0].length - a[0].length);

// Swedish plural → singular normalization
const PLURAL_RULES: [RegExp, string][] = [
  [/klyftor$/i, 'klyfta'],
  [/lökar$/i, 'lök'],
  [/löker$/i, 'lök'],
  [/tomater$/i, 'tomat'],
  [/morötter$/i, 'morot'],
  [/potatisar$/i, 'potatis'],
  [/champinjoner$/i, 'champinjon'],
  [/skivor$/i, 'skiva'],
  [/stjälkar$/i, 'stjälk'],
  [/ägg$/i, 'ägg'],   // already singular
  [/nötter$/i, 'nöt'],
  [/löv$/i, 'blad'],
  [/oner$/i, 'on'],  // citroner → citron etc.
  [/er$/i, ''],      // champinjoner already caught above
  [/ar$/i, ''],      // lökar already caught above
  [/or$/i, ''],
];

function singularize(s: string): string {
  for (const [re, replacement] of PLURAL_RULES) {
    if (re.test(s)) return s.replace(re, replacement);
  }
  return s;
}

/** Strip parentheticals, adjectives, and normalize for ingredient matching */
function cleanName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // remove (...)
    .replace(/\b(färsk|torr|fryst|kokt|rå|rökt|finriven|grovhackad|hackad|skivad|halverad|krossad|pressad|skalade?)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract "(à X g)" or "(X g)" or "(X ml)" hint from text, return grams or null */
function extractParenthesisHint(text: string): number | null {
  // Match patterns like "(à 20 g)", "(20g)", "(ca 30 g)", "(~25 g)"
  const re = /\(\s*(?:à|ca\.?|~)?\s*([\d.,]+)\s*(g|ml|gram)\s*\)/i;
  const m = text.match(re);
  if (!m) return null;
  const val = parseFloat(m[1].replace(',', '.'));
  if (isNaN(val)) return null;
  if (m[2].toLowerCase() === 'ml') return val; // treat ml as g (approx)
  return val;
}

export interface ConversionResult {
  grams: number | null;
  confidence: 'high' | 'medium' | 'low';
}

export function toGrams(
  amount: number,
  unit: string,
  ingredientName: string = '',
): ConversionResult {
  const u = unit.toLowerCase().trim();
  const rawName = ingredientName.toLowerCase();
  const name = cleanName(rawName);
  const nameSingular = singularize(name);

  // ── Volume units → ml → grams via density ──────────────────────────────
  if (u in UNIT_ML) {
    const ml = amount * UNIT_ML[u];
    // Try density lookup (longer keys first for specificity)
    for (const [key, density] of DENSITIES) {
      if (name.includes(key) || nameSingular.includes(key)) {
        return { grams: Math.round(ml * density), confidence: 'high' };
      }
    }
    // Default water density
    return { grams: Math.round(ml), confidence: 'medium' };
  }

  // ── Weight units ──────────────────────────────────────────────────────────
  if (u in UNIT_G) {
    return { grams: amount * UNIT_G[u], confidence: 'high' };
  }

  // ── Piece units ───────────────────────────────────────────────────────────
  const piecesUnits = ['st', 'stycken', 'styck', 'st.', 'klyfta', 'klyftor', 'skiva', 'skivor'];
  if (piecesUnits.includes(u) || u === '') {
    for (const [key, weight] of ST_WEIGHTS_RAW) {
      if (name.includes(key) || nameSingular.includes(key)) {
        return { grams: Math.round(amount * weight), confidence: 'medium' };
      }
    }
    return { grams: null, confidence: 'low' };
  }

  // ── Package/unknown units ─────────────────────────────────────────────────
  const packageUnits = [
    'förpackning', 'förp', 'paket', 'burk', 'portion', 'portioner',
    'näve', 'kruka', 'knippe', 'kvist', 'kvisitar',
  ];
  if (packageUnits.includes(u)) {
    // "X portioner pasta" → use a typical serving weight for that ingredient
    if (u === 'portion' || u === 'portioner') {
      // Typical serving weights in grams
      const SERVING_WEIGHTS: [string, number][] = [
        ['pasta', 80], ['spaghetti', 80], ['penne', 80], ['rigatoni', 80],
        ['ris', 70], ['quinoa', 70],
        ['köttfärs', 150], ['kyckling', 150], ['fisk', 150],
        ['potatis', 150],
        ['soppa', 300], ['sallad', 100],
      ];
      for (const [key, serving] of SERVING_WEIGHTS) {
        if (name.includes(key)) {
          return { grams: Math.round(amount * serving), confidence: 'low' };
        }
      }
      // Generic: 1 portion ≈ 200g
      return { grams: Math.round(amount * 200), confidence: 'low' };
    }
    // Try to find a weight for the unit type
    for (const [key, weight] of ST_WEIGHTS_RAW) {
      if (u.includes(key) || key.includes(u)) {
        return { grams: Math.round(amount * weight), confidence: 'low' };
      }
    }
    return { grams: null, confidence: 'low' };
  }

  // ── Unrecognized unit — try to match as ingredient name ──────────────────
  // e.g. "1 purjolök" where "purjolök" becomes the unit
  const combined = `${u} ${name}`.trim();
  for (const [key, weight] of ST_WEIGHTS_RAW) {
    if (combined.includes(key) || singularize(combined).includes(key)) {
      return { grams: Math.round(amount * weight), confidence: 'low' };
    }
  }

  return { grams: null, confidence: 'low' };
}

// ─── Parse ingredient string ──────────────────────────────────────────────────

export interface ParsedIngredient {
  amount: number;
  unit: string;
  name: string;
  grams: number | null;
  originalText: string;
}

export function parseIngredientText(text: string): ParsedIngredient {
  const raw = text.trim();

  // 1. Check for parenthesis hint FIRST, return immediately if precise
  const hintGrams = extractParenthesisHint(raw);

  // 2. Normalize amount separators
  let s = raw
    .replace(/½/g, '1/2')   // ½
    .replace(/¼/g, '1/4')   // ¼
    .replace(/¾/g, '3/4')   // ¾
    .replace(/^ca\.?\s*/i, '')   // strip "ca." prefix
    .replace(/^ungefär\s*/i, '')
    .replace(/^typ\s*/i, '')
    .trim();

  // 3. Handle ranges: "3-4 potatisar" → 3 (take lower bound)
  s = s.replace(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*\d+(?:[.,]\d+)?/, '$1');

  // 4. Try full match: NUMBER UNIT NAME
  const re1 = /^([\d.,/]+)\s+([a-zA-ZåäöÅÄÖ.]+)\s+(.+)$/;
  const re2 = /^([\d.,/]+)\s+(.+)$/;  // NUMBER NAME (no unit)

  let amount = 1;
  let unit = 'st';
  let name = raw;

  const m1 = s.match(re1);
  if (m1) {
    amount = parseFraction(m1[1]);
    const candidateUnit = m1[2].toLowerCase();
    if (isUnit(candidateUnit)) {
      unit = candidateUnit;
      name = m1[3];
    } else {
      // Word after number is not a unit — treat whole remainder as name
      unit = 'st';
      name = m1[2] + ' ' + m1[3];
    }
  } else {
    const m2 = s.match(re2);
    if (m2) {
      amount = parseFraction(m2[1]);
      unit = 'st';
      name = m2[2];
    }
    // else: no number at all → amount=1, unit='st', name=raw
  }

  // Strip trailing parentheticals from name for cleaner display
  name = name.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

  // 5. If hint was found, use it directly
  if (hintGrams !== null) {
    return { amount, unit, name, grams: hintGrams, originalText: raw };
  }

  const { grams } = toGrams(amount, unit, name);
  return { amount, unit, name, grams, originalText: raw };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFraction(s: string): number {
  s = s.replace(',', '.');
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    const result = parseFloat(a) / parseFloat(b);
    return isNaN(result) ? 1 : result;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 1 : n;
}

function isUnit(s: string): boolean {
  const u = s.toLowerCase().replace(/\.$/, '');
  return (
    u in UNIT_ML ||
    u in UNIT_G ||
    ['st', 'stycken', 'styck', 'st.', 'förpackning', 'förp', 'paket',
     'burk', 'portion', 'portioner', 'näve', 'kruka', 'knippe', 'kvist', 'skivor', 'klyftor'].includes(u)
  );
}

/** Extract "(à X g)" or "(X g)" or "(X ml)" hint from text, return grams or null */
function extractParenthesisHint(text: string): number | null {
  const re = /\(\s*(?:à|ca\.?|~)?\s*([\d.,]+)\s*(g|ml|gram)\s*\)/i;
  const m = text.match(re);
  if (!m) return null;
  const val = parseFloat(m[1].replace(',', '.'));
  if (isNaN(val)) return null;
  if (m[2].toLowerCase() === 'ml') return val;
  return val;
}

export interface ConversionResult {
  grams: number | null;
  confidence: 'high' | 'medium' | 'low';
}

export function toGrams(
  amount: number,
  unit: string,
  ingredientName: string = '',
): ConversionResult {
  const u = unit.toLowerCase().trim();
  const rawName = ingredientName.toLowerCase();
  const name = cleanName(rawName);
  const nameSingular = singularize(name);

  if (u in UNIT_ML) {
    const ml = amount * UNIT_ML[u];
    for (const [key, density] of DENSITIES) {
      if (name.includes(key) || nameSingular.includes(key)) {
        return { grams: Math.round(ml * density), confidence: 'high' };
      }
    }
    return { grams: Math.round(ml), confidence: 'medium' };
  }

  if (u in UNIT_G) {
    return { grams: amount * UNIT_G[u], confidence: 'high' };
  }

  const piecesUnits = ['st', 'stycken', 'styck', 'st.', 'klyfta', 'klyftor', 'skiva', 'skivor'];
  if (piecesUnits.includes(u) || u === '') {
    for (const [key, weight] of ST_WEIGHTS_RAW) {
      if (name.includes(key) || nameSingular.includes(key)) {
        return { grams: Math.round(amount * weight), confidence: 'medium' };
      }
    }
    return { grams: null, confidence: 'low' };
  }

  const packageUnits = [
    'förpackning', 'förp', 'paket', 'burk', 'portion', 'portioner',
    'näve', 'kruka', 'knippe', 'kvist', 'kvisitar',
  ];
  if (packageUnits.includes(u)) {
    if (u === 'portion' || u === 'portioner') {
      const SERVING_WEIGHTS: [string, number][] = [
        ['pasta', 80], ['spaghetti', 80], ['penne', 80], ['rigatoni', 80],
        ['ris', 70], ['quinoa', 70],
        ['köttfärs', 150], ['kyckling', 150], ['fisk', 150],
        ['potatis', 150],
        ['soppa', 300], ['sallad', 100],
      ];
      for (const [key, serving] of SERVING_WEIGHTS) {
        if (name.includes(key)) {
          return { grams: Math.round(amount * serving), confidence: 'low' };
        }
      }
      return { grams: Math.round(amount * 200), confidence: 'low' };
    }
    for (const [key, weight] of ST_WEIGHTS_RAW) {
      if (u.includes(key) || key.includes(u)) {
        return { grams: Math.round(amount * weight), confidence: 'low' };
      }
    }
    return { grams: null, confidence: 'low' };
  }

  const combined = `${u} ${name}`.trim();
  for (const [key, weight] of ST_WEIGHTS_RAW) {
    if (combined.includes(key) || singularize(combined).includes(key)) {
      return { grams: Math.round(amount * weight), confidence: 'low' };
    }
  }

  return { grams: null, confidence: 'low' };
}

// ─── Parse ingredient string ──────────────────────────────────────────────────

export interface ParsedIngredient {
  amount: number;
  unit: string;
  name: string;
  grams: number | null;
  originalText: string;
}

export function parseIngredientText(text: string): ParsedIngredient {
  const raw = text.trim();

  const hintGrams = extractParenthesisHint(raw);

  let s = raw
    .replace(/½/g, '1/2')
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/^ca\.?\s*/i, '')
    .replace(/^ungefär\s*/i, '')
    .replace(/^typ\s*/i, '')
    .trim();

  s = s.replace(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*\d+(?:[.,]\d+)?/, '$1');

  const re1 = /^([\d.,/]+)\s+([a-zA-ZåäöÅÄÖ.]+)\s+(.+)$/;
  const re2 = /^([\d.,/]+)\s+(.+)$/;

  let amount = 1;
  let unit = 'st';
  let name = raw;

  const m1 = s.match(re1);
  if (m1) {
    amount = parseFraction(m1[1]);
    const candidateUnit = m1[2].toLowerCase();
    if (isUnit(candidateUnit)) {
      unit = candidateUnit;
      name = m1[3];
    } else {
      unit = 'st';
      name = m1[2] + ' ' + m1[3];
    }
  } else {
    const m2 = s.match(re2);
    if (m2) {
      amount = parseFraction(m2[1]);
      unit = 'st';
      name = m2[2];
    }
  }

  name = name.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

  if (hintGrams !== null) {
    return { amount, unit, name, grams: hintGrams, originalText: raw };
  }

  const { grams } = toGrams(amount, unit, name);
  return { amount, unit, name, grams, originalText: raw };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFraction(s: string): number {
  s = s.replace(',', '.');
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    const result = parseFloat(a) / parseFloat(b);
    return isNaN(result) ? 1 : result;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 1 : n;
}

function isUnit(s: string): boolean {
  const u = s.toLowerCase().replace(/\.$/, '');
  return (
    u in UNIT_ML ||
    u in UNIT_G ||
    ['st', 'stycken', 'styck', 'st.', 'förpackning', 'förp', 'paket',
     'burk', 'portion', 'portioner', 'näve', 'kruka', 'knippe', 'kvist', 'skivor', 'klyftor'].includes(u)
  );
}
