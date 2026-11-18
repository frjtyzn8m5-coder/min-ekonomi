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
  ChefHat, Trash2, Link, Loader2, Search, X, ChevronDown, ChevronUp,
  Utensils, Check, AlertCircle, Shuffle, ArrowLeft,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import PageBanner from '../../components/ui/PageBanner';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-line rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <Link size={18} className="text-gold" />
            <h2 className="font-display text-ink">Importera recept från URL</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
            <X size={16} className="text-mut" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-mut">Klistra in en länk till ett recept från t.ex. ICA, Arla, Tasteline eller Coop.</p>
          <input
            className="w-full border border-line bg-soft text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
            placeholder="https://www.ica.se/recept/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
          />
          {error && <p className="text-sm text-coral">{error}</p>}
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-sm font-medium text-mut hover:bg-white/5">Avbryt</button>
          <button
            onClick={handleImport}
            disabled={!url.trim() || loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#2a1d08] disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
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
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-line rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <p className="text-sm font-semibold text-ink">Välj matvara</p>
          <button onClick={onClose}><X size={16} className="text-faint" /></button>
        </div>
        <div className="p-3 border-b border-line">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              ref={inputRef}
              className="w-full pl-8 pr-3 py-2 bg-soft text-ink rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Sök i Livsmedelsverkets databas…"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-faint" /></div>}
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => { onSelect(item); onClose(); }}
              className="w-full px-4 py-3 text-left border-b border-line hover:bg-white/5 transition-colors"
              style={currentMatch?.id === item.id ? { background: 'rgba(233,193,120,.12)' } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-ink">{item.name}</p>
                {currentMatch?.id === item.id && <Check size={14} className="text-gold flex-shrink-0 mt-0.5" />}
              </div>
              <p className="text-xs text-faint mt-0.5 tnum">
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
      <div className={`border border-line rounded-xl overflow-hidden ${expanded ? 'ring-1 ring-gold/40' : ''}`}>
        {/* Main row */}
        <div className="flex items-center gap-2 px-3 py-2 bg-card">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <span className="text-sm text-mut truncate">{ing.name}</span>
            {!ing.lvItem && (
              <span title="Ingen nutritionsmatchning"><AlertCircle size={13} className="text-gold flex-shrink-0" /></span>
            )}
            {hasNutrition && (
              <span className="text-[10px] text-faint flex-shrink-0 tnum">
                {scaledNutrition!.kcal} kcal
              </span>
            )}
          </button>
          <input
            type="number"
            className="w-20 border border-line bg-soft text-ink rounded-lg px-2 py-1 text-sm text-right tnum focus:outline-none focus:ring-1 focus:ring-gold"
            value={scaledGrams}
            onChange={e => onUpdateGrams(parseFloat(e.target.value) / Math.max(scale, 0.001))}
          />
          <span className="text-xs text-faint w-4">g</span>
          <button onClick={() => setExpanded(v => !v)} className="text-faint hover:text-mut">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="px-3 pb-3 pt-1 bg-soft border-t border-line space-y-2">
            {/* Original text */}
            <p className="text-[10px] text-faint">
              Original: <span className="italic">{ing.originalText}</span>
            </p>

            {/* LV match */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-faint mb-0.5">Matchad matvara</p>
                {ing.lvItem ? (
                  <p className="text-xs font-medium text-ink truncate">{ing.lvItem.name}</p>
                ) : (
                  <p className="text-xs text-gold">Ingen matchning — klicka för att välja</p>
                )}
              </div>
              <button
                onClick={() => setShowSwap(true)}
                className="flex items-center gap-1 text-[11px] text-gold hover:text-gold-2 font-medium flex-shrink-0"
              >
                <Shuffle size={12} />
                Byt
              </button>
            </div>

            {/* Nutrition for this ingredient */}
            {scaledNutrition && (
              <div className="grid grid-cols-4 gap-1 bg-card rounded-lg px-2 py-1.5">
                {[
                  { label: 'Kcal', val: scaledNutrition.kcal },
                  { label: 'Prot', val: `${fmt1(scaledNutrition.protein)}g` },
                  { label: 'Fett', val: `${fmt1(scaledNutrition.fat)}g` },
                  { label: 'Kolh', val: `${fmt1(scaledNutrition.carbs)}g` },
                ].map(m => (
                  <div key={m.label} className="text-center">
                    <p className="text-[9px] text-faint">{m.label}</p>
                    <p className="text-[11px] font-semibold text-mut tnum">{m.val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Cost */}
            {costDetail && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-faint">Kostnad (råkostnad)</span>
                <span className={`tnum ${costDetail.found ? 'text-mut font-medium' : 'text-faint'}`}>
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
    <div className="flex flex-col min-h-full bg-bg text-ink">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-shrink-0 bg-panel sticky top-0 z-10">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-mut hover:text-ink"
        >
          <ArrowLeft size={16} />
          Tillbaka
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onDelete(recipe.id)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[rgba(255,143,122,0.08)] text-faint hover:text-coral"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-[#2a1d08]"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
          >
            Spara
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Image */}
        {recipe.imageUrl && (
          <div className="h-48 bg-soft flex-shrink-0">
            <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
          {/* Name + source */}
          <div>
            <h1 className="font-display text-xl text-ink">{recipe.name}</h1>
            {recipe.source && (
              <a
                href={recipe.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gold hover:underline mt-1 block truncate"
              >
                {recipe.source}
              </a>
            )}
          </div>

          {/* Servings */}
          <div className="flex items-center gap-4 bg-soft rounded-xl p-3">
            <div className="flex items-center gap-1 text-mut">
              <Utensils size={16} />
              <span className="text-sm">Portioner</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setServings(s => Math.max(1, s - 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-line text-mut hover:bg-white/10"
              >
                −
              </button>
              <span className="w-8 text-center font-semibold text-ink tnum">{servings}</span>
              <button
                onClick={() => setServings(s => s + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-line text-mut hover:bg-white/10"
              >
                +
              </button>
            </div>
          </div>

          {/* Cost summary */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[rgba(233,193,120,0.08)] border border-gold/20 rounded-xl p-3 text-center">
                <p className="text-xs text-gold font-medium">Råkostnad</p>
                <p className="font-display text-lg text-gold mt-1 tnum">
                  {hasAnyPrice ? formatCost(cost.totalRawSEK) : '–'}
                </p>
                <p className="text-xs text-gold/70">
                  {hasAnyPrice ? `${formatCost(cost.perServingRaw)} / portion` : 'Lägg till priser i skafferiet'}
                </p>
              </div>
              <div className="bg-[rgba(95,224,208,0.08)] border border-cyan/20 rounded-xl p-3 text-center">
                <p className="text-xs text-cyan font-medium">Verklig kostnad</p>
                <p className="font-display text-lg text-cyan mt-1 tnum">
                  {hasAnyPrice ? formatCost(cost.totalRealSEK) : '–'}
                </p>
                <p className="text-xs text-cyan/70">
                  {hasAnyPrice ? `${formatCost(cost.perServingReal)} / portion` : 'Skanna kvitto för priser'}
                </p>
              </div>
            </div>
            {totalPriceable > 0 && (
              <p className="text-[11px] text-center text-faint">
                {pricedCount === totalPriceable
                  ? `✓ Alla ${totalPriceable} ingredienser prissatta`
                  : `${pricedCount}/${totalPriceable} ingredienser med känt pris — ${totalPriceable - pricedCount} saknas`}
              </p>
            )}
          </div>

          {/* Nutrition per serving */}
          <div className="bg-card border border-line rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-faint uppercase tracking-wide">Näring per portion</p>
              {loading && <Loader2 size={12} className="animate-spin text-faint" />}
              {!loading && matchedCount < ingredients.length && (
                <span className="text-[10px] text-gold">
                  {matchedCount}/{ingredients.length} ingredienser matchade
                </span>
              )}
              {!loading && matchedCount === ingredients.length && ingredients.length > 0 && (
                <span className="text-[10px] text-cyan">Alla matchade ✓</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Kcal', val: Math.round(displayNutrition.kcal * scale) },
                { label: 'Protein', val: `${fmt1((displayNutrition.protein ?? 0) * scale)}g` },
                { label: 'Fett', val: `${fmt1((displayNutrition.fat ?? 0) * scale)}g` },
                { label: 'Kolhydr', val: `${fmt1((displayNutrition.carbs ?? 0) * scale)}g` },
              ].map(m => (
                <div key={m.label} className="bg-soft rounded-lg py-2">
                  <p className="text-[10px] text-faint">{m.label}</p>
                  <p className="font-display text-sm text-ink mt-0.5 tnum">{m.val}</p>
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
              <p className="text-xs font-semibold text-faint uppercase tracking-wide">
                Ingredienser ({ingredients.length})
              </p>
              {showIngredients ? <ChevronUp size={14} className="text-faint" /> : <ChevronDown size={14} className="text-faint" />}
            </button>

            {showIngredients && (
              <div className="space-y-2">
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-faint" />
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
              <p className="text-xs font-semibold text-faint uppercase tracking-wide mb-2">Instruktioner</p>
              <ol className="space-y-3">
                {recipe.instructions.map((step, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full text-gold text-xs font-bold flex items-center justify-center mt-0.5 tnum" style={{ background: 'rgba(233,193,120,.14)' }}>
                      {idx + 1}
                    </span>
                    <p className="text-sm text-mut leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 bg-soft text-mut text-xs rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Log section */}
          <div className="bg-soft rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-faint uppercase tracking-wide">Logga måltid</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-mut">Portioner:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLogServings(s => Math.max(1, s - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-line text-mut hover:bg-white/10"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-ink tnum">{logServings}</span>
                <button
                  onClick={() => setLogServings(s => s + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-line text-mut hover:bg-white/10"
                >
                  +
                </button>
              </div>
              <span className="text-sm text-faint ml-auto tnum">
                ≈ {Math.round(displayNutrition.kcal * (logServings / Math.max(recipe.servings, 1)))} kcal
              </span>
            </div>
            <button
              onClick={() => onLog(recipe, logServings)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#2a1d08] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
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
  const { setFitnessPage } = useStore();
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 bg-bg">
        <Loader2 size={28} className="animate-spin text-gold" />
        <p className="text-sm text-faint">Laddar recept…</p>
      </div>
    );
  }

  // ── Recipe detail: render as full page (no overlay) ──────────────────────────
  if (selected) {
    return (
      <RecipeDetail
        recipe={selected}
        pantry={pantry}
        priceDB={priceDB}
        onSave={handleSave}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
        onLog={handleLog}
      />
    );
  }

  return (
    <div className="min-h-full bg-bg text-ink">
      <PageBanner
        img="/img/f-cook.jpg"
        eyebrow="Kost"
        title="Recept"
        subtitle={`${recipes.length} recept · kostnad & näring via Livsmedelsverket.`}
        onBack={() => setFitnessPage('home')}
        action={
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl text-[#2a1d08]"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
          >
            <Link size={14} />
            Importera
          </button>
        }
      />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 lg:px-10 py-6 pb-24 space-y-4">
      {/* Log success toast */}
      {logSuccess && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[rgba(95,224,208,0.1)] border border-cyan/30 rounded-xl text-sm text-cyan">
          <Check size={16} className="text-cyan" />
          {logSuccess}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          className="w-full pl-9 pr-3 py-2.5 bg-soft border border-line rounded-xl text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold"
          placeholder="Sök recept eller tagg…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X size={14} className="text-faint" />
          </button>
        )}
      </div>

      {/* Recipe grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <ChefHat size={40} className="text-faint" />
          <p className="text-faint text-sm">
            {search ? 'Inga recept matchar sökningen.' : 'Du har inga recept ännu. Importera ett för att börja!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(recipe => {
            const cost = calcRecipeCost(recipe.ingredients, recipe.servings, pantry, priceDB);
            const hasPrice = cost.totalRawSEK > 0;

            return (
              <button
                key={recipe.id}
                onClick={() => setSelected(recipe)}
                className="text-left vh-card overflow-hidden"
              >
                {recipe.imageUrl && (
                  <div className="h-28 bg-soft">
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {!recipe.imageUrl && (
                  <div className="h-20 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,rgba(233,193,120,.12),rgba(207,154,63,.18))' }}>
                    <ChefHat size={28} className="text-gold/60" />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-semibold text-ink line-clamp-2 leading-snug">{recipe.name}</p>
                  <p className="text-[11px] text-faint mt-1 tnum">{recipe.servings} port.</p>
                  <div className="flex items-center justify-between mt-2">
                    {recipe.nutritionPerServing.kcal > 0 ? (
                      <span className="text-[11px] font-medium text-gold px-2 py-0.5 rounded-full tnum" style={{ background: 'rgba(233,193,120,.12)' }}>
                        {recipe.nutritionPerServing.kcal} kcal/port
                      </span>
                    ) : (
                      <span />
                    )}
                    {hasPrice ? (
                      <span className="text-[11px] text-mut tnum">
                        {formatCost(cost.perServingRaw)}/port
                      </span>
                    ) : null}
                  </div>
                  {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {recipe.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] bg-soft text-mut px-1.5 py-0.5 rounded-full">
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
      </div>

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
