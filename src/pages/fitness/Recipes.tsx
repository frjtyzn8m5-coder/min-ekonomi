import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { loadRecipes, saveRecipe, deleteRecipe, loadPantry } from '../../lib/pantryDb';
import { saveFoodEntry } from '../../lib/foodDb';
import { parseIngredientText } from '../../utils/unitConverter';
import { calcRecipeCost } from '../../utils/recipeCost';
import { getLvData, matchToLV, nutritionForGrams, calcRecipeNutrition } from '../../utils/matchNutrition';
import type { Recipe, RecipeIngredient, PantryItem, FoodEntry, FoodItem } from '../../types';
import {
  ChefHat, Plus, Trash2, Link, Loader2, Search, X, ChevronDown, ChevronUp,
  Utensils, Check, Package, RefreshCw, AlertCircle, Shuffle,
} from 'lucide-react';
import { nanoid } from 'nanoid';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCost(v: number | undefined | null): string {
  if (v == null || v === 0) return '–';
  return `${v.toFixed(0)} kr`;
}

function fmt1(n: number): string { return n.toFixed(1); }

// ─── Extend RecipeIngredient with LV match ───────────────────────────────────

interface ResolvedIngredient extends RecipeIngredient {
  lvItem: FoodItem | null;
  nutrition: { kcal: number; protein: number; fat: number; carbs: number; fiber?: number } | null;
}

// ─── URL Import dialog ────────────────────────────────────────────────────────

interface ImportDialogProps {
  onImport: (data: {
    name: string; servings: number; ingredients: string[];
    instructions: string[]; imageUrl?: string; tags: string[]; source: string;
  }) => void;
  onClose: () => void;
}

function ImportDialog({ onImport, onClose }: ImportDialogProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleImport() {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/import-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Importering misslyckades');
      onImport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Link size={18} className="text-green-600" />
            <h2 className="font-semibold text-gray-900">Importera recept från URL</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">Klistra in en länk till ett recept från t.ex. ICA, Arla, Tasteline eller Coop.</p>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="https://www.ica.se/recept/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Avbryt</button>
          <button
            onClick={handleImport}
            disabled={!url.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Importera
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LV swap modal ────────────────────────────────────────────────────────────

interface SwapModalProps {
  ingredientName: string;
  currentMatch: FoodItem | null;
  onSelect: (item: FoodItem) => void;
  onClose: () => void;
}

function SwapModal({ ingredientName, currentMatch, onSelect, onClose }: SwapModalProps) {
  const [query, setQuery] = useState(ingredientName);
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (query.trim().length > 1) search(query); }, [query]);

  async function search(q: string) {
    setLoading(true);
    const data = await getLvData();
    const lq = q.toLowerCase();
    const hits = data
      .filter(i => i.name.toLowerCase().includes(lq))
      .slice(0, 20);
    setResults(hits);
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">Välj matvara</p>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-3 border-b border-gray-50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Sök i Livsmedelsverkets databas…"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-400" /></div>}
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => { onSelect(item); onClose(); }}
              className={`w-full px-4 py-3 text-left border-b border-gray-50 hover:bg-green-50 transition-colors ${currentMatch?.id === item.id ? 'bg-green-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-gray-900">{item.name}</p>
                {currentMatch?.id === item.id && <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" />}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {item.energy_kcal} kcal · P {item.protein}g · F {item.fat}g · K {item.carbs}g
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Ingredient row with detail ───────────────────────────────────────────────

interface IngredientRowProps {
  ing: ResolvedIngredient;
  scale: number;
  costDetail: { rawCost: number | null; found: boolean } | undefined;
  onUpdateGrams: (newGrams: number) => void;
  onSwapMatch: (item: FoodItem) => void;
}

function IngredientRow({ ing, scale, costDetail, onUpdateGrams, onSwapMatch }: IngredientRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSwap, setShowSwap] = useState(false);

  const scaledGrams = Math.round(ing.amount * scale);
  const scaledNutrition = ing.lvItem && scaledGrams > 0
    ? nutritionForGrams(ing.lvItem, scaledGrams)
    : null;

  const hasNutrition = scaledNutrition && scaledNutrition.kcal > 0;

  return (
    <>
      <div className={`border border-gray-100 rounded-xl overflow-hidden ${expanded ? 'ring-1 ring-green-200' : ''}`}>
        {/* Main row */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <span className="text-sm text-gray-700 truncate">{ing.name}</span>
            {!ing.lvItem && (
              <AlertCircle size={13} className="text-amber-400 flex-shrink-0" title="Ingen nutritionsmatchning" />
            )}
            {hasNutrition && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">
                {scaledNutrition!.kcal} kcal
              </span>
            )}
          </button>
          <input
            type="number"
            className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-400"
            value={scaledGrams}
            onChange={e => onUpdateGrams(parseFloat(e.target.value) / Math.max(scale, 0.001))}
          />
          <span className="text-xs text-gray-400 w-4">g</span>
          <button onClick={() => setExpanded(v => !v)} className="text-gray-300 hover:text-gray-500">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="px-3 pb-3 pt-1 bg-gray-50 border-t border-gray-100 space-y-2">
            {/* Original text */}
            <p className="text-[10px] text-gray-400">
              Original: <span className="italic">{ing.originalText}</span>
            </p>

            {/* LV match */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 mb-0.5">Matchad matvara</p>
                {ing.lvItem ? (
                  <p className="text-xs font-medium text-gray-800 truncate">{ing.lvItem.name}</p>
                ) : (
                  <p className="text-xs text-amber-500">Ingen matchning — klicka för att välja</p>
                )}
              </div>
              <button
                onClick={() => setShowSwap(true)}
                className="flex items-center gap-1 text-[11px] text-green-600 hover:text-green-700 font-medium flex-shrink-0"
              >
                <Shuffle size={12} />
                Byt
              </button>
            </div>

            {/* Nutrition for this ingredient */}
            {scaledNutrition && (
              <div className="grid grid-cols-4 gap-1 bg-white rounded-lg px-2 py-1.5">
                {[
                  { label: 'Kcal', val: scaledNutrition.kcal },
                  { label: 'Prot', val: `${fmt1(scaledNutrition.protein)}g` },
                  { label: 'Fett', val: `${fmt1(scaledNutrition.fat)}g` },
                  { label: 'Kolh', val: `${fmt1(scaledNutrition.carbs)}g` },
                ].map(m => (
                  <div key={m.label} className="text-center">
                    <p className="text-[9px] text-gray-400">{m.label}</p>
                    <p className="text-[11px] font-semibold text-gray-700">{m.val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Cost */}
            {costDetail && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400">Kostnad (råkostnad)</span>
                <span className={costDetail.found ? 'text-gray-700 font-medium' : 'text-gray-300'}>
                  {costDetail.found && costDetail.rawCost !== null
                    ? `${costDetail.rawCost.toFixed(1)} kr`
                    : 'Pris okänt'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {showSwap && (
        <SwapModal
          ingredientName={ing.name}
          currentMatch={ing.lvItem}
          onSelect={onSwapMatch}
          onClose={() => setShowSwap(false)}
        />
      )}
    </>
  );
}

// ─── Recipe detail / editor ───────────────────────────────────────────────────

interface RecipeDetailProps {
  recipe: Recipe;
  pantry: PantryItem[];
  onSave: (r: Recipe) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onLog: (r: Recipe, servings: number) => void;
}

function RecipeDetail({ recipe, pantry, onSave, onClose, onDelete, onLog }: RecipeDetailProps) {
  const [servings, setServings] = useState(recipe.servings);
  const [ingredients, setIngredients] = useState<ResolvedIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [logServings, setLogServings] = useState(1);
  const [showIngredients, setShowIngredients] = useState(true);

  const scale = servings / Math.max(recipe.servings, 1);

  // Load LV data and resolve nutrition for each ingredient
  useEffect(() => {
    getLvData().then(lvData => {
      const resolved: ResolvedIngredient[] = recipe.ingredients.map(ing => {
        const lvItem = matchToLV(ing.name, lvData);
        const nutrition = lvItem && ing.amount > 0
          ? nutritionForGrams(lvItem, ing.amount)
          : null;
        return { ...ing, lvItem, nutrition };
      });
      setIngredients(resolved);
      setLoading(false);
    });
  }, [recipe.id]);

  // Cost (pantry only — no priceDB in-memory)
  const cost = calcRecipeCost(ingredients, servings, pantry, []);

  // Computed nutrition from matched ingredients
  const computedNutrition = calcRecipeNutrition(
    ingredients.map(i => ({ grams: i.amount, lvItem: i.lvItem })),
    recipe.servings,
  );

  // Use computed if recipe stored value is 0
  const displayNutrition = recipe.nutritionPerServing.kcal > 0
    ? recipe.nutritionPerServing
    : computedNutrition;

  function updateIngAmount(idx: number, newGrams: number) {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== idx) return ing;
      const nutrition = ing.lvItem && newGrams > 0
        ? nutritionForGrams(ing.lvItem, newGrams)
        : null;
      return { ...ing, amount: newGrams, nutrition };
    }));
  }

  function swapMatch(idx: number, item: FoodItem) {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== idx) return ing;
      const nutrition = ing.amount > 0 ? nutritionForGrams(item, ing.amount) : null;
      return { ...ing, lvItem: item, nutrition };
    }));
  }

  function handleSave() {
    // Recompute nutrition before saving
    const newNutrition = calcRecipeNutrition(
      ingredients.map(i => ({ grams: i.amount, lvItem: i.lvItem })),
      servings,
    );
    const recipeToSave: Recipe = {
      ...recipe,
      servings,
      ingredients: ingredients.map(({ lvItem, nutrition, ...rest }) => rest),
      nutritionPerServing: newNutrition.kcal > 0 ? newNutrition : recipe.nutritionPerServing,
    };
    onSave(recipeToSave);
  }

  const matchedCount = ingredients.filter(i => i.lvItem !== null).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">← Tillbaka</button>
        <div className="flex gap-2">
          <button
            onClick={() => onDelete(recipe.id)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            Spara
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Image */}
        {recipe.imageUrl && (
          <div className="h-48 bg-gray-100">
            <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {/* Name */}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{recipe.name}</h1>
            {recipe.source && (
              <a href={recipe.source} target="_blank" rel="noopener noreferrer"
                className="text-xs text-green-600 hover:underline mt-1 block truncate">
                {recipe.source}
              </a>
            )}
          </div>

          {/* Servings */}
          <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-1 text-gray-500">
              <Utensils size={16} />
              <span className="text-sm">Portioner</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => setServings(s => Math.max(1, s - 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100">
                −
              </button>
              <span className="w-8 text-center font-semibold text-gray-800">{servings}</span>
              <button onClick={() => setServings(s => s + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100">
                +
              </button>
            </div>
          </div>

          {/* Cost summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-600 font-medium">Råkostnad</p>
              <p className="text-lg font-bold text-green-700 mt-1">{formatCost(cost.totalRawSEK)}</p>
              <p className="text-xs text-green-500">{formatCost(cost.perServingRaw)} / portion</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Verklig kostnad</p>
              <p className="text-lg font-bold text-blue-700 mt-1">{formatCost(cost.totalRealSEK)}</p>
              <p className="text-xs text-blue-500">{formatCost(cost.perServingReal)} / portion</p>
            </div>
          </div>

          {/* Nutrition per serving */}
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Näring per portion</p>
              {loading && <Loader2 size={12} className="animate-spin text-gray-400" />}
              {!loading && matchedCount < ingredients.length && (
                <span className="text-[10px] text-amber-500">
                  {matchedCount}/{ingredients.length} ingredienser matchade
                </span>
              )}
              {!loading && matchedCount === ingredients.length && ingredients.length > 0 && (
                <span className="text-[10px] text-green-600">Alla matchade ✓</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Kcal', val: Math.round(displayNutrition.kcal * scale) },
                { label: 'Protein', val: `${fmt1(displayNutrition.protein * scale)}g` },
                { label: 'Kolh', val: `${fmt1(displayNutrition.carbs * scale)}g` },
                { label: 'Fett', val: `${fmt1(displayNutrition.fat * scale)}g` },
              ].map(m => (
                <div key={m.label}>
                  <p className="text-xs text-gray-400">{m.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${m.val === 0 || m.val === '0.0g' ? 'text-gray-300' : 'text-gray-800'}`}>
                    {m.val}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Ingredients with detail */}
          <div>
            <button
              className="flex items-center justify-between w-full mb-2"
              onClick={() => setShowIngredients(v => !v)}
            >
              <h2 className="text-sm font-semibold text-gray-700">
                Ingredienser ({ingredients.length})
              </h2>
              {showIngredients ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>

            {showIngredients && (
              <div className="space-y-1.5">
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  </div>
                ) : (
                  ingredients.map((ing, idx) => (
                    <IngredientRow
                      key={idx}
                      ing={ing}
                      scale={scale}
                      costDetail={cost.details[idx]}
                      onUpdateGrams={grams => updateIngAmount(idx, grams)}
                      onSwapMatch={item => swapMatch(idx, item)}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Instructions */}
          {recipe.instructions.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 w-full"
              >
                Instruktioner
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expanded && (
                <ol className="mt-2 space-y-2 list-decimal list-inside">
                  {recipe.instructions.map((step, i) => (
                    <li key={i} className="text-sm text-gray-600 leading-relaxed">{step}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Log as meal */}
          <div className="bg-orange-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-orange-700 mb-2">Logga som måltid</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setLogServings(s => Math.max(1, s - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600">−</button>
                <span className="w-8 text-center text-sm font-semibold">{logServings}</span>
                <button onClick={() => setLogServings(s => s + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600">+</button>
              </div>
              <span className="text-sm text-orange-600">portioner</span>
              <button
                onClick={() => onLog(recipe, logServings)}
                className="ml-auto px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"
              >
                Logga
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Recipes page ────────────────────────────────────────────────────────

export default function Recipes() {
  const { user } = useAuthStore();
  const { nutritionSettings, setFitnessPage } = useStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [logSuccess, setLogSuccess] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([loadRecipes(user.uid), loadPantry(user.uid)])
      .then(([r, p]) => { setRecipes(r); setPantry(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  async function resolveIngredients(rawIngredients: string[]): Promise<RecipeIngredient[]> {
    const lvData = await getLvData();
    return rawIngredients.map(text => {
      const parsed = parseIngredientText(text);
      const lvItem = matchToLV(parsed.name, lvData);
      const nutrition = lvItem && parsed.grams && parsed.grams > 0
        ? nutritionForGrams(lvItem, parsed.grams)
        : undefined;
      return {
        name: parsed.name,
        originalText: text,
        amount: parsed.grams ?? 0,
        originalAmount: parsed.amount,
        originalUnit: parsed.unit,
        foodId: lvItem?.id,
        nutrition: nutrition ?? undefined,
      };
    });
  }

  async function handleImport(data: {
    name: string; servings: number; ingredients: string[];
    instructions: string[]; imageUrl?: string; tags: string[]; source: string;
  }) {
    if (!user) return;
    const ingredients = await resolveIngredients(data.ingredients);

    // Compute nutrition from matched ingredients
    const lvData = await getLvData();
    const nutritionInputs = ingredients.map(ing => ({
      grams: ing.amount,
      lvItem: ing.foodId ? lvData.find(i => i.id === ing.foodId) ?? null : null,
    }));
    const nutritionPerServing = calcRecipeNutrition(nutritionInputs, data.servings);

    const recipe: Recipe = {
      id: nanoid(),
      name: data.name,
      servings: data.servings,
      ingredients,
      instructions: data.instructions,
      tags: data.tags,
      nutritionPerServing,
      imageUrl: data.imageUrl,
      source: data.source,
      createdAt: Date.now(),
    };

    await saveRecipe(user.uid, recipe);
    setRecipes(prev => [recipe, ...prev]);
    setShowImport(false);
    setSelected(recipe);
  }

  async function handleSave(r: Recipe) {
    if (!user) return;
    await saveRecipe(user.uid, r);
    setRecipes(prev => prev.map(x => x.id === r.id ? r : x));
    setSelected(null);
  }

  async function handleDelete(id: string) {
    if (!user) return;
    await deleteRecipe(user.uid, id);
    setRecipes(prev => prev.filter(r => r.id !== id));
    setSelected(null);
  }

  async function handleLog(recipe: Recipe, servings: number) {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const scale = servings / Math.max(recipe.servings, 1);
    const n = recipe.nutritionPerServing;
    const entry: FoodEntry = {
      id: nanoid(),
      date: today,
      mealType: 'dinner',
      foodId: `recipe_${recipe.id}`,
      foodName: `${recipe.name} (${servings} port.)`,
      amount: servings * 300,
      nutrition: {
        kcal:    Math.round(n.kcal * scale * servings),
        protein: Math.round(n.protein * scale * servings * 10) / 10,
        fat:     Math.round(n.fat * scale * servings * 10) / 10,
        carbs:   Math.round(n.carbs * scale * servings * 10) / 10,
      },
      source: 'custom',
      timestamp: Date.now(),
    };
    await saveFoodEntry(user.uid, entry);
    setSelected(null);
    setLogSuccess(`${recipe.name} loggad!`);
    setTimeout(() => setLogSuccess(''), 2500);
  }

  const filtered = recipes.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.tags.some(t => t.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ChefHat size={20} className="text-green-600" />
              <h1 className="text-lg font-bold text-gray-900">Recept</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium"
              >
                <Link size={15} />
                Importera
              </button>
              <button
                onClick={() => setFitnessPage('pantry')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-medium"
              >
                <Package size={15} />
                Skafferi
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
              placeholder="Sök recept…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {logSuccess && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg z-50 flex items-center gap-2">
            <Check size={14} />
            {logSuccess}
          </div>
        )}

        {loading && <div className="text-center py-16 text-gray-400 text-sm">Laddar recept…</div>}

        {!loading && recipes.length === 0 && (
          <div className="text-center py-16">
            <ChefHat size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Inga recept sparade</p>
            <p className="text-gray-400 text-sm mt-1">Importera ett recept från ICA, Arla eller Tasteline</p>
            <button
              onClick={() => setShowImport(true)}
              className="mt-4 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700"
            >
              Importera recept
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {filtered.map(recipe => {
            const cost = calcRecipeCost(recipe.ingredients, recipe.servings, pantry, []);
            return (
              <button
                key={recipe.id}
                onClick={() => setSelected(recipe)}
                className="text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                {recipe.imageUrl && (
                  <div className="h-36 bg-gray-100">
                    <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Utensils size={12} />
                      {recipe.servings} port.
                    </span>
                    {recipe.nutritionPerServing.kcal > 0 && (
                      <span>{recipe.nutritionPerServing.kcal} kcal/port.</span>
                    )}
                    {cost.totalRawSEK > 0 && (
                      <span className="text-green-600 font-medium">
                        ~{cost.perServingRaw.toFixed(0)} kr/port.
                      </span>
                    )}
                  </div>
                  {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {recipe.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showImport && (
        <ImportDialog onImport={handleImport} onClose={() => setShowImport(false)} />
      )}

      {selected && (
        <RecipeDetail
          recipe={selected}
          pantry={pantry}
          onSave={r => { handleSave(r); setSelected(null); }}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onLog={handleLog}
        />
      )}
    </div>
  );
}
