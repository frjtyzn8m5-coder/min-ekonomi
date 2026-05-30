import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { loadRecipes, saveRecipe, deleteRecipe, loadPantry, loadPriceDB, adjustPantryStock } from '../../lib/pantryDb';
import { saveFoodEntry } from '../../lib/foodDb';
import { parseIngredientText } from '../../utils/unitConverter';
import { calcRecipeCost } from '../../utils/recipeCost';
import { getLvData, matchToLV, nutritionForGrams, calcRecipeNutrition } from '../../utils/matchNutrition';
import type { Recipe, RecipeIngredient, PantryItem, PriceEntry, FoodEntry, FoodItem } from '../../types';
import {
  ChefHat, Plus, Trash2, Link, Loader2, Search, X, ChevronDown, ChevronUp,
  Utensils, Check, Package, RefreshCw, AlertCircle, Shuffle, ArrowLeft,
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
  nutrition: { kcal: number; protein: number; fat: number; carbs: number; fiber?: number } | undefined;
}

// ─── URL Import dialog ────────────────────────────────────────────────────────

interface ImportDialogProps {
  onImport: (data: {
    name: string; servings: number; ingredients: string[];
    instructions: string[]; imageUrl?: string; tags: string[]; source: string;
  }) => Promise<void>;
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
      await onImport(data);
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
              <span title="Ingen nutritionsmatchning"><AlertCircle size={13} className="text-amber-400 flex-shrink-0" /></span>
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
  priceDB: PriceEntry[];
  onSave: (r: Recipe) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onLog: (r: Recipe, servings: number) => void;
}

function RecipeDetail({ recipe, pantry, priceDB, onSave, onClose, onDelete, onLog }: RecipeDetailProps) {
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
          : undefined;
        return { ...ing, lvItem, nutrition };
      });
      setIngredients(resolved);
      setLoading(false);
    });
  }, [recipe.id]);

  const cost = calcRecipeCost(ingredients, servings, pantry, priceDB);

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
        : undefined;
      return { ...ing, amount: newGrams, nutrition };
    }));
  }

  function swapMatch(idx: number, item: FoodItem) {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== idx) return ing;
      const nutrition = ing.amount > 0 ? nutritionForGrams(item, ing.amount) : undefined;
      return { ...ing, lvItem: item, nutrition };
    }));
  }

  function handleSave() {
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
  const pricedCount = cost.details.filter(d => !d.isSpice && d.rawCost !== null).length;
  const totalPriceable = cost.details.filter(d => !d.isSpice).length;
  const hasAnyPrice = cost.totalRawSEK > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft size={16} />
          Tillbaka
        </button>
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
          <div className="h-48 bg-gray-100 flex-shrink-0">
            <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
          {/* Name + source */}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{recipe.name}</h1>
            {recipe.source && (
              <a
                href={recipe.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 hover:underline mt-1 block truncate"
              >
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
              <button
                onClick={() => setServings(s => Math.max(1, s - 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
              >
                −
              </button>
              <span className="w-8 text-center font-semibold text-gray-800">{servings}</span>
              <button
                onClick={() => setServings(s => s + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>

          {/* Cost summary */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-green-600 font-medium">Råkostnad</p>
                <p className="text-lg font-bold text-green-700 mt-1">
                  {hasAnyPrice ? formatCost(cost.totalRawSEK) : '–'}
                </p>
                <p className="text-xs text-green-500">
                  {hasAnyPrice ? `${formatCost(cost.perServingRaw)} / portion` : 'Lägg till priser i skafferiet'}
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-600 font-medium">Verklig kostnad</p>
                <p className="text-lg font-bold text-blue-700 mt-1">
                  {hasAnyPrice ? formatCost(cost.totalRealSEK) : '–'}
                </p>
                <p className="text-xs text-blue-500">
                  {hasAnyPrice ? `${formatCost(cost.perServingReal)} / portion` : 'Skanna kvitto för priser'}
                </p>
              </div>
            </div>
            {totalPriceable > 0 && (
              <p className="text-[11px] text-center text-gray-400">
                {pricedCount === totalPriceable
                  ? `✓ Alla ${totalPriceable} ingredienser prissatta`
                  : `${pricedCount}/${totalPriceable} ingredienser med känt pris — ${totalPriceable - pricedCount} saknas`}
              </p>
            )}
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
                { label: 'Protein', val: `${fmt1((displayNutrition.protein ?? 0) * scale)}g` },
                { label: 'Fett', val: `${fmt1((displayNutrition.fat ?? 0) * scale)}g` },
                { label: 'Kolhydr', val: `${fmt1((displayNutrition.carbs ?? 0) * scale)}g` },
              ].map(m => (
                <div key={m.label} className="bg-gray-50 rounded-lg py-2">
                  <p className="text-[10px] text-gray-400">{m.label}</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{m.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ingredient list */}
          <div>
            <button
              onClick={() => setShowIngredients(v => !v)}
              className="flex items-center justify-between w-full py-1 mb-2"
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Ingredienser ({ingredients.length})
              </p>
              {showIngredients ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>

            {showIngredients && (
              <div className="space-y-2">
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  </div>
                ) : (
                  ingredients.map((ing, idx) => {
                    const detail = cost.details.find(d => d.name === ing.name);
                    return (
                      <IngredientRow
                        key={idx}
                        ing={ing}
                        scale={scale}
                        costDetail={detail ? { rawCost: detail.rawCost, found: detail.found } : undefined}
                        onUpdateGrams={g => updateIngAmount(idx, g)}
                        onSwapMatch={item => swapMatch(idx, item)}
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Instructions */}
          {recipe.instructions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Instruktioner</p>
              <ol className="space-y-3">
                {recipe.instructions.map((step, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Log section */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Logga måltid</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Portioner:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLogServings(s => Math.max(1, s - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-gray-800">{logServings}</span>
                <button
                  onClick={() => setLogServings(s => s + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-gray-400 ml-auto">
                ≈ {Math.round(displayNutrition.kcal * (logServings / Math.max(recipe.servings, 1)))} kcal
              </span>
            </div>
            <button
              onClick={() => onLog(recipe, logServings)}
              className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <Utensils size={15} />
              Logga {logServings} portion{logServings !== 1 ? 'er' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Recipes page ────────────────────────────────────────────────────────

export default function Recipes() {
  const { user } = useAuthStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [priceDB, setPriceDB] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [logSuccess, setLogSuccess] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      loadRecipes(user.uid),
      loadPantry(user.uid),
      loadPriceDB(user.uid),
    ]).then(([r, p, db]) => {
      setRecipes(r);
      setPantry(p);
      setPriceDB(db);
      setLoading(false);
    });
  }, [user]);

  async function handleImport(data: {
    name: string;
    servings: number;
    ingredients: string[];
    instructions: string[];
    imageUrl?: string;
    tags: string[];
    source: string;
  }) {
    if (!user) return;

    // Parse each ingredient string into a RecipeIngredient
    const lvData = await getLvData();
    const parsedIngredients: RecipeIngredient[] = await Promise.all(
      data.ingredients.map(async (text) => {
        // parseIngredientText returns ParsedIngredient; map to RecipeIngredient
        const pi = parseIngredientText(text);
        const ing: RecipeIngredient = {
          name: pi.name || text,
          originalText: text,
          amount: pi.grams ?? (pi.amount * 100), // grams (normalized)
          originalAmount: pi.amount,
          originalUnit: pi.unit,
        };
        return ing;
      })
    );

    // Compute nutrition from matched LV items
    const nutrition = calcRecipeNutrition(
      parsedIngredients.map(i => ({
        grams: i.amount,
        lvItem: matchToLV(i.name, lvData),
      })),
      data.servings,
    );

    const recipe: Recipe = {
      id: nanoid(),
      name: data.name,
      servings: data.servings,
      ingredients: parsedIngredients,
      instructions: data.instructions,
      tags: data.tags,
      nutritionPerServing: nutrition,
      imageUrl: data.imageUrl,
      source: data.source,
      createdAt: Date.now(),
    };

    await saveRecipe(user.uid, recipe);
    setRecipes(prev => [recipe, ...prev]);
    setShowImport(false);
  }

  async function handleSave(r: Recipe) {
    if (!user) return;
    await saveRecipe(user.uid, r);
    setRecipes(prev => prev.map(x => x.id === r.id ? r : x));
    setSelected(r);
  }

  async function handleDelete(id: string) {
    if (!user) return;
    await deleteRecipe(user.uid, id);
    setRecipes(prev => prev.filter(x => x.id !== id));
    setSelected(null);
  }

  async function handleLog(recipe: Recipe, servings: number) {
    if (!user) return;
    const scale = servings / Math.max(recipe.servings, 1);
    const totalGrams = recipe.ingredients.reduce((sum, i) => sum + i.amount, 0) * scale;

    const entry: FoodEntry = {
      id: nanoid(),
      date: new Date().toISOString().slice(0, 10),
      mealType: 'dinner',
      foodId: recipe.id,
      foodName: recipe.name,
      amount: Math.round(totalGrams),
      nutrition: {
        kcal: Math.round(recipe.nutritionPerServing.kcal * scale),
        protein: Math.round(recipe.nutritionPerServing.protein * scale * 10) / 10,
        fat: Math.round(recipe.nutritionPerServing.fat * scale * 10) / 10,
        carbs: Math.round(recipe.nutritionPerServing.carbs * scale * 10) / 10,
        fiber: recipe.nutritionPerServing.fiber != null
          ? Math.round(recipe.nutritionPerServing.fiber * scale * 10) / 10
          : undefined,
      },
      source: 'custom',
      timestamp: Date.now(),
    };

    await saveFoodEntry(user.uid, entry);

    // Deduct ingredients from pantry (fuzzy name match)
    if (pantry.length > 0) {
      const updatedPantry = [...pantry];
      for (const ing of recipe.ingredients) {
        const neededGrams = ing.amount * scale;
        const lowerName = ing.name.toLowerCase().trim();
        // Find best matching pantry item
        let matchIdx = updatedPantry.findIndex(p => p.name.toLowerCase() === lowerName);
        if (matchIdx === -1) {
          matchIdx = updatedPantry.findIndex(p =>
            p.name.toLowerCase().includes(lowerName) || lowerName.includes(p.name.toLowerCase())
          );
        }
        if (matchIdx !== -1) {
          const item = updatedPantry[matchIdx];
          const itemGrams = item.unit === 'g' ? item.amount : item.amount * (item.unitWeightGrams ?? 100);
          const newGrams = Math.max(0, itemGrams - neededGrams);
          const newAmount = item.unit === 'g' ? newGrams : newGrams / (item.unitWeightGrams ?? 100);
          updatedPantry[matchIdx] = { ...item, amount: newAmount };
          await adjustPantryStock(user.uid, item, -(item.amount - newAmount));
        }
      }
      setPantry(updatedPantry);
    }

    setLogSuccess(`${recipe.name} loggad!`);
    setTimeout(() => setLogSuccess(''), 3000);
    setSelected(null);
  }

  const filtered = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={28} className="animate-spin text-green-500" />
        <p className="text-sm text-gray-400">Laddar recept…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={22} className="text-green-600" />
          <h1 className="text-lg font-bold text-gray-900">Recept</h1>
          <span className="text-sm text-gray-400">({recipes.length})</span>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700"
        >
          <Link size={14} />
          Importera
        </button>
      </div>

      {/* Log success toast */}
      {logSuccess && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <Check size={16} className="text-green-600" />
          {logSuccess}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          placeholder="Sök recept eller tagg…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X size={14} className="text-gray-400" />
          </button>
        )}
      </div>

      {/* Recipe grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <ChefHat size={40} className="text-gray-200" />
          <p className="text-gray-400 text-sm">
            {search ? 'Inga recept matchar sökningen.' : 'Du har inga recept ännu. Importera ett för att börja!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(recipe => {
            const cost = calcRecipeCost(recipe.ingredients, recipe.servings, pantry, priceDB);
            const hasPrice = cost.totalRawSEK > 0;

            return (
              <button
                key={recipe.id}
                onClick={() => setSelected(recipe)}
                className="text-left bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md hover:border-green-200 transition-all"
              >
                {recipe.imageUrl && (
                  <div className="h-28 bg-gray-100">
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {!recipe.imageUrl && (
                  <div className="h-20 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                    <ChefHat size={28} className="text-green-300" />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{recipe.name}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{recipe.servings} port.</p>
                  <div className="flex items-center justify-between mt-2">
                    {recipe.nutritionPerServing.kcal > 0 ? (
                      <span className="text-[11px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        {recipe.nutritionPerServing.kcal} kcal/port
                      </span>
                    ) : (
                      <span />
                    )}
                    {hasPrice ? (
                      <span className="text-[11px] text-gray-500">
                        {formatCost(cost.perServingRaw)}/port
                      </span>
                    ) : null}
                  </div>
                  {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {recipe.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
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
      )}

      {/* Recipe detail modal */}
      {selected && (
        <RecipeDetail
          recipe={selected}
          pantry={pantry}
          priceDB={priceDB}
          onSave={handleSave}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onLog={handleLog}
        />
      )}

      {/* Import dialog */}
      {showImport && (
        <ImportDialog
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
