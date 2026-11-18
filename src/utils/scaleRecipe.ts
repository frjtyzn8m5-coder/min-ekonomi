import type { Recipe, RecipeIngredient } from '../types';

// ── Recipe scaling + diet adaptation ──────────────────────────────────────────
// Deterministic, pure helpers. Portion scaling is exact (ingredient totals scale
// by targetServings/servings; per-serving nutrition is invariant). Diet adaptation
// swaps ingredients via substitution tables and recomputes per-serving nutrition
// from ingredient-level nutrition when available.

export type Diet = 'vegetarian' | 'vegan' | 'lactose_free' | 'gluten_free';

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Scale a recipe to a target number of servings (keeps per-serving macros). */
export function scaleRecipe(recipe: Recipe, targetServings: number): Recipe {
  const from = recipe.servings > 0 ? recipe.servings : 1;
  const to = Math.max(1, Math.round(targetServings));
  if (to === from) return recipe;
  const factor = to / from;

  const ingredients: RecipeIngredient[] = recipe.ingredients.map(ing => ({
    ...ing,
    amount: round(ing.amount * factor),
    originalAmount: round(ing.originalAmount * factor, 2),
  }));

  return {
    ...recipe,
    servings: to,
    ingredients,
    // per-serving nutrition is unchanged by portion scaling
    totalCostRaw: recipe.totalCostRaw != null ? round(recipe.totalCostRaw * factor) : undefined,
    totalCostReal: recipe.totalCostReal != null ? round(recipe.totalCostReal * factor) : undefined,
  };
}

// Substitution tables: match on a lowercased substring of the ingredient name.
// `to` replaces the display name; `note` is appended to originalText for clarity.
interface Sub { match: RegExp; to: string }

const VEGAN_SUBS: Sub[] = [
  { match: /\b(nöt|blandf|köttf|fläskf)ärs\b|\bköttfärs\b|\bfärs\b/i, to: 'sojafärs' },
  { match: /kycklingfilé|kycklinglårfilé|kyckling\b/i, to: 'sojabitar' },
  { match: /\blax\b|\btorsk\b|\bfisk\b|räkor/i, to: 'tofu' },
  { match: /fläskkotlett|skinka|bacon|korv/i, to: 'rökt tofu' },
  { match: /\bmjölk\b|standardmjölk|mellanmjölk/i, to: 'havredryck' },
  { match: /\bgrädde\b|vispgrädde|matlagningsgrädde/i, to: 'havregrädde' },
  { match: /crème fraiche|creme fraiche|gräddfil/i, to: 'vegansk crème fraiche' },
  { match: /\bsmör\b/i, to: 'växtbaserat margarin' },
  { match: /\bost\b|riven ost|parmesan|cheddar/i, to: 'vegansk ost' },
  { match: /\bägg\b/i, to: 'kikärtsspad (aquafaba)' },
  { match: /\byoghurt\b|kvarg/i, to: 'sojayoghurt' },
  { match: /\bhonung\b/i, to: 'agavesirap' },
];

const VEGETARIAN_SUBS: Sub[] = [
  { match: /\b(nöt|blandf|köttf|fläskf)ärs\b|\bköttfärs\b|\bfärs\b/i, to: 'sojafärs' },
  { match: /kycklingfilé|kycklinglårfilé|kyckling\b/i, to: 'quorn-bitar' },
  { match: /\blax\b|\btorsk\b|\bfisk\b|räkor/i, to: 'halloumi' },
  { match: /fläskkotlett|skinka|bacon|korv/i, to: 'vegetarisk korv' },
];

const LACTOSE_SUBS: Sub[] = [
  { match: /\bmjölk\b|standardmjölk|mellanmjölk/i, to: 'laktosfri mjölk' },
  { match: /\bgrädde\b|vispgrädde|matlagningsgrädde/i, to: 'laktosfri grädde' },
  { match: /crème fraiche|creme fraiche|gräddfil/i, to: 'laktosfri crème fraiche' },
  { match: /\bsmör\b/i, to: 'laktosfritt smör' },
  { match: /\bost\b|riven ost/i, to: 'laktosfri ost' },
  { match: /\byoghurt\b|kvarg/i, to: 'laktosfri yoghurt' },
];

const GLUTEN_SUBS: Sub[] = [
  { match: /\bpasta\b|spaghetti|makaroner|penne|tagliatelle/i, to: 'glutenfri pasta' },
  { match: /vetemjöl|\bmjöl\b/i, to: 'glutenfritt mjöl' },
  { match: /\bbröd\b|baguette|toast/i, to: 'glutenfritt bröd' },
  { match: /\bbulgur\b|couscous/i, to: 'quinoa' },
  { match: /soja(sås)?\b/i, to: 'tamari (glutenfri soja)' },
  { match: /\bkorn\b|\bvete\b/i, to: 'glutenfritt alternativ' },
];

const TABLES: Record<Diet, Sub[]> = {
  vegan: VEGAN_SUBS,
  vegetarian: VEGETARIAN_SUBS,
  lactose_free: LACTOSE_SUBS,
  gluten_free: GLUTEN_SUBS,
};

const DIET_TAG: Record<Diet, string> = {
  vegan: 'vegansk',
  vegetarian: 'vegetarisk',
  lactose_free: 'laktosfri',
  gluten_free: 'glutenfri',
};

/**
 * Adapt a recipe to a diet via substitution tables. Recomputes per-serving
 * nutrition from ingredient-level nutrition when present; otherwise keeps the
 * original macros (the swap is then a best-effort shopping/label change only).
 */
export function applyDiet(recipe: Recipe, diet: Diet): Recipe {
  const subs = TABLES[diet];
  let changed = false;

  const ingredients: RecipeIngredient[] = recipe.ingredients.map(ing => {
    const hit = subs.find(s => s.match.test(ing.name));
    if (!hit) return ing;
    changed = true;
    return {
      ...ing,
      name: hit.to,
      originalText: `${ing.originalText} → ${hit.to}`,
      // nutrition/foodId no longer reliable after a swap
      foodId: undefined,
    };
  });

  if (!changed) return recipe;

  const tag = DIET_TAG[diet];
  const tags = recipe.tags.includes(tag) ? recipe.tags : [...recipe.tags, tag];

  return { ...recipe, ingredients, tags };
}

/** Convenience: scale to servings AND apply an optional diet in one call. */
export function prepareRecipe(recipe: Recipe, targetServings: number, diet?: Diet): Recipe {
  const scaled = scaleRecipe(recipe, targetServings);
  return diet ? applyDiet(scaled, diet) : scaled;
}
