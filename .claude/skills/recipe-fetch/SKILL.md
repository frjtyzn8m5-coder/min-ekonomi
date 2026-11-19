---
name: recipe-fetch
description: Fetch real Swedish recipes (ICA, Köket, Arla, Coop, Tasteline …) and turn them into Vardagshub library recipes. Use when the user wants to grow the recipe library, import a recipe URL, or pull in many recipes at scale.
---

# Recipe fetch → Vardagshub library

Turn real recipe webpages into entries for `app/src/data/recipes.json`, matching
the app's `Recipe` type so the shopping engine, meal planner, scaling and nutrition
all work. The app ALREADY has a parser (`app/api/import-recipe.ts`) that extracts
schema.org Recipe JSON-LD — reuse that logic; don't reinvent it.

## When to use
- "Fyll på receptbiblioteket", "importera recept från ICA", "hämta 200 recept".
- A single recipe URL the user pasted.
- Bulk-growing the library toward thousands of recipes.

## The data contract (match EXACTLY)

Each library recipe is a `Recipe` (`app/src/types/index.ts`) plus a `category` field:

```json
{
  "id": "lib-<nnn>-<slug>",
  "name": "Köttfärssås med spaghetti",
  "servings": 4,
  "prepTime": 30,
  "category": "Middag",            // Frukost | Middag | Soppa | Sallad | Bakning | Efterrätt | Mellanmål
  "ingredients": [
    { "name": "köttfärs", "originalText": "500 g köttfärs", "amount": 500, "originalAmount": 500, "originalUnit": "g" }
  ],
  "instructions": ["Fräs löken …", "…"],
  "tags": ["snabb", "barnvänlig"],
  "nutritionPerServing": { "kcal": 620, "protein": 38, "fat": 28, "carbs": 55, "fiber": 6 },
  "source": "https://www.ica.se/recept/...",
  "createdAt": 0
}
```

Hard rules:
- `ingredients[].amount` is in **grams** (normalized). Convert dl/msk/tsk/st to grams
  (see the app's unit normalizer in `app/src/utils/shoppingEngine.ts` — `PACKAGE_SIZES`
  and the density/weight assumptions). Keep `originalAmount`/`originalUnit` as written.
- Ingredient `name` MUST use the same canonical keywords the shopping engine knows
  (`köttfärs`, `gul lök`, `vitlök`, `krossade tomater`, `pasta`, `jasminris`, `riven ost`,
  …) so aggregation + pricing work. Lowercase, singular, no brand.
- Stable unique `id`: `lib-<zero-padded index>-<kebab-slug-of-name>`. Never collide with
  existing ids in `recipes.json`.
- `createdAt: 0` for bundled recipes (stable; the app stamps real dates on user copies).

## Workflow

1. **Find URLs.** Use WebSearch / WebFetch to collect recipe URLs from Swedish sources.
   **Source reliability (measured 2026-11-19):** `arla.se/recept` is the most reliable —
   serves clean schema.org Recipe JSON-LD WITH per-portion nutrition (kcal/protein/fat/
   carbs/fiber), so prefer it and lean on it for bulk. Known-bad at that time: `ica.se`
   returned HTTP 403 (bot-blocked), `godare.se` 410, `coop.se` listing had no harvestable
   links, and guessed `koket.se`/`tasteline.com` URLs 404'd (find real URLs via search
   first, don't guess slugs). Re-probe these each run — blocks change. Also worth trying:
   `recept.se`, `mittkok.expressen.se`, `koket.se` (via search), `zeta.nu`, `santamaria.se`.
   For bulk, page through category/listing pages and collect individual recipe links.
   Log how many you collected and from where.
2. **Extract per URL.** WebFetch the page and pull the schema.org `Recipe` JSON-LD
   (`<script type="application/ld+json">`, possibly inside `@graph`). Mirror
   `app/api/import-recipe.ts`: read `name`, `recipeYield` (servings), `totalTime`/
   `prepTime` (ISO-8601 duration → minutes), `recipeIngredient[]`, `recipeInstructions`
   (string | HowToStep[] | HowToSection → flat string[]), `keywords`/`recipeCategory`
   (tags), `image`.
3. **Normalize ingredients** to grams + canonical names (step rules above). Drop
   non-food lines ("salt och peppar efter smak" → keep as 0 g or skip).
4. **Nutrition.** Prefer the page's `nutrition.calories`/protein/fat/carbs when present.
   Otherwise compute `nutritionPerServing` from a curated per-100g table (align values
   with Livsmedelsverket; use DRY weights for rice/pasta/lentils). Never ship kcal=0 —
   if you can't estimate, skip the recipe. Sanity-check: 150–1100 kcal/portion.
5. **Classify** `category` from the dish/keywords.
6. **Append** validated entries to `app/src/data/recipes.json` (keep it valid JSON, a
   flat array, ids unique and contiguous). For large batches, add in chunks and keep the
   file parseable after each chunk.
7. **Report** counts: added, skipped (and why), category spread, source spread, and any
   recipes with estimated (vs. page-provided) nutrition.

## Scaling & diet (runtime, already coded)
Portion + diet scaling happens at runtime via `app/src/utils/scaleRecipe.ts`
(`scaleRecipe`, `applyDiet`, `prepareRecipe`). You do NOT need to pre-scale — author
each recipe at its natural `servings`; the app scales to the user's chosen portions and
diet on demand. Just make sure ingredient `name`s hit the substitution tables there
(e.g. "köttfärs", "mjölk", "grädde", "pasta", "ost", "ägg") so diet swaps work.

## Legal / scope
Store facts only — ingredient lists, quantities, nutrition, short paraphrased steps and
the `source` URL. Do not copy long creative recipe prose verbatim. This is draft data;
it must be reviewed by a person before shipping.

## Verify
After editing `recipes.json`, do NOT build here — tell the main session so it can run
`npx tsc -b` + `npm run build` once. Confirm the JSON parses (no trailing commas) and
ids are unique.
