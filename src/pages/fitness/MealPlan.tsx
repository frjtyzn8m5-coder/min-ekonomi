import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { loadRecipes } from '../../lib/pantryDb';
import { ArrowLeft, RefreshCw, ChevronDown, ChevronUp, Plus, X, ShoppingCart, Settings, Check, Shuffle } from 'lucide-react';
import type { Recipe } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type MealType = 'breakfast' | 'lunch' | 'dinner';
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frukost',
  lunch: 'Lunch',
  dinner: 'Middag',
};
const MEAL_ICONS: Record<MealType, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };
const DAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

interface PlannedMeal {
  recipeId: string | null;
  recipeName: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  servings: number;
  locked: boolean; // user pinned this meal
}

type WeekPlan = Record<number, Record<MealType, PlannedMeal>>;

const EMPTY_MEAL: PlannedMeal = { recipeId: null, recipeName: '', kcal: 0, protein: 0, fat: 0, carbs: 0, servings: 1, locked: false };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function macroScore(
  recipe: Recipe,
  goal: 'lose_fat' | 'gain_muscle' | 'maintain',
  mealType: MealType,
): number {
  const n = recipe.nutritionPerServing;
  if (n.kcal === 0) return 0.5; // unknown nutrition — neutral

  let score = 1;

  // Prefer protein-dense for muscle gain
  if (goal === 'gain_muscle') {
    const proteinPct = (n.protein * 4) / n.kcal;
    score += proteinPct * 2; // reward high protein ratio
  }

  // Prefer lower carb, moderate fat for fat loss
  if (goal === 'lose_fat') {
    const carbPct = (n.carbs * 4) / n.kcal;
    score -= carbPct * 0.5;
    const proteinPct = (n.protein * 4) / n.kcal;
    score += proteinPct;
  }

  // Breakfast: prefer lighter calorie
  if (mealType === 'breakfast' && n.kcal > 600) score -= 1;
  if (mealType === 'dinner' && n.kcal < 200) score -= 0.5;

  return score;
}

function pickMeal(
  candidates: Recipe[],
  goal: 'lose_fat' | 'gain_muscle' | 'maintain',
  mealType: MealType,
  exclude: Set<string>,
): PlannedMeal {
  const available = candidates.filter(r => !exclude.has(r.id) || candidates.length <= exclude.size + 1);
  if (!available.length) return EMPTY_MEAL;

  // Score + add some randomness
  const scored = available
    .map(r => ({ r, score: macroScore(r, goal, mealType) + Math.random() * 0.5 }))
    .sort((a, b) => b.score - a.score);

  const picked = scored[0].r;
  const n = picked.nutritionPerServing;
  return {
    recipeId: picked.id,
    recipeName: picked.name,
    kcal: n.kcal,
    protein: n.protein,
    fat: n.fat,
    carbs: n.carbs,
    servings: 1,
    locked: false,
  };
}

function emptyWeek(): WeekPlan {
  return Object.fromEntries(DAYS.map((_, d) => [
    d,
    { breakfast: { ...EMPTY_MEAL }, lunch: { ...EMPTY_MEAL }, dinner: { ...EMPTY_MEAL } },
  ])) as unknown as WeekPlan;
}

function generatePlan(
  recipes: Recipe[],
  goal: 'lose_fat' | 'gain_muscle' | 'maintain',
  favBreakfast: string | null,
  current: WeekPlan,
): WeekPlan {
  const plan: WeekPlan = emptyWeek();
  const usedPerMeal: Record<MealType, Set<string>> = {
    breakfast: new Set(),
    lunch: new Set(),
    dinner: new Set(),
  };

  for (let d = 0; d < 7; d++) {
    for (const mt of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      // Keep locked meals
      if (current[d]?.[mt]?.locked) {
        plan[d][mt] = current[d][mt];
        continue;
      }

      // Favorite breakfast: use same recipe every day
      if (mt === 'breakfast' && favBreakfast) {
        const fav = recipes.find(r => r.id === favBreakfast);
        if (fav) {
          const n = fav.nutritionPerServing;
          plan[d][mt] = { recipeId: fav.id, recipeName: fav.name, kcal: n.kcal, protein: n.protein, fat: n.fat, carbs: n.carbs, servings: 1, locked: false };
          continue;
        }
      }

      const meal = pickMeal(recipes, goal, mt, usedPerMeal[mt]);
      if (meal.recipeId) usedPerMeal[mt].add(meal.recipeId);
      plan[d][mt] = meal;
    }
  }
  return plan;
}

function dayTotals(day: Record<MealType, PlannedMeal>) {
  return (['breakfast', 'lunch', 'dinner'] as MealType[]).reduce(
    (acc, mt) => {
      const m = day[mt];
      return {
        kcal:    acc.kcal    + m.kcal * m.servings,
        protein: acc.protein + m.protein * m.servings,
        fat:     acc.fat     + m.fat * m.servings,
        carbs:   acc.carbs   + m.carbs * m.servings,
      };
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

// ─── Shopping list ────────────────────────────────────────────────────────────

function ShoppingList({ plan, recipes }: { plan: WeekPlan; recipes: Recipe[] }) {
  // Aggregate ingredients across all planned meals
  const ingredientMap = new Map<string, { amount: number; unit: string }>();

  for (let d = 0; d < 7; d++) {
    for (const mt of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      const meal = plan[d][mt];
      if (!meal.recipeId) continue;
      const recipe = recipes.find(r => r.id === meal.recipeId);
      if (!recipe) continue;
      const scale = meal.servings / Math.max(recipe.servings, 1);
      for (const ing of recipe.ingredients) {
        const key = ing.name.toLowerCase();
        const existing = ingredientMap.get(key);
        const amount = ing.amount * scale;
        if (existing) {
          ingredientMap.set(key, { amount: existing.amount + amount, unit: 'g' });
        } else {
          ingredientMap.set(key, { amount, unit: 'g' });
        }
      }
    }
  }

  const items = [...ingredientMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, { amount, unit }]) => ({ name, amount: Math.round(amount), unit }));

  if (!items.length) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        Generera en veckoplan för att se inköpslistan.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map(item => (
        <div key={item.name} className="flex items-center gap-3 py-2 border-b border-gray-50">
          <span className="flex-1 text-sm text-gray-700 capitalize">{item.name}</span>
          <span className="text-sm text-gray-500">{item.amount} {item.unit}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Settings panel ───────────────────────────────────────────────────────────

interface PlanSettingsProps {
  goal: 'lose_fat' | 'gain_muscle' | 'maintain';
  onGoal: (g: 'lose_fat' | 'gain_muscle' | 'maintain') => void;
  favBreakfast: string | null;
  onFavBreakfast: (id: string | null) => void;
  recipes: Recipe[];
  targetKcal: number;
  onTargetKcal: (v: number) => void;
  onClose: () => void;
}

function PlanSettings({ goal, onGoal, favBreakfast, onFavBreakfast, recipes, targetKcal, onTargetKcal, onClose }: PlanSettingsProps) {
  const goals: { value: 'lose_fat' | 'gain_muscle' | 'maintain'; label: string; emoji: string }[] = [
    { value: 'lose_fat', label: 'Gå ner i vikt', emoji: '🔥' },
    { value: 'maintain', label: 'Bibehåll vikt', emoji: '⚖️' },
    { value: 'gain_muscle', label: 'Bygg muskler', emoji: '💪' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md space-y-5 p-5 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Planinställningar</h2>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>

        {/* Goal */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Mål</p>
          <div className="grid grid-cols-3 gap-2">
            {goals.map(g => (
              <button
                key={g.value}
                onClick={() => onGoal(g.value)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  goal === g.value
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {g.emoji} {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target calories */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Mål-kalorier per dag (kcal)</p>
          <input
            type="number"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            value={targetKcal}
            onChange={e => onTargetKcal(Number(e.target.value))}
            step="50"
          />
        </div>

        {/* Favorite breakfast */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Favoritfrukost (samma varje dag)</p>
          <select
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            value={favBreakfast ?? ''}
            onChange={e => onFavBreakfast(e.target.value || null)}
          >
            <option value="">Ingen — variera</option>
            {recipes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
        >
          Spara
        </button>
      </div>
    </div>
  );
}

// ─── Meal cell ────────────────────────────────────────────────────────────────

interface MealCellProps {
  meal: PlannedMeal;
  mealType: MealType;
  recipes: Recipe[];
  onUpdate: (m: PlannedMeal) => void;
}

function MealCell({ meal, mealType, recipes, onUpdate }: MealCellProps) {
  const [open, setOpen] = useState(false);

  function shuffle() {
    if (meal.locked) return;
    const pool = recipes.filter(r => r.id !== meal.recipeId);
    if (!pool.length) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const n = picked.nutritionPerServing;
    onUpdate({ ...meal, recipeId: picked.id, recipeName: picked.name, kcal: n.kcal, protein: n.protein, fat: n.fat, carbs: n.carbs });
  }

  function toggleLock() {
    onUpdate({ ...meal, locked: !meal.locked });
  }

  function clear() {
    onUpdate({ ...EMPTY_MEAL, servings: 1 });
    setOpen(false);
  }

  function setRecipe(r: Recipe) {
    const n = r.nutritionPerServing;
    onUpdate({ ...meal, recipeId: r.id, recipeName: r.name, kcal: n.kcal, protein: n.protein, fat: n.fat, carbs: n.carbs });
    setOpen(false);
  }

  const empty = !meal.recipeId;
  const kcalForCell = meal.kcal * meal.servings;

  return (
    <div className={`rounded-xl border text-left text-xs transition-all ${
      meal.locked ? 'border-green-300 bg-green-50' :
      empty ? 'border-dashed border-gray-200 bg-white' :
      'border-gray-100 bg-white'
    }`}>
      <button
        className="w-full p-2.5 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-start gap-1.5">
          <span className="text-base leading-none flex-shrink-0">{MEAL_ICONS[mealType]}</span>
          <div className="flex-1 min-w-0">
            {empty ? (
              <p className="text-gray-300 text-[11px]">+ Lägg till</p>
            ) : (
              <>
                <p className="font-medium text-gray-800 leading-tight truncate">{meal.recipeName}</p>
                {kcalForCell > 0 && (
                  <p className="text-gray-400 text-[10px] mt-0.5">{kcalForCell} kcal</p>
                )}
              </>
            )}
          </div>
          {meal.locked && <span className="text-green-500 text-[10px] flex-shrink-0">🔒</span>}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-50 p-2 space-y-2">
          {/* Servings */}
          {!empty && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-[11px]">Portioner</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onUpdate({ ...meal, servings: Math.max(1, meal.servings - 1) })}
                  className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200">−</button>
                <span className="w-5 text-center text-xs font-semibold">{meal.servings}</span>
                <button onClick={() => onUpdate({ ...meal, servings: meal.servings + 1 })}
                  className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200">+</button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1.5">
            {!empty && (
              <button onClick={shuffle} className="flex-1 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-medium hover:bg-gray-200 flex items-center justify-center gap-1">
                <Shuffle size={11} /> Byt
              </button>
            )}
            {!empty && (
              <button onClick={toggleLock} className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 ${
                meal.locked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
                {meal.locked ? '🔒 Lås' : '🔓 Lås'}
              </button>
            )}
            {!empty && (
              <button onClick={clear} className="flex-1 py-1.5 rounded-lg bg-red-50 text-red-400 text-[11px] font-medium hover:bg-red-100">
                Ta bort
              </button>
            )}
          </div>

          {/* Recipe picker */}
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {recipes.map(r => (
              <button
                key={r.id}
                onClick={() => setRecipe(r)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors ${
                  meal.recipeId === r.id ? 'bg-green-50 text-green-700' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                {r.name}
                {r.nutritionPerServing.kcal > 0 && (
                  <span className="ml-1 text-gray-400">· {r.nutritionPerServing.kcal} kcal</span>
                )}
              </button>
            ))}
            {recipes.length === 0 && (
              <p className="text-gray-400 text-center py-2">Inga recept sparade</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main MealPlan page ───────────────────────────────────────────────────────

export default function MealPlan() {
  const { user } = useAuthStore();
  const { nutritionSettings, fitnessProfile, setFitnessPage } = useStore();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<WeekPlan>(emptyWeek);
  const [activeTab, setActiveTab] = useState<'plan' | 'shopping'>('plan');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

  // Plan settings
  const [goal, setGoal] = useState<'lose_fat' | 'gain_muscle' | 'maintain'>(
    fitnessProfile.goal === 'recomp' ? 'maintain' : (fitnessProfile.goal ?? 'maintain')
  );
  const [favBreakfast, setFavBreakfast] = useState<string | null>(null);
  const [targetKcal, setTargetKcal] = useState(nutritionSettings.targetCalories ?? 2000);

  useEffect(() => {
    if (!user) return;
    loadRecipes(user.uid).then(r => {
      setRecipes(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const regenerate = useCallback(() => {
    if (!recipes.length) return;
    setPlan(current => generatePlan(recipes, goal, favBreakfast, current));
  }, [recipes, goal, favBreakfast]);

  function updateMeal(day: number, mt: MealType, meal: PlannedMeal) {
    setPlan(prev => ({ ...prev, [day]: { ...prev[day], [mt]: meal } }));
  }

  const todayTotals = dayTotals(plan[selectedDay]);
  const kcalPct = targetKcal > 0 ? Math.min(100, (todayTotals.kcal / targetKcal) * 100) : 0;

  return (
    <div className="min-h-full bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setFitnessPage('home')}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <h1 className="text-base font-semibold text-gray-900 flex-1">Veckoplanering 🗓️</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
        >
          <Settings size={16} className="text-gray-500" />
        </button>
        <button
          onClick={regenerate}
          disabled={!recipes.length}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40"
        >
          <RefreshCw size={14} />
          Generera
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white px-4">
        {(['plan', 'shopping'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'plan' ? '📅 Plan' : <><ShoppingCart size={14} />Inköpslista</>}
          </button>
        ))}
      </div>

      {activeTab === 'shopping' ? (
        <div className="max-w-2xl mx-auto px-4 py-4">
          <ShoppingList plan={plan} recipes={recipes} />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Day selector */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {DAYS.map((day, d) => {
              const tots = dayTotals(plan[d]);
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={`flex flex-col items-center flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    selectedDay === d
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{day}</span>
                  {tots.kcal > 0 && (
                    <span className={`text-[10px] mt-0.5 ${selectedDay === d ? 'text-green-100' : 'text-gray-400'}`}>
                      {tots.kcal} kcal
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Day totals bar */}
          {todayTotals.kcal > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700">{DAYS[selectedDay]}ens totaler</p>
                <p className={`text-xs font-semibold ${
                  todayTotals.kcal > targetKcal ? 'text-red-500' : 'text-green-600'
                }`}>
                  {todayTotals.kcal} / {targetKcal} kcal
                </p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${
                    kcalPct >= 100 ? 'bg-red-400' : kcalPct >= 80 ? 'bg-green-500' : 'bg-yellow-400'
                  }`}
                  style={{ width: `${kcalPct}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Protein', val: `${Math.round(todayTotals.protein)}g`, color: 'text-blue-600' },
                  { label: 'Fett', val: `${Math.round(todayTotals.fat)}g`, color: 'text-yellow-600' },
                  { label: 'Kolh', val: `${Math.round(todayTotals.carbs)}g`, color: 'text-orange-500' },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-[10px] text-gray-400">{m.label}</p>
                    <p className={`text-sm font-bold ${m.color}`}>{m.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meals for selected day */}
          <div className="space-y-2">
            {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(mt => (
              <div key={mt}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  {MEAL_LABELS[mt]}
                </p>
                <MealCell
                  meal={plan[selectedDay][mt]}
                  mealType={mt}
                  recipes={recipes}
                  onUpdate={meal => updateMeal(selectedDay, mt, meal)}
                />
              </div>
            ))}
          </div>

          {/* No recipes prompt */}
          {!loading && recipes.length === 0 && (
            <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">Inga recept ännu</p>
              <p className="text-gray-300 text-xs mt-1">Importera recept för att generera en veckoplan</p>
              <button
                onClick={() => setFitnessPage('recipes')}
                className="mt-3 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700"
              >
                Gå till Recept
              </button>
            </div>
          )}

          {/* Whole-week overview (compact) */}
          {recipes.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hela veckan</p>
              {DAYS.map((day, d) => {
                const tots = dayTotals(plan[d]);
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-t border-gray-50 hover:bg-gray-50 transition-colors ${selectedDay === d ? 'bg-green-50' : ''}`}
                  >
                    <span className={`text-sm font-medium w-8 ${selectedDay === d ? 'text-green-700' : 'text-gray-700'}`}>{day}</span>
                    <div className="flex-1 grid grid-cols-3 gap-1 text-[11px] text-gray-500">
                      {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(mt => (
                        <span key={mt} className="truncate">
                          {plan[d][mt].recipeName || '–'}
                        </span>
                      ))}
                    </div>
                    {tots.kcal > 0 && (
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{tots.kcal} kcal</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <PlanSettings
          goal={goal}
          onGoal={setGoal}
          favBreakfast={favBreakfast}
          onFavBreakfast={setFavBreakfast}
          recipes={recipes}
          targetKcal={targetKcal}
          onTargetKcal={setTargetKcal}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
