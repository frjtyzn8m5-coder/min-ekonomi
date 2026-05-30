// ─── Swedish cooking unit converter → grams ──────────────────────────────────

// Base conversions (to grams or ml, 1:1 for liquids)
const UNIT_MAP: Record<string, number> = {
  'kg': 1000,
  'g': 1,
  'hg': 100,
  'mg': 0.001,
  'l': 1000,
  'liter': 1000,
  'dl': 100,
  'cl': 10,
  'ml': 1,
  'msk': 15,
  'matsked': 15,
  'tsk': 5,
  'tesked': 5,
  'krm': 0.5,
  'kn': 0.5,
};

// Per-ingredient density corrections (dl → g, varies by ingredient)
// These override the default 100g/dl for common dry ingredients
const DL_DENSITY: Record<string, number> = {
  'mjöl': 60,
  'vetemjöl': 60,
  'rågmjöl': 65,
  'socker': 85,
  'strösocker': 85,
  'florsocker': 50,
  'kakao': 50,
  'havregryn': 40,
  'rivna ost': 50,
  'riven ost': 50,
  'mandelmjöl': 55,
  'potatismjöl': 80,
  'maizena': 70,
  'salt': 140,
  'ris': 80,
  'pasta': 70,
  'linser': 85,
  'gräddfil': 120,
  'grädde': 100,
  'mjölk': 103,
  'vatten': 100,
  'olja': 90,
  'olivolja': 90,
  'smör': 95,
  'margarin': 95,
  'honung': 140,
  'sirap': 140,
  'yoghurt': 105,
  'keso': 105,
  'kvarg': 110,
  'riven': 60,
};

// Default item weights per "st" (grams)
const ST_WEIGHTS: Record<string, number> = {
  'ägg': 60,
  'lök': 150,
  'gul lök': 150,
  'rödlök': 150,
  'vitlöksklyfta': 5,
  'vitlök': 40,
  'tomat': 120,
  'plommontomat': 80,
  'potatis': 150,
  'morot': 100,
  'paprika': 150,
  'avocado': 200,
  'lime': 80,
  'citron': 120,
  'apelsin': 200,
  'banan': 120,
  'äpple': 180,
  'päron': 170,
  'gurka': 400,
  'rödbeta': 200,
  'palsternacka': 150,
  'majskolv': 300,
};

export interface ConversionResult {
  grams: number | null;
  confidence: 'high' | 'medium' | 'low';
}

export function toGrams(
  amount: number,
  unit: string,
  ingredientName: string = ''
): ConversionResult {
  const u = unit.toLowerCase().trim();
  const name = ingredientName.toLowerCase();

  // Direct weight units
  if (u in UNIT_MAP) {
    const factor = UNIT_MAP[u];
    if (u === 'dl') {
      // Check for density override
      for (const [key, density] of Object.entries(DL_DENSITY)) {
        if (name.includes(key)) {
          return { grams: amount * density, confidence: 'high' };
        }
      }
      // Default: 100g/dl (water-like)
      return { grams: amount * 100, confidence: 'medium' };
    }
    return { grams: amount * factor, confidence: 'high' };
  }

  // "st" - look up by ingredient name
  if (u === 'st' || u === 'stycken' || u === 'styck') {
    for (const [key, weight] of Object.entries(ST_WEIGHTS)) {
      if (name.includes(key)) {
        return { grams: amount * weight, confidence: 'medium' };
      }
    }
    return { grams: null, confidence: 'low' };
  }

  // Package units - return null (unknown weight)
  if (['förpackning', 'förp', 'paket', 'burk', 'portion', 'näve', 'skiva', 'skivor'].includes(u)) {
    return { grams: null, confidence: 'low' };
  }

  return { grams: null, confidence: 'low' };
}

// Parse ingredient string like "3 dl mjölk" or "2 msk smör"
export interface ParsedIngredient {
  amount: number;
  unit: string;
  name: string;
  grams: number | null;
}

export function parseIngredientText(text: string): ParsedIngredient {
  // Match: NUMBER UNIT REST or NUMBER REST
  const re = /^([\d.,/½¼¾]+)\s+([a-zA-ZåäöÅÄÖ]+)\s+(.+)$/;
  const re2 = /^([\d.,/½¼¾]+)\s+(.+)$/;

  let amount = 1, unit = 'st', name = text.trim();

  const m = text.trim().match(re);
  if (m) {
    amount = parseFraction(m[1]);
    unit = m[2];
    name = m[3];
    // If unit looks like a food name (not in UNIT_MAP and not 'st'), treat as unitless
    if (!isUnit(unit)) {
      name = unit + ' ' + name;
      unit = 'st';
    }
  } else {
    const m2 = text.trim().match(re2);
    if (m2) {
      amount = parseFraction(m2[1]);
      name = m2[2];
      unit = 'st';
    }
  }

  const { grams } = toGrams(amount, unit, name);
  return { amount, unit, name, grams };
}

function parseFraction(s: string): number {
  if (s === '½') return 0.5;
  if (s === '¼') return 0.25;
  if (s === '¾') return 0.75;
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    return parseFloat(a) / parseFloat(b);
  }
  return parseFloat(s.replace(',', '.')) || 1;
}

function isUnit(s: string): boolean {
  const u = s.toLowerCase();
  return u in UNIT_MAP || ['st', 'stycken', 'styck', 'förpackning', 'förp', 'paket', 'burk', 'portion'].includes(u);
}
