// ─── Livsmedelsverket ingredient matching ─────────────────────────────────────
// Matches a recipe ingredient name to the best LV food item.
// Used for computing recipe nutrition from ingredient grams.

import type { FoodItem } from '../types';

// Singleton LV data cache
let _lvData: FoodItem[] | null = null;

export async function getLvData(): Promise<FoodItem[]> {
  if (_lvData) return _lvData;
  const res = await fetch('/data/livsmedelsverket.json');
  const raw: any[] = await res.json();
  _lvData = raw.map(item => ({
    id: item.id,
    name: item.name,
    energy_kcal: item.energy_kcal,
    protein: item.protein,
    fat: item.fat,
    carbs: item.carbs,
    fiber: item.fiber,
    source: 'livsmedelsverket' as const,
  }));
  return _lvData!;
}

// Adjectives and state words to strip before matching
const STRIP_WORDS = new Set([
  'färsk', 'färska', 'torr', 'torra', 'fryst', 'frysta', 'kokt', 'kokta',
  'rå', 'råa', 'rökt', 'rökta', 'saltad', 'saltade', 'skalade', 'skalad',
  'hackad', 'hackade', 'skivad', 'skivade', 'finriven', 'grovhackad',
  'halverad', 'halverade', 'krossad', 'krossade', 'pressad', 'pressade',
  'stor', 'stora', 'liten', 'lilla', 'stora', 'gul', 'gula', 'röd', 'röda',
  'grön', 'gröna', 'vit', 'vita', 'svart', 'svarta',
  'vitt', 'rött', 'gult',
  'eller', 'och', 'med', 'av',
  'ca', 'ungefär',
]);

/** Normalize name for matching */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')  // strip parentheticals
    .split(/\s+/)
    .filter(w => !STRIP_WORDS.has(w) && w.length > 1)
    .join(' ')
    .trim();
}

/** Token overlap score (0-1) */
function tokenScore(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const tb = new Set(b.split(/\s+/).filter(w => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t) || [...tb].some(bt => bt.includes(t) || t.includes(bt))) overlap++;
  }
  return overlap / Math.max(ta.size, tb.size);
}

/**
 * True if `query` appears in `lvName` at a word boundary (not embedded in a
 * longer compound word like "mjölk" inside "mjölkchoklad").
 */
function isWordBoundaryMatch(lvName: string, query: string): boolean {
  const idx = lvName.indexOf(query);
  if (idx === -1) return false;
  const before = idx === 0 || /[\s,]/.test(lvName[idx - 1]);
  const after = idx + query.length === lvName.length || /[\s,]/.test(lvName[idx + query.length]);
  return before && after;
}

/**
 * Match an ingredient name to the best LV food item.
 * Returns null if no reasonable match is found.
 *
 * Scoring (higher = better):
 *   1.0 – exact match after normalisation
 *   0.7–0.9 – query appears as a proper word in lvName, penalised for extra tokens
 *   0.2–0.4 – query is embedded in a compound word (e.g. "mjölk" in "mjölkchoklad")
 *   0.0–0.3 – token overlap only
 */
export function matchToLV(ingredientName: string, lvData: FoodItem[]): FoodItem | null {
  const query = normalize(ingredientName);
  if (!query) return null;

  let bestItem: FoodItem | null = null;
  let bestScore = 0;

  for (const item of lvData) {
    const lvName = normalize(item.name);

    // Exact match — return immediately
    if (lvName === query) return item;

    let score = 0;

    if (isWordBoundaryMatch(lvName, query)) {
      // Query is a proper standalone word inside lvName (e.g. "mjölk" in "mjölk standardmjölk")
      // Penalise longer names so "Mjölk" beats "Mjölk, standardmjölk 3%"
      score = 0.9 * (query.length / Math.max(query.length, lvName.length));
    } else if (lvName.includes(query)) {
      // Query embedded in a compound word — heavily penalise
      score = 0.25 * (query.length / lvName.length);
    } else if (query.includes(lvName)) {
      score = (lvName.length / query.length) * 0.8;
    } else {
      score = tokenScore(query, lvName) * 0.7;
    }

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  // Only return if confidence is reasonable
  return bestScore >= 0.35 ? bestItem : null;
}

/**
 * Calculate nutrition for one ingredient given grams and matched LV item.
 * All values are per the given gram amount.
 */
export function nutritionForGrams(
  item: FoodItem,
  grams: number,
): { kcal: number; protein: number; fat: number; carbs: number; fiber?: number } {
  const factor = grams / 100;
  return {
    kcal:    Math.round(item.energy_kcal * factor),
    protein: Math.round(item.protein * factor * 10) / 10,
    fat:     Math.round(item.fat * factor * 10) / 10,
    carbs:   Math.round(item.carbs * factor * 10) / 10,
    fiber:   item.fiber != null ? Math.round(item.fiber * factor * 10) / 10 : undefined,
  };
}

/**
 * Compute total recipe nutrition per serving from ingredients.
 * Each ingredient must have grams resolved and a matched LV item.
 */
export function calcRecipeNutrition(
  ingredients: Array<{ grams: number; lvItem: FoodItem | null }>,
  servings: number,
): { kcal: number; protein: number; fat: number; carbs: number; fiber?: number } {
  let kcal = 0, protein = 0, fat = 0, carbs = 0, fiber = 0;

  for (const { grams, lvItem } of ingredients) {
    if (!lvItem || grams <= 0) continue;
    const n = nutritionForGrams(lvItem, grams);
    kcal    += n.kcal;
    protein += n.protein;
    fat     += n.fat;
    carbs   += n.carbs;
    fiber   += n.fiber ?? 0;
  }

  const srv = Math.max(servings, 1);
  return {
    kcal:    Math.round(kcal / srv),
    protein: Math.round(protein / srv * 10) / 10,
    fat:     Math.round(fat / srv * 10) / 10,
    carbs:   Math.round(carbs / srv * 10) / 10,
    fiber:   fiber > 0 ? Math.round(fiber / srv * 10) / 10 : undefined,
  };
}
