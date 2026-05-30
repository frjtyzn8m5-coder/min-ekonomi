import type { RecipeIngredient, PantryItem, PriceEntry } from '../types';

// Categories considered "spices/condiments" — lumped into a flat fee
const SPICE_KEYWORDS = [
  'salt', 'peppar', 'krydda', 'kryddor', 'oregano', 'basilika', 'timjan',
  'rosmarin', 'paprika', 'chili', 'curry', 'kanel', 'muskotnöt', 'kardemumma',
  'senap', 'soja', 'worcestershire', 'tabasco', 'ketchup', 'majonnäs', 'olja',
  'olivolja', 'smör', 'margarin', 'socker', 'vanilj', 'bakpulver', 'bikarbonat',
  'jäst', 'ättika', 'vinäger', 'buljong', 'fond',
];

const SPICE_LUMP_SUM_SEK = 8; // flat fee per recipe for spices/condiments

export interface CostBreakdown {
  rawCostSEK: number;       // exact grams used × pricePerKg
  realCostSEK: number;      // minimum purchasable units × pricePerUnit
  spiceLumpSumSEK: number;  // flat spice fee (if any spices present)
  totalRawSEK: number;      // rawCostSEK + spiceLumpSumSEK
  totalRealSEK: number;     // realCostSEK + spiceLumpSumSEK
  perServingRaw: number;
  perServingReal: number;
  details: IngredientCost[];
}

export interface IngredientCost {
  name: string;
  amountGrams: number;
  pricePerKg: number | null;
  pricePerUnit: number | null;
  unitWeightGrams: number | null;
  rawCost: number | null;   // null = price unknown
  realCost: number | null;
  isSpice: boolean;
  found: boolean;
}

function isSpice(name: string): boolean {
  const lower = name.toLowerCase();
  return SPICE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Build a price lookup map from pantry + priceDB entries.
 * Keys: articleNumber, barcode, or lowercased name.
 */
export function buildPriceLookup(
  pantry: PantryItem[],
  priceDB: PriceEntry[],
): Map<string, { pricePerKg?: number; pricePerUnit?: number; unitWeightGrams?: number }> {
  const map = new Map<string, { pricePerKg?: number; pricePerUnit?: number; unitWeightGrams?: number }>();

  for (const item of priceDB) {
    if (item.articleNumber) map.set(item.articleNumber, item);
    if (item.barcode) map.set(item.barcode, item);
    map.set(item.name.toLowerCase().trim(), item);
  }

  for (const item of pantry) {
    const entry = {
      pricePerKg: item.pricePerKg,
      pricePerUnit: item.pricePerUnit,
      unitWeightGrams: item.unitWeightGrams,
    };
    if (item.articleNumber) map.set(item.articleNumber, entry);
    if (item.barcode) map.set(item.barcode, entry);
    map.set(item.name.toLowerCase().trim(), entry);
  }

  return map;
}

/**
 * Fuzzy name match: try exact, then partial word overlap.
 */
function fuzzyLookup(
  name: string,
  map: Map<string, { pricePerKg?: number; pricePerUnit?: number; unitWeightGrams?: number }>,
): { pricePerKg?: number; pricePerUnit?: number; unitWeightGrams?: number } | null {
  const lower = name.toLowerCase().trim();

  // Exact match
  if (map.has(lower)) return map.get(lower)!;

  // Partial: map key contains ingredient name or vice versa
  for (const [key, val] of map) {
    if (key.includes(lower) || lower.includes(key)) return val;
  }

  return null;
}

/**
 * Calculate raw cost for one ingredient given amount in grams.
 * Raw = exact grams used / 1000 × pricePerKg
 */
function calcRawCost(
  amountGrams: number,
  entry: { pricePerKg?: number; pricePerUnit?: number; unitWeightGrams?: number } | null,
): number | null {
  if (!entry) return null;

  if (entry.pricePerKg) {
    return (amountGrams / 1000) * entry.pricePerKg;
  }

  if (entry.pricePerUnit && entry.unitWeightGrams) {
    const pricePerKg = (entry.pricePerUnit / entry.unitWeightGrams) * 1000;
    return (amountGrams / 1000) * pricePerKg;
  }

  return null;
}

/**
 * Calculate real cost: minimum number of purchasable units needed.
 * E.g. need 300g, pack = 500g → must buy 1 pack.
 * E.g. need 1200g, pack = 500g → must buy 3 packs.
 */
function calcRealCost(
  amountGrams: number,
  entry: { pricePerKg?: number; pricePerUnit?: number; unitWeightGrams?: number } | null,
): number | null {
  if (!entry) return null;

  if (entry.pricePerUnit && entry.unitWeightGrams) {
    const packsNeeded = Math.ceil(amountGrams / entry.unitWeightGrams);
    return packsNeeded * entry.pricePerUnit;
  }

  // No pack info — fall back to raw cost
  return calcRawCost(amountGrams, entry);
}

/**
 * Main cost calculation function.
 *
 * @param ingredients - recipe ingredients (with amountGrams already resolved)
 * @param servings - number of servings
 * @param pantry - user's pantry items
 * @param priceDB - price database entries
 */
export function calcRecipeCost(
  ingredients: RecipeIngredient[],
  servings: number,
  pantry: PantryItem[],
  priceDB: PriceEntry[],
): CostBreakdown {
  const priceMap = buildPriceLookup(pantry, priceDB);

  let rawTotal = 0;
  let realTotal = 0;
  let hasSpices = false;
  const details: IngredientCost[] = [];

  for (const ing of ingredients) {
    const spice = isSpice(ing.name);

    if (spice) {
      hasSpices = true;
      details.push({
        name: ing.name,
        amountGrams: ing.amount,
        pricePerKg: null,
        pricePerUnit: null,
        unitWeightGrams: null,
        rawCost: null,
        realCost: null,
        isSpice: true,
        found: false,
      });
      continue;
    }

    const entry = fuzzyLookup(ing.name, priceMap);
    const raw = calcRawCost(ing.amount, entry);
    const real = calcRealCost(ing.amount, entry);

    if (raw !== null) rawTotal += raw;
    if (real !== null) realTotal += real;

    details.push({
      name: ing.name,
      amountGrams: ing.amount,
      pricePerKg: entry?.pricePerKg ?? null,
      pricePerUnit: entry?.pricePerUnit ?? null,
      unitWeightGrams: entry?.unitWeightGrams ?? null,
      rawCost: raw,
      realCost: real,
      isSpice: false,
      found: entry !== null,
    });
  }

  // Only add spice lump sum when at least one non-spice ingredient has a known price
  const spiceLump = (hasSpices && rawTotal > 0) ? SPICE_LUMP_SUM_SEK : 0;
  const totalRaw = rawTotal + spiceLump;
  const totalReal = realTotal + spiceLump;
  const srv = Math.max(servings, 1);

  return {
    rawCostSEK: rawTotal,
    realCostSEK: realTotal,
    spiceLumpSumSEK: spiceLump,
    totalRawSEK: totalRaw,
    totalRealSEK: totalReal,
    perServingRaw: totalRaw / srv,
    perServingReal: totalReal / srv,
    details,
  };
}

/**
 * Recalculate costs when ingredient amounts change (e.g. user scales a recipe).
 * Accepts a scale factor relative to original servings.
 */
export function scaledCost(
  base: CostBreakdown,
  scaleFactor: number,
): Pick<CostBreakdown, 'totalRawSEK' | 'totalRealSEK' | 'perServingRaw' | 'perServingReal'> {
  return {
    totalRawSEK: base.totalRawSEK * scaleFactor,
    totalRealSEK: base.totalRealSEK * scaleFactor,
    perServingRaw: base.perServingRaw * scaleFactor,
    perServingReal: base.perServingReal * scaleFactor,
  };
}
