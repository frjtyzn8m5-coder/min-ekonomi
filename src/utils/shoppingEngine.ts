// ─── Smart shopping / pantry engine ───────────────────────────────────────────
// Deterministic (no LLM) core that turns a set of planned recipes + the pantry
// into a smart shopping list:
//   1. Aggregate the same ingredient across all planned recipes (canonical base = grams)
//   2. Subtract pantry stock already on hand (unit-aware, fuzzy name match)
//   3. Round up to logical Swedish grocery package sizes
//   4. Compute a pantryDelta (bought − needed) so leftovers go back to the pantry
//   5. Per-portion macros (matlåda) from an existing recipe
//   6. Group by category + optional cost estimate (only when a real price exists)
//
// Builds on existing helpers — does NOT duplicate them:
//   - unitConverter.toGrams  → piece/volume → grams
//   - recipeCost.buildPriceLookup → price map from pantry + priceDB
//
// All exported functions are PURE and typed so they can be unit-tested.

import type { Recipe, RecipeIngredient, PantryItem, PriceEntry } from '../types';
import { toGrams } from './unitConverter';
import { buildPriceLookup } from './recipeCost';

// ─── Categories ────────────────────────────────────────────────────────────────

export type ShoppingCategory =
  | 'Kött & Fisk'
  | 'Mejeri'
  | 'Grönt'
  | 'Torrvaror'
  | 'Skafferi'
  | 'Bröd'
  | 'Dryck'
  | 'Fryst'
  | 'Kryddor'
  | 'Övrigt';

// Ordered for stable, sensible shopping-list grouping (how you walk a store).
export const CATEGORY_ORDER: ShoppingCategory[] = [
  'Grönt',
  'Kött & Fisk',
  'Mejeri',
  'Bröd',
  'Torrvaror',
  'Skafferi',
  'Kryddor',
  'Dryck',
  'Fryst',
  'Övrigt',
];

// Keyword → category classifier (first substring match wins; longer keys first).
const CATEGORY_KEYWORDS: [string, ShoppingCategory][] = [
  // Kött & Fisk
  ['köttfärs', 'Kött & Fisk'], ['nötfärs', 'Kött & Fisk'], ['blandfärs', 'Kött & Fisk'],
  ['fläskfärs', 'Kött & Fisk'], ['kycklingfärs', 'Kött & Fisk'], ['färs', 'Kött & Fisk'],
  ['kyckling', 'Kött & Fisk'], ['kalkon', 'Kött & Fisk'],
  ['fläsk', 'Kött & Fisk'], ['bacon', 'Kött & Fisk'], ['skinka', 'Kött & Fisk'],
  ['korv', 'Kött & Fisk'], ['biff', 'Kött & Fisk'], ['oxfilé', 'Kött & Fisk'],
  ['entrecôte', 'Kött & Fisk'], ['lamm', 'Kött & Fisk'], ['kött', 'Kött & Fisk'],
  ['lax', 'Kött & Fisk'], ['torsk', 'Kött & Fisk'], ['fisk', 'Kött & Fisk'],
  ['räkor', 'Kött & Fisk'], ['tonfisk', 'Kött & Fisk'], ['sej', 'Kött & Fisk'],
  // Mejeri
  ['mjölk', 'Mejeri'], ['grädde', 'Mejeri'], ['gräddfil', 'Mejeri'],
  ['crème fraiche', 'Mejeri'], ['creme fraiche', 'Mejeri'], ['fraiche', 'Mejeri'],
  ['yoghurt', 'Mejeri'], ['filmjölk', 'Mejeri'], ['kvarg', 'Mejeri'], ['keso', 'Mejeri'],
  ['smör', 'Mejeri'], ['ost', 'Mejeri'], ['ägg', 'Mejeri'], ['margarin', 'Mejeri'],
  // Grönt (grönsaker + frukt)
  ['potatis', 'Grönt'], ['morot', 'Grönt'], ['lök', 'Grönt'], ['vitlök', 'Grönt'],
  ['tomat', 'Grönt'], ['paprika', 'Grönt'], ['gurka', 'Grönt'], ['sallad', 'Grönt'],
  ['spenat', 'Grönt'], ['broccoli', 'Grönt'], ['blomkål', 'Grönt'], ['zucchini', 'Grönt'],
  ['svamp', 'Grönt'], ['champinjon', 'Grönt'], ['avocado', 'Grönt'], ['avokado', 'Grönt'],
  ['citron', 'Grönt'], ['lime', 'Grönt'], ['äpple', 'Grönt'], ['banan', 'Grönt'],
  ['ingefära', 'Grönt'], ['purjolök', 'Grönt'], ['rödlök', 'Grönt'], ['vårlök', 'Grönt'],
  ['persilja', 'Grönt'], ['basilika', 'Grönt'], ['koriander', 'Grönt'], ['dill', 'Grönt'],
  // Torrvaror
  ['ris', 'Torrvaror'], ['pasta', 'Torrvaror'], ['spaghetti', 'Torrvaror'],
  ['penne', 'Torrvaror'], ['makaroner', 'Torrvaror'], ['nudlar', 'Torrvaror'],
  ['mjöl', 'Torrvaror'], ['havregryn', 'Torrvaror'], ['gryn', 'Torrvaror'],
  ['quinoa', 'Torrvaror'], ['couscous', 'Torrvaror'], ['bulgur', 'Torrvaror'],
  ['linser', 'Torrvaror'], ['bönor', 'Torrvaror'], ['kikärt', 'Torrvaror'],
  ['socker', 'Torrvaror'], ['müsli', 'Torrvaror'],
  // Bröd
  ['bröd', 'Bröd'], ['tortilla', 'Bröd'], ['knäckebröd', 'Bröd'], ['bulle', 'Bröd'],
  // Dryck
  ['juice', 'Dryck'], ['läsk', 'Dryck'], ['öl', 'Dryck'], ['vin', 'Dryck'], ['kaffe', 'Dryck'],
  // Skafferi (konserver, såser, oljor, basvaror)
  ['krossade tomater', 'Skafferi'], ['tomatpuré', 'Skafferi'], ['passerade', 'Skafferi'],
  ['kokosmjölk', 'Skafferi'], ['buljong', 'Skafferi'], ['fond', 'Skafferi'],
  ['olivolja', 'Skafferi'], ['rapsolja', 'Skafferi'], ['olja', 'Skafferi'],
  ['soja', 'Skafferi'], ['ketchup', 'Skafferi'], ['senap', 'Skafferi'],
  ['majonnäs', 'Skafferi'], ['vinäger', 'Skafferi'], ['honung', 'Skafferi'],
  ['sirap', 'Skafferi'], ['nötter', 'Skafferi'], ['mandel', 'Skafferi'],
  // Kryddor
  ['salt', 'Kryddor'], ['peppar', 'Kryddor'], ['krydda', 'Kryddor'], ['paprikapulver', 'Kryddor'],
  ['oregano', 'Kryddor'], ['timjan', 'Kryddor'], ['curry', 'Kryddor'], ['chili', 'Kryddor'],
  ['kanel', 'Kryddor'], ['spiskummin', 'Kryddor'], ['bakpulver', 'Kryddor'], ['vanilj', 'Kryddor'],
  // Fryst
  ['fryst', 'Fryst'], ['glass', 'Fryst'],
];
// Longer keys first so "köttfärs" matches before "kött", "vitlök" before "lök".
CATEGORY_KEYWORDS.sort((a, b) => b[0].length - a[0].length);

export function classifyCategory(name: string): ShoppingCategory {
  const n = name.toLowerCase();
  for (const [key, cat] of CATEGORY_KEYWORDS) {
    if (n.includes(key)) return cat;
  }
  return 'Övrigt';
}

// ─── Package sizes ─────────────────────────────────────────────────────────────

export interface PackageSize {
  /** Canonical pack size expressed in the base unit (grams). */
  grams: number;
  /** Human label, e.g. "1 kg", "500 g", "1 l", "6 st". */
  label: string;
}

export interface PackageRule {
  /** Lowercased name substrings that select this rule. */
  match: string[];
  category: ShoppingCategory;
  /** Available package sizes (any order; sorted ascending internally). */
  packs: PackageSize[];
  /** For count-based items (ägg, lök…): grams per piece, for st display. */
  gramsPerPiece?: number;
  /** How to present quantities: affects display only, not the math. */
  displayUnit?: 'g' | 'kg' | 'l' | 'st';
}

// Small table of common Swedish grocery package sizes. Sizes are canonicalised
// to grams (liquids ≈ 1 g/ml here — good enough for pack rounding).
export const PACKAGE_SIZES: PackageRule[] = [
  // ── Torrvaror ──
  { match: ['ris', 'jasminris', 'basmati'], category: 'Torrvaror', displayUnit: 'kg',
    packs: [{ grams: 500, label: '0,5 kg' }, { grams: 1000, label: '1 kg' }] },
  { match: ['pasta', 'spaghetti', 'penne', 'makaroner', 'rigatoni', 'fusilli', 'tagliatelle'],
    category: 'Torrvaror', displayUnit: 'g',
    packs: [{ grams: 500, label: '500 g' }, { grams: 1000, label: '1 kg' }] },
  { match: ['vetemjöl', 'rågmjöl', 'dinkelmjöl', 'mjöl'], category: 'Torrvaror', displayUnit: 'kg',
    packs: [{ grams: 1000, label: '1 kg' }, { grams: 2000, label: '2 kg' }] },
  { match: ['socker', 'strösocker'], category: 'Torrvaror', displayUnit: 'kg',
    packs: [{ grams: 1000, label: '1 kg' }] },
  { match: ['havregryn', 'gryn'], category: 'Torrvaror', displayUnit: 'g',
    packs: [{ grams: 500, label: '500 g' }, { grams: 1500, label: '1,5 kg' }] },
  { match: ['linser', 'bönor', 'kikärt'], category: 'Torrvaror', displayUnit: 'g',
    packs: [{ grams: 380, label: '1 burk (380 g)' }] },

  // ── Kött & Fisk ──
  { match: ['köttfärs', 'nötfärs', 'blandfärs', 'fläskfärs', 'kycklingfärs', 'färs'],
    category: 'Kött & Fisk', displayUnit: 'g',
    packs: [{ grams: 500, label: '0,5 kg' }, { grams: 1000, label: '1 kg' }] },
  { match: ['kycklingfilé', 'kycklingbröst', 'kyckling'], category: 'Kött & Fisk', displayUnit: 'g',
    packs: [{ grams: 500, label: '0,5 kg' }, { grams: 900, label: '0,9 kg' }] },
  { match: ['lax', 'torsk', 'sej', 'fiskfilé'], category: 'Kött & Fisk', displayUnit: 'g',
    packs: [{ grams: 400, label: '400 g' }, { grams: 500, label: '500 g' }] },
  { match: ['bacon'], category: 'Kött & Fisk', displayUnit: 'g',
    packs: [{ grams: 140, label: '140 g' }, { grams: 280, label: '280 g' }] },

  // ── Mejeri ──
  { match: ['mjölk', 'lättmjölk', 'mellanmjölk', 'standardmjölk'], category: 'Mejeri', displayUnit: 'l',
    packs: [{ grams: 1000, label: '1 l' }, { grams: 1500, label: '1,5 l' }] },
  { match: ['vispgrädde', 'matlagningsgrädde', 'grädde'], category: 'Mejeri', displayUnit: 'l',
    packs: [{ grams: 250, label: '2,5 dl' }, { grams: 500, label: '5 dl' }] },
  { match: ['crème fraiche', 'creme fraiche', 'fraiche', 'gräddfil'], category: 'Mejeri', displayUnit: 'g',
    packs: [{ grams: 200, label: '2 dl' }, { grams: 400, label: '4 dl' }] },
  { match: ['yoghurt', 'filmjölk'], category: 'Mejeri', displayUnit: 'l',
    packs: [{ grams: 1000, label: '1 l' }] },
  { match: ['kvarg', 'keso'], category: 'Mejeri', displayUnit: 'g',
    packs: [{ grams: 500, label: '500 g' }] },
  { match: ['smör', 'bregott', 'margarin'], category: 'Mejeri', displayUnit: 'g',
    packs: [{ grams: 250, label: '250 g' }, { grams: 500, label: '500 g' }] },
  { match: ['riven ost', 'ost'], category: 'Mejeri', displayUnit: 'g',
    packs: [{ grams: 150, label: '150 g' }, { grams: 500, label: '500 g' }] },
  { match: ['ägg'], category: 'Mejeri', displayUnit: 'st', gramsPerPiece: 60,
    packs: [{ grams: 360, label: '6 st' }, { grams: 720, label: '12 st' }] },

  // ── Grönt (piece-based, rounded to whole units) ──
  { match: ['gul lök', 'rödlök', 'lök'], category: 'Grönt', displayUnit: 'st', gramsPerPiece: 150, packs: [] },
  { match: ['vitlök'], category: 'Grönt', displayUnit: 'st', gramsPerPiece: 40, packs: [] },
  { match: ['potatis'], category: 'Grönt', displayUnit: 'kg',
    packs: [{ grams: 1000, label: '1 kg' }, { grams: 2000, label: '2 kg' }] },
  { match: ['morot', 'morötter'], category: 'Grönt', displayUnit: 'g',
    packs: [{ grams: 500, label: '500 g' }, { grams: 1000, label: '1 kg' }] },

  // ── Skafferi ──
  { match: ['krossade tomater', 'passerade tomater', 'kokosmjölk'], category: 'Skafferi', displayUnit: 'g',
    packs: [{ grams: 400, label: '1 burk (400 g)' }] },
  { match: ['tomatpuré'], category: 'Skafferi', displayUnit: 'g',
    packs: [{ grams: 140, label: '1 tub (140 g)' }] },
];

// Pre-sort each rule's packs ascending once.
for (const rule of PACKAGE_SIZES) rule.packs.sort((a, b) => a.grams - b.grams);

function findPackageRule(name: string): PackageRule | null {
  const n = name.toLowerCase();
  // Longest matching keyword wins (so "köttfärs" beats a hypothetical "färs").
  let best: PackageRule | null = null;
  let bestLen = 0;
  for (const rule of PACKAGE_SIZES) {
    for (const key of rule.match) {
      if (n.includes(key) && key.length > bestLen) {
        best = rule;
        bestLen = key.length;
      }
    }
  }
  return best;
}

// ─── Rounding ──────────────────────────────────────────────────────────────────

/**
 * Choose packages to cover `need` grams: use the largest pack for the bulk,
 * then the smallest pack that covers the remainder. Always rounds UP.
 */
export function choosePacks(need: number, packs: PackageSize[]): PackageSize[] {
  if (need <= 0 || packs.length === 0) return [];
  const asc = [...packs].sort((a, b) => a.grams - b.grams);
  const largest = asc[asc.length - 1];
  const chosen: PackageSize[] = [];
  let remaining = need;
  while (remaining > largest.grams + 1e-6) {
    chosen.push(largest);
    remaining -= largest.grams;
  }
  if (remaining > 1e-6) {
    const fit = asc.find(p => p.grams >= remaining - 1e-6);
    chosen.push(fit ?? largest);
  }
  return chosen;
}

/** Round a gram amount up to a "nice" increment when no package table applies. */
export function niceCeilGrams(v: number): number {
  if (v <= 0) return 0;
  if (v <= 50) return Math.ceil(v / 10) * 10;
  if (v <= 500) return Math.ceil(v / 50) * 50;
  if (v <= 2000) return Math.ceil(v / 100) * 100;
  return Math.ceil(v / 250) * 250;
}

// ─── Name normalisation ────────────────────────────────────────────────────────

const DESCRIPTOR_WORDS = new Set([
  'färsk', 'färska', 'torr', 'torra', 'fryst', 'frysta', 'kokt', 'kokta',
  'rå', 'råa', 'rökt', 'rökta', 'skalad', 'skalade', 'hackad', 'hackade',
  'skivad', 'skivade', 'finriven', 'riven', 'grovhackad', 'halverad', 'krossad',
  'pressad', 'stor', 'stora', 'liten', 'lilla', 'ekologisk', 'ekologiska',
]);

/** Canonical key for aggregation + matching. Keeps the engine deterministic. */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // strip parentheticals
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !DESCRIPTOR_WORDS.has(w))
    .join(' ')
    .trim() || name.toLowerCase().trim();
}

// ─── Public types ──────────────────────────────────────────────────────────────

export interface PlannedRecipe {
  recipe: Recipe;
  /** Portions the user wants of this recipe (scales ingredient grams). */
  servings: number;
}

export interface ShoppingLineItem {
  key: string;                 // normalized name (aggregation key)
  name: string;                // display name
  category: ShoppingCategory;
  neededGrams: number;         // aggregated across all planned recipes
  pantryGrams: number;         // matched stock available in pantry
  toBuyGrams: number;          // max(0, needed − pantry), before rounding
  boughtGrams: number;         // after package/nice rounding
  leftoverGrams: number;       // boughtGrams − toBuyGrams (surplus from purchase)
  pantryDeltaGrams: number;    // boughtGrams − neededGrams (net change to pantry)
  packs: PackageSize[];        // chosen packages (empty if rounded generically)
  packLabel: string;           // e.g. "1 kg + 0,5 kg" / "2 × 500 g"
  displayQuantity: string;     // e.g. "1,5 kg", "6 st"
  pieceCount?: number;         // for st-based items
  coveredByPantry: boolean;    // toBuyGrams === 0
  pricePerKg?: number;         // only when a real price is known
  estimatedCostSEK?: number;   // only when a real price is known
}

export interface ShoppingGroup {
  category: ShoppingCategory;
  items: ShoppingLineItem[];
}

export interface PantryDeltaItem {
  key: string;
  name: string;
  /** boughtGrams − neededGrams: positive = add to pantry, negative = consumed. */
  deltaGrams: number;
}

export interface ShoppingResult {
  items: ShoppingLineItem[];       // all items (buy + covered), sorted
  groups: ShoppingGroup[];         // items to buy, grouped by category (store order)
  covered: ShoppingLineItem[];     // fully covered by pantry
  pantryDelta: PantryDeltaItem[];  // net stock change per item (bought − needed)
  toBuyCount: number;              // number of items requiring a purchase
  totalCostSEK?: number;           // sum of known costs; undefined if none known
}

// ─── Aggregation ───────────────────────────────────────────────────────────────

interface AggItem {
  key: string;
  name: string;
  grams: number;
  pricePerKgHint?: number; // from recipe ingredient, used only if no pantry/DB price
}

/** Sum the same ingredient across all planned recipes, normalised to grams. */
export function aggregateIngredients(planned: PlannedRecipe[]): AggItem[] {
  const map = new Map<string, AggItem>();
  for (const { recipe, servings } of planned) {
    const scale = servings / Math.max(recipe.servings || 1, 1);
    for (const ing of recipe.ingredients) {
      const grams = ingredientGrams(ing);
      if (grams <= 0) continue;
      const key = normalizeIngredientName(ing.name);
      const existing = map.get(key);
      if (existing) {
        existing.grams += grams * scale;
        if (existing.pricePerKgHint == null && ing.pricePerKg != null) {
          existing.pricePerKgHint = ing.pricePerKg;
        }
      } else {
        map.set(key, {
          key,
          name: ing.name.trim(),
          grams: grams * scale,
          pricePerKgHint: ing.pricePerKg,
        });
      }
    }
  }
  return [...map.values()];
}

/** Resolve a recipe ingredient to grams (amount is pre-normalised; fall back to toGrams). */
function ingredientGrams(ing: RecipeIngredient): number {
  if (ing.amount && ing.amount > 0) return ing.amount;
  const r = toGrams(ing.originalAmount || 1, ing.originalUnit || 'st', ing.name);
  return r.grams ?? 0;
}

// ─── Pantry matching ───────────────────────────────────────────────────────────

interface PantryStock {
  key: string;
  grams: number;
}

function buildPantryStock(pantry: PantryItem[]): PantryStock[] {
  const map = new Map<string, number>();
  for (const item of pantry) {
    let grams: number;
    if (item.unit === 'g') {
      grams = item.amount;
    } else if (item.unitWeightGrams) {
      grams = item.amount * item.unitWeightGrams;
    } else {
      const r = toGrams(item.amount, 'st', item.name);
      grams = r.grams ?? item.amount * 100; // last-resort default
    }
    const key = normalizeIngredientName(item.name);
    map.set(key, (map.get(key) ?? 0) + grams);
  }
  return [...map.entries()].map(([key, grams]) => ({ key, grams }));
}

/** Fuzzy pantry lookup: exact normalized key, else substring either direction. */
function matchPantryGrams(key: string, stock: PantryStock[]): number {
  const exact = stock.find(s => s.key === key);
  if (exact) return exact.grams;
  const partial = stock.find(s => s.key.includes(key) || key.includes(s.key));
  return partial ? partial.grams : 0;
}

// ─── Price hook (uses existing buildPriceLookup) ───────────────────────────────

function resolvePricePerKg(
  name: string,
  priceMap: ReturnType<typeof buildPriceLookup>,
): number | null {
  const lower = name.toLowerCase().trim();
  let entry = priceMap.get(lower);
  if (!entry) {
    for (const [k, v] of priceMap) {
      if (k.includes(lower) || lower.includes(k)) { entry = v; break; }
    }
  }
  if (!entry) return null;
  if (entry.pricePerKg) return entry.pricePerKg;
  if (entry.pricePerUnit && entry.unitWeightGrams) {
    return (entry.pricePerUnit / entry.unitWeightGrams) * 1000;
  }
  return null;
}

// ─── Display helpers ───────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 2 });
}

function formatQuantity(grams: number, rule: PackageRule | null, pieceCount?: number): string {
  const unit = rule?.displayUnit;
  if (unit === 'st' && pieceCount != null) return `${pieceCount} st`;
  if (unit === 'l') {
    return grams >= 1000 ? `${fmtNum(grams / 1000)} l` : `${fmtNum(grams / 100)} dl`;
  }
  if (unit === 'kg' || grams >= 1000) return `${fmtNum(grams / 1000)} kg`;
  return `${Math.round(grams)} g`;
}

function buildPackLabel(packs: PackageSize[]): string {
  if (!packs.length) return '';
  // Compress repeats: "500 g + 500 g" → "2 × 500 g"
  const counts = new Map<string, number>();
  for (const p of packs) counts.set(p.label, (counts.get(p.label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, n]) => (n > 1 ? `${n} × ${label}` : label))
    .join(' + ');
}

// ─── Core: build the shopping list ─────────────────────────────────────────────

export interface ShoppingOptions {
  priceDB?: PriceEntry[];
}

export function buildShoppingList(
  planned: PlannedRecipe[],
  pantry: PantryItem[],
  opts: ShoppingOptions = {},
): ShoppingResult {
  const agg = aggregateIngredients(planned);
  const stock = buildPantryStock(pantry);
  const priceMap = buildPriceLookup(pantry, opts.priceDB ?? []);

  const items: ShoppingLineItem[] = agg.map(a => {
    const neededGrams = a.grams;
    const pantryGrams = matchPantryGrams(a.key, stock);
    const toBuyGrams = Math.max(0, neededGrams - pantryGrams);

    const rule = findPackageRule(a.name);
    const category = rule?.category ?? classifyCategory(a.name);

    // Round the to-buy amount up to logical packages.
    let boughtGrams = 0;
    let packs: PackageSize[] = [];
    let pieceCount: number | undefined;

    if (toBuyGrams > 0) {
      if (rule && rule.packs.length > 0) {
        packs = choosePacks(toBuyGrams, rule.packs);
        boughtGrams = packs.reduce((s, p) => s + p.grams, 0);
        if (rule.gramsPerPiece) pieceCount = Math.round(boughtGrams / rule.gramsPerPiece);
      } else if (rule?.gramsPerPiece) {
        // Piece-based without fixed packs (e.g. lök): round up to whole pieces.
        pieceCount = Math.ceil(toBuyGrams / rule.gramsPerPiece - 1e-6);
        boughtGrams = pieceCount * rule.gramsPerPiece;
      } else {
        boughtGrams = niceCeilGrams(toBuyGrams);
      }
    }

    const leftoverGrams = Math.max(0, boughtGrams - toBuyGrams);
    const pantryDeltaGrams = boughtGrams - neededGrams;

    // Cost hook — only when a real price exists; never fabricated.
    const pricePerKg = resolvePricePerKg(a.name, priceMap) ?? a.pricePerKgHint ?? null;
    const estimatedCostSEK = pricePerKg != null && boughtGrams > 0
      ? (boughtGrams / 1000) * pricePerKg
      : undefined;

    return {
      key: a.key,
      name: a.name,
      category,
      neededGrams: round1(neededGrams),
      pantryGrams: round1(Math.min(pantryGrams, neededGrams)),
      toBuyGrams: round1(toBuyGrams),
      boughtGrams: round1(boughtGrams),
      leftoverGrams: round1(leftoverGrams),
      pantryDeltaGrams: round1(pantryDeltaGrams),
      packs,
      packLabel: buildPackLabel(packs),
      displayQuantity: formatQuantity(boughtGrams || toBuyGrams, rule, pieceCount),
      pieceCount,
      coveredByPantry: toBuyGrams <= 0,
      pricePerKg: pricePerKg ?? undefined,
      estimatedCostSEK,
    };
  });

  // Sort: items to buy first, by category store-order, then name.
  const catIndex = (c: ShoppingCategory) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  items.sort((a, b) => {
    if (a.coveredByPantry !== b.coveredByPantry) return a.coveredByPantry ? 1 : -1;
    if (a.category !== b.category) return catIndex(a.category) - catIndex(b.category);
    return a.name.localeCompare(b.name, 'sv');
  });

  const toBuy = items.filter(i => !i.coveredByPantry);
  const covered = items.filter(i => i.coveredByPantry);

  // Group items-to-buy by category, preserving store order.
  const groups: ShoppingGroup[] = [];
  for (const cat of CATEGORY_ORDER) {
    const catItems = toBuy.filter(i => i.category === cat);
    if (catItems.length) groups.push({ category: cat, items: catItems });
  }

  // pantryDelta — net stock change per item (positive leftovers + consumed stock).
  const pantryDelta: PantryDeltaItem[] = items
    .filter(i => Math.abs(i.pantryDeltaGrams) > 0.5)
    .map(i => ({ key: i.key, name: i.name, deltaGrams: i.pantryDeltaGrams }));

  const knownCosts = toBuy.filter(i => i.estimatedCostSEK != null);
  const totalCostSEK = knownCosts.length
    ? knownCosts.reduce((s, i) => s + (i.estimatedCostSEK ?? 0), 0)
    : undefined;

  return {
    items,
    groups,
    covered,
    pantryDelta,
    toBuyCount: toBuy.length,
    totalCostSEK,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Matlåda: per-portion macros ───────────────────────────────────────────────

export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
}

export interface PortionMacros {
  portions: number;       // number of boxes the batch is divided into
  perPortion: Macros;     // macros in one matlåda
  totalCooked: Macros;    // macros for the whole cooked batch
}

/**
 * Macros per portion (matlåda) — no weighing needed.
 * Cooks `batches` × the recipe (default 1) and divides into `portions` boxes.
 * A stew whose recipe makes 4 servings, cooked once and split into 4 boxes →
 * per-box macros = recipe.nutritionPerServing.
 */
export function macrosPerPortion(
  recipe: Recipe,
  portions: number,
  batches: number = 1,
): PortionMacros {
  const n = recipe.nutritionPerServing ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  const servings = Math.max(recipe.servings || 1, 1);
  const factor = servings * Math.max(batches, 1);
  const total: Macros = {
    kcal: n.kcal * factor,
    protein: n.protein * factor,
    fat: n.fat * factor,
    carbs: n.carbs * factor,
    fiber: n.fiber != null ? n.fiber * factor : undefined,
  };
  const p = Math.max(portions, 1);
  const perPortion: Macros = {
    kcal: Math.round(total.kcal / p),
    protein: Math.round((total.protein / p) * 10) / 10,
    fat: Math.round((total.fat / p) * 10) / 10,
    carbs: Math.round((total.carbs / p) * 10) / 10,
    fiber: total.fiber != null ? Math.round((total.fiber / p) * 10) / 10 : undefined,
  };
  return {
    portions: p,
    perPortion,
    totalCooked: {
      kcal: Math.round(total.kcal),
      protein: Math.round(total.protein * 10) / 10,
      fat: Math.round(total.fat * 10) / 10,
      carbs: Math.round(total.carbs * 10) / 10,
      fiber: total.fiber != null ? Math.round(total.fiber * 10) / 10 : undefined,
    },
  };
}
