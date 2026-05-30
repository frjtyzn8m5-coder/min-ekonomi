import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { loadRecipes, saveRecipe, deleteRecipe, loadPantry } from '../../lib/pantryDb';
import { saveFoodEntry } from '../../lib/foodDb';
import { parseIngredientText } from '../../utils/unitConverter';
import { calcRecipeCost } from '../../utils/recipeCost';
import type { Recipe, RecipeIngredient, PantryItem, FoodEntry } from '../../types';
import {
  ChefHat, Plus, Trash2, Link, Loader2, Search, X, ChevronDown, ChevronUp,
  Utensils, Clock, DollarSign, Info, Check, Package,
} from 'lucide-react';
import { nanoid } from 'nanoid';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCost(v: number | undefined | null): string {
  if (v == null) return '–';
  return `${v.toFixed(0)} kr`;
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
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(recipe.ingredients);
  const [expanded, setExpanded] = useState(false);
  const [logServings, setLogServings] = useState(1);

  const scale = servings / Math.max(recipe.servings, 1);

  // Cost (no priceDB in-memory for now — use pantry only)
  const cost = calcRecipeCost(ingredients, servings, pantry, []);

  function updateIngAmount(idx: number, newGrams: number) {
    setIngredients(prev => prev.map((ing, i) =>
      i === idx ? { ...ing, amount: newGrams } : ing,
    ));
  }

  function handleSave() {
    onSave({ ...recipe, servings, ingredients });
  }

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
            Spara ändringar
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

        <div className="p-4 max-w-2xl mx-auto space-y-5">
          {/* Name + meta */}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{recipe.name}</h1>
            {recipe.source && (
              <a href={recipe.source} target="_blank" rel="noopener noreferrer"
                className="text-xs text-green-600 hover:underline mt-1 block">
                {recipe.source}
              </a>
            )}
          </div>

          {/* Servings control */}
          <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-1 text-gray-500">
              <Utensils size={16} />
              <span className="text-sm">Portioner</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => setServings(s => Math.max(1, s - 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 text-lg leading-none">
                −
              </button>
              <span className="w-8 text-center font-semibold text-gray-800">{servings}</span>
              <button onClick={() => setServings(s => s + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 text-lg leading-none">
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
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Näring per portion</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Kcal', val: Math.round((recipe.nutritionPerServing.kcal * scale)) },
                { label: 'Protein', val: `${Math.round(recipe.nutritionPerServing.protein * scale)}g` },
                { label: 'Kolh', val: `${Math.round(recipe.nutritionPerServing.carbs * scale)}g` },
                { label: 'Fett', val: `${Math.round(recipe.nutritionPerServing.fat * scale)}g` },
              ].map(m => (
                <div key={m.label}>
                  <p className="text-xs text-gray-400">{m.label}</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{m.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Ingredienser</h2>
            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2">
                  <span className="flex-1 text-sm text-gray-700">{ing.name}</span>
                  <input
                    type="number"
                    className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-green-400"
                    value={Math.round(ing.amount * scale)}
                    onChange={e => updateIngAmount(idx, parseFloat(e.target.value) / scale || 0)}
                  />
                  <span className="text-xs text-gray-400 w-4">g</span>
                </div>
              ))}
            </div>
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
    Promise.all([loadRecipes(user.uid), loadPantry(user.uid)]).then(([r, p]) => {
      setRecipes(r);
      setPantry(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  function resolveIngredients(rawIngredients: string[]): RecipeIngredient[] {
    return rawIngredients.map(text => {
      const parsed = parseIngredientText(text);
      return {
        name: parsed.name,
        originalText: text,
        amount: parsed.result.grams ?? 0,
        originalAmount: parsed.amount,
        originalUnit: parsed.unit,
      };
    });
  }

  async function handleImport(data: {
    name: string; servings: number; ingredients: string[];
    instructions: string[]; imageUrl?: string; tags: string[]; source: string;
  }) {
    if (!user) return;

    const ingredients = resolveIngredients(data.ingredients);

    // Rough nutrition estimate: zero until Livsmedelsverket matching (future)
    const zeroNutrition = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

    const recipe: Recipe = {
      id: nanoid(),
      name: data.name,
      servings: data.servings,
      ingredients,
      instructions: data.instructions,
      tags: data.tags,
      nutritionPerServing: zeroNutrition,
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
      amount: servings * 300, // rough gram estimate
      nutrition: {
        kcal: Math.round(n.kcal * scale * servings),
        protein: Math.round(n.protein * scale * servings * 10) / 10,
        fat: Math.round(n.fat * scale * servings * 10) / 10,
        carbs: Math.round(n.carbs * scale * servings * 10) / 10,
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
        {/* Log success toast */}
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
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        ~{cost.perServingReal.toFixed(0)} kr/port.
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
          onSave={handleSave}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onLog={handleLog}
        />
      )}
    </div>
  );
}
