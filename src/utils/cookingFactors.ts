// ── Cooking factors: raw ↔ cooked weight + water-injection adjustment ─────────
// Product/recipe nutrition is usually given per 100 g RAW, but people weigh food
// COOKED — and cooking changes weight (meat loses water, rice/pasta absorb it), so
// per-100g macros shift. Cheap frozen meat is also often injected with brine/water,
// which dilutes protein per 100 g. These deterministic helpers make macro logging
// honest. All factors are practical averages — label them as estimates in the UI.

export type CookMethod = 'raw' | 'cooked';

export interface YieldInfo {
  key: string;
  label: string;            // Swedish
  /** cooked weight ÷ raw weight. <1 = loses water (meat), >1 = absorbs water (rice/pasta). */
  cookedPerRaw: number;
  note?: string;
}

// Yield factors (cooked ÷ raw). Sources: USDA retention/yield tables + common
// Swedish practice. Meats ~0.65–0.75; grains/legumes swell 2.2–3×; veg ~0.85–0.9.
export const YIELD_FACTORS: YieldInfo[] = [
  { key: 'chicken_breast', label: 'Kycklingfilé', cookedPerRaw: 0.70, note: 'Tappar ~30 % vatten' },
  { key: 'chicken_thigh',  label: 'Kycklinglårfilé', cookedPerRaw: 0.73 },
  { key: 'beef_mince',     label: 'Nötfärs', cookedPerRaw: 0.70, note: 'Fett + vatten rinner av' },
  { key: 'mixed_mince',    label: 'Blandfärs', cookedPerRaw: 0.68 },
  { key: 'pork',           label: 'Fläskkött', cookedPerRaw: 0.72 },
  { key: 'beef_steak',     label: 'Nötkött (stek/biff)', cookedPerRaw: 0.73 },
  { key: 'salmon',         label: 'Lax', cookedPerRaw: 0.80 },
  { key: 'white_fish',     label: 'Vit fisk (torsk m.m.)', cookedPerRaw: 0.78 },
  { key: 'bacon',          label: 'Bacon', cookedPerRaw: 0.45, note: 'Mycket fett steks bort' },
  { key: 'rice',           label: 'Ris (torrt → kokt)', cookedPerRaw: 2.8, note: 'Suger vatten' },
  { key: 'pasta',          label: 'Pasta (torr → kokt)', cookedPerRaw: 2.4 },
  { key: 'lentils',        label: 'Linser (torra → kokta)', cookedPerRaw: 2.5 },
  { key: 'dried_beans',    label: 'Bönor (torra → kokta)', cookedPerRaw: 2.5 },
  { key: 'quinoa',         label: 'Quinoa (torr → kokt)', cookedPerRaw: 2.7 },
  { key: 'potato_boiled',  label: 'Potatis (kokt)', cookedPerRaw: 0.97 },
  { key: 'vegetables',     label: 'Grönsaker (kokta/stekta)', cookedPerRaw: 0.88 },
  { key: 'spinach',        label: 'Spenat (nedkokt)', cookedPerRaw: 0.25, note: 'Kollapsar kraftigt' },
];

const YIELD_MAP: Record<string, YieldInfo> = Object.fromEntries(YIELD_FACTORS.map(y => [y.key, y]));

export function yieldFor(key: string): YieldInfo | undefined {
  return YIELD_MAP[key];
}

/** Convert a raw weight to its cooked weight for a given food. */
export function rawToCooked(rawGrams: number, key: string): number {
  const y = YIELD_MAP[key];
  return y ? rawGrams * y.cookedPerRaw : rawGrams;
}

/** Convert a cooked weight back to the equivalent raw weight (for raw-basis nutrition). */
export function cookedToRaw(cookedGrams: number, key: string): number {
  const y = YIELD_MAP[key];
  return y && y.cookedPerRaw > 0 ? cookedGrams / y.cookedPerRaw : cookedGrams;
}

export interface Macros { kcal: number; protein: number; fat: number; carbs: number; fiber?: number }

/**
 * Convert per-100g RAW nutrition to per-100g COOKED (nutrients stay, weight changes).
 * cookedPer100gRaw = rawValue / cookedPerRaw. For meat (<1) this concentrates macros;
 * for rice/pasta (>1) it dilutes them. Fiber handled if present.
 */
export function cookedNutritionPer100g(rawPer100g: Macros, key: string): Macros {
  const y = YIELD_MAP[key];
  if (!y || y.cookedPerRaw <= 0) return rawPer100g;
  const f = 1 / y.cookedPerRaw;
  return scaleMacros(rawPer100g, f);
}

/**
 * Adjust labelled per-100g nutrition for added/injected water (common in cheap frozen
 * chicken, e.g. "köttinnehåll 80 %"). The label already reflects the diluted product,
 * so if you instead want the PURE-meat basis (per 100 g of actual meat), divide by the
 * meat fraction. Pass meatPercent as 0–100 (e.g. 80). Returns nutrition per 100 g of
 * the injected product given pure-meat values, or vice-versa with `toProduct=false`.
 */
export function adjustForAddedWater(
  per100g: Macros,
  meatPercent: number,
  toProduct = true,
): Macros {
  const frac = Math.min(1, Math.max(0.1, meatPercent / 100));
  // toProduct: pure-meat values → diluted product values (×frac).
  // else: product label → pure-meat basis (÷frac).
  return scaleMacros(per100g, toProduct ? frac : 1 / frac);
}

function scaleMacros(m: Macros, f: number): Macros {
  return {
    kcal: Math.round(m.kcal * f),
    protein: round1(m.protein * f),
    fat: round1(m.fat * f),
    carbs: round1(m.carbs * f),
    ...(m.fiber != null ? { fiber: round1(m.fiber * f) } : {}),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Heuristic: guess a yield key from a free-text food name (Swedish). */
export function guessYieldKey(name: string): string | undefined {
  const n = name.toLowerCase();
  if (/kycklingfil|kycklingbröst/.test(n)) return 'chicken_breast';
  if (/kycklinglår|lårfil/.test(n)) return 'chicken_thigh';
  if (/nötfärs/.test(n)) return 'beef_mince';
  if (/blandfärs|köttfärs|fläskfärs/.test(n)) return 'mixed_mince';
  if (/bacon/.test(n)) return 'bacon';
  if (/fläsk|kotlett|karré/.test(n)) return 'pork';
  if (/\bbiff\b|entrecote|ryggbiff|oxfilé|nötkött/.test(n)) return 'beef_steak';
  if (/\blax\b/.test(n)) return 'salmon';
  if (/torsk|sej|vit fisk|fiskfilé/.test(n)) return 'white_fish';
  if (/\bris\b|jasminris|basmati/.test(n)) return 'rice';
  if (/pasta|spaghetti|makaron|penne/.test(n)) return 'pasta';
  if (/\blinser\b/.test(n)) return 'lentils';
  if (/\bbönor\b/.test(n)) return 'dried_beans';
  if (/quinoa/.test(n)) return 'quinoa';
  if (/potatis/.test(n)) return 'potato_boiled';
  if (/spenat/.test(n)) return 'spinach';
  return undefined;
}
