import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { loadRecipes, loadPantry, loadPriceDB } from '../../lib/pantryDb';
import { buildShoppingList, type PlannedRecipe } from '../../utils/shoppingEngine';
import { RefreshCw, X, ShoppingCart, Settings, Check, Shuffle, Package } from 'lucide-react';
import { IFlame, IUtensils, IMoon } from '../../components/ui/Icons';
import type { Recipe, PantryItem, PriceEntry } from '../../types';
import PageBanner from '../../components/ui/PageBanner';

// ─── Types ────────────────────────────────────────────────────────────────────

type MealType = 'breakfast' | 'lunch' | 'dinner';
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frukost',
  lunch: 'Lunch',
  dinner: 'Middag',
};
const MEAL_TILES: Record<MealType, { tile: string; Icon: typeof IFlame }> = {
  breakfast: { tile: 'gold', Icon: IFlame },
  lunch: { tile: 'cyan', Icon: IUtensils },
  dinner: { tile: 'violet', Icon: IMoon },
};
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

// ─── Shopping list (powered by shoppingEngine) ──────────────────────────────────

function ShoppingList({
  plan, recipes, pantry, priceDB,
}: {
  plan: WeekPlan;
  recipes: Recipe[];
  pantry: PantryItem[];
  priceDB: PriceEntry[];
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // 1. Collect planned recipes (with desired servings) from the week plan.
  const planned: PlannedRecipe[] = [];
  for (let d = 0; d < 7; d++) {
    for (const mt of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      const meal = plan[d][mt];
      if (!meal.recipeId) continue;
      const recipe = recipes.find(r => r.id === meal.recipeId);
      if (!recipe) continue;
      planned.push({ recipe, servings: meal.servings });
    }
  }

  if (!planned.length) {
    return (
      <div className="text-center py-12 text-faint text-sm">
        Generera en veckoplan för att se inköpslistan.
      </div>
    );
  }

  // 2. Run the deterministic engine: aggregate → subtract pantry → round to
  //    logical packages → group by category → leftovers (pantryDelta).
  const result = buildShoppingList(planned, pantry, { priceDB });

  function toggleCheck(key: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-[rgba(233,193,120,0.08)] border border-gold/20 rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gold tnum">{result.toBuyCount} varor att köpa</p>
          <p className="text-xs text-mut mt-0.5 tnum">
            {result.covered.length} täcks av skafferiet
          </p>
        </div>
        {result.totalCostSEK != null && result.totalCostSEK > 0 && (
          <div className="text-right">
            <p className="text-xs text-mut">Uppskattat</p>
            <p className="font-display text-sm text-gold tnum">{result.totalCostSEK.toFixed(0)} kr</p>
            <p className="text-[10px] text-faint">endast varor med känt pris</p>
          </div>
        )}
      </div>

      {/* Items to buy — grouped by category (butiksordning) */}
      {result.groups.map(group => (
        <div key={group.category}>
          <p className="text-xs font-semibold text-faint uppercase tracking-wide mb-2">
            {group.category}
          </p>
          <div className="bg-card rounded-2xl divide-y divide-line overflow-hidden border border-line">
            {group.items.map(item => {
              const done = checked.has(item.key);
              return (
                <div
                  key={item.key}
                  onClick={() => toggleCheck(item.key)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${done ? 'bg-white/5' : 'hover:bg-white/5'}`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-gold border-gold' : 'border-faint'}`}>
                    {done && <Check size={11} className="text-[#2a1d08]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className={`text-sm capitalize font-medium ${done ? 'line-through text-faint' : 'text-ink'}`}>{item.name}</p>
                      <span className={`text-xs font-semibold tnum flex-shrink-0 ${done ? 'text-faint' : 'text-gold'}`}>
                        {item.displayQuantity}
                      </span>
                    </div>
                    <p className="text-xs text-faint tnum">
                      {item.packLabel ? `${item.packLabel} · ` : ''}{Math.round(item.toBuyGrams)} g behövs
                      {item.leftoverGrams >= 20 && (
                        <span className="text-cyan"> · {Math.round(item.leftoverGrams)} g kvar till skafferiet</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {item.estimatedCostSEK != null ? (
                      <p className="text-sm font-semibold text-mut tnum">{item.estimatedCostSEK.toFixed(1)} kr</p>
                    ) : (
                      <p className="text-xs text-faint">Pris okänt</p>
                    )}
                    {item.pricePerKg != null && (
                      <p className="text-[10px] text-faint tnum">{item.pricePerKg.toFixed(0)} kr/kg</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Already in pantry */}
      {result.covered.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-faint uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Package size={12} /> Finns i skafferiet
          </p>
          <div className="bg-card rounded-2xl divide-y divide-line overflow-hidden border border-line opacity-60">
            {result.covered.map(item => (
              <div key={item.key} className="flex items-center gap-3 px-4 py-2.5">
                <Check size={14} className="text-cyan flex-shrink-0" />
                <p className="flex-1 text-sm text-mut capitalize">{item.name}</p>
                <p className="text-xs text-faint tnum">{Math.round(item.neededGrams)} g</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft notice (org policy: outputs must be reviewed by a person) */}
      <p className="text-[11px] text-faint text-center pt-1">
        Utkast — kontrollera mängder och priser innan du handlar.
      </p>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
      <div className="bg-card border border-line rounded-2xl shadow-2xl w-full max-w-md space-y-5 p-5 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-ink">Planinställningar</h2>
          <button onClick={onClose}><X size={16} className="text-faint" /></button>
        </div>

        {/* Goal */}
        <div>
          <p className="text-xs font-semibold text-mut mb-2">Mål</p>
          <div className="grid grid-cols-3 gap-2">
            {goals.map(g => (
              <button
                key={g.value}
                onClick={() => onGoal(g.value)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  goal === g.value
                    ? 'text-[#2a1d08] border-transparent'
                    : 'bg-soft text-mut border-line hover:bg-white/5'
                }`}
                style={goal === g.value ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
              >
                {g.emoji} {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target calories */}
        <div>
          <p className="text-xs font-semibold text-mut mb-2">Mål-kalorier per dag (kcal)</p>
          <input
            type="number"
            className="w-full border border-line bg-soft text-ink rounded-xl px-3 py-2 text-sm tnum focus:outline-none focus:ring-2 focus:ring-gold"
            value={targetKcal}
            onChange={e => onTargetKcal(Number(e.target.value))}
            step="50"
          />
        </div>

        {/* Favorite breakfast */}
        <div>
          <p className="text-xs font-semibold text-mut mb-2">Favoritfrukost (samma varje dag)</p>
          <select
            className="w-full border border-line bg-soft text-ink rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
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
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#2a1d08]"
          style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
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
  const { tile, Icon } = MEAL_TILES[mealType];

  return (
    <div className={`rounded-xl border text-left text-xs transition-all ${
      meal.locked ? 'border-gold' :
      empty ? 'border-dashed border-line bg-card' :
      'border-line bg-card'
    }`}
      style={meal.locked ? { background: 'rgba(233,193,120,.1)' } : undefined}>
      <button
        className="w-full p-2.5 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-start gap-1.5">
          <span className={`vh-tile vh-tile--${tile} w-6 h-6 flex-shrink-0`}><Icon size={13} /></span>
          <div className="flex-1 min-w-0">
            {empty ? (
              <p className="text-faint text-[11px]">+ Lägg till</p>
            ) : (
              <>
                <p className="font-medium text-ink leading-tight truncate">{meal.recipeName}</p>
                {kcalForCell > 0 && (
                  <p className="text-faint text-[10px] mt-0.5 tnum">{kcalForCell} kcal</p>
                )}
              </>
            )}
          </div>
          {meal.locked && <span className="text-gold text-[10px] flex-shrink-0">🔒</span>}
        </div>
      </button>

      {open && (
        <div className="border-t border-line p-2 space-y-2">
          {/* Servings */}
          {!empty && (
            <div className="flex items-center justify-between">
              <span className="text-mut text-[11px]">Portioner</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onUpdate({ ...meal, servings: Math.max(1, meal.servings - 1) })}
                  className="w-5 h-5 rounded-md bg-soft flex items-center justify-center text-mut hover:bg-white/10">−</button>
                <span className="w-5 text-center text-xs font-semibold text-ink tnum">{meal.servings}</span>
                <button onClick={() => onUpdate({ ...meal, servings: meal.servings + 1 })}
                  className="w-5 h-5 rounded-md bg-soft flex items-center justify-center text-mut hover:bg-white/10">+</button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1.5">
            {!empty && (
              <button onClick={shuffle} className="flex-1 py-1.5 rounded-lg bg-soft text-mut text-[11px] font-medium hover:bg-white/10 flex items-center justify-center gap-1">
                <Shuffle size={11} /> Byt
              </button>
            )}
            {!empty && (
              <button onClick={toggleLock} className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 ${
                meal.locked ? 'text-gold' : 'bg-soft text-mut hover:bg-white/10'
              }`}
                style={meal.locked ? { background: 'rgba(233,193,120,.14)' } : undefined}>
                {meal.locked ? '🔒 Lås' : '🔓 Lås'}
              </button>
            )}
            {!empty && (
              <button onClick={clear} className="flex-1 py-1.5 rounded-lg text-coral text-[11px] font-medium hover:bg-[rgba(255,143,122,0.12)]" style={{ background: 'rgba(255,143,122,.08)' }}>
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
                  meal.recipeId === r.id ? 'text-gold' : 'hover:bg-white/5 text-mut'
                }`}
                style={meal.recipeId === r.id ? { background: 'rgba(233,193,120,.12)' } : undefined}
              >
                {r.name}
                {r.nutritionPerServing.kcal > 0 && (
                  <span className="ml-1 text-faint tnum">· {r.nutritionPerServing.kcal} kcal</span>
                )}
              </button>
            ))}
            {recipes.length === 0 && (
              <p className="text-faint text-center py-2">Inga recept sparade</p>
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
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [priceDB, setPriceDB] = useState<PriceEntry[]>([]);
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
    Promise.all([
      loadRecipes(user.uid),
      loadPantry(user.uid),
      loadPriceDB(user.uid),
    ]).then(([r, p, db]) => {
      setRecipes(r);
      setPantry(p);
      setPriceDB(db);
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
    <div className="min-h-full bg-bg text-ink pb-20">
      <PageBanner
        img="/img/f-meal5.jpg"
        eyebrow="Kost"
        title="Måltidsplan"
        subtitle="Generera veckan, byt måltider och exportera inköpslistan."
        onBack={() => setFitnessPage('home')}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-white/80 hover:text-white border border-white/15 backdrop-blur transition-colors"
              style={{ background: 'rgba(255,255,255,.08)' }}
            >
              <Settings size={16} />
            </button>
            <button
              onClick={regenerate}
              disabled={!recipes.length}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#2a1d08] disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
            >
              <RefreshCw size={14} />
              Generera
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="border-b border-line">
        <div className="flex max-w-[1100px] mx-auto px-5 sm:px-8 lg:px-10">
          {(['plan', 'shopping'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? 'border-gold text-gold' : 'border-transparent text-mut hover:text-ink'
              }`}
            >
              {tab === 'plan' ? '📅 Plan' : <><ShoppingCart size={14} />Inköpslista</>}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'shopping' ? (
        <div className="max-w-[900px] mx-auto px-5 sm:px-8 lg:px-10 py-6">
          <ShoppingList plan={plan} recipes={recipes} pantry={pantry} priceDB={priceDB} />
        </div>
      ) : (
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 lg:px-10 py-6 space-y-4">
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
                      ? 'text-[#2a1d08]'
                      : 'bg-card border border-line text-mut hover:bg-white/5'
                  }`}
                  style={selectedDay === d ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
                >
                  <span>{day}</span>
                  {tots.kcal > 0 && (
                    <span className={`text-[10px] mt-0.5 tnum ${selectedDay === d ? 'text-[#2a1d08]/70' : 'text-faint'}`}>
                      {tots.kcal} kcal
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* Left: selected day */}
          <div className="space-y-4">
          {/* Day totals bar */}
          {todayTotals.kcal > 0 && (
            <div className="bg-card border border-line rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-mut">{DAYS[selectedDay]}ens totaler</p>
                <p className={`text-xs font-semibold tnum ${
                  todayTotals.kcal > targetKcal ? 'text-coral' : 'text-cyan'
                }`}>
                  {todayTotals.kcal} / {targetKcal} kcal
                </p>
              </div>
              <div className="h-2 bg-soft rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${
                    kcalPct >= 100 ? 'bg-coral' : kcalPct >= 80 ? 'bg-cyan' : 'bg-gold'
                  }`}
                  style={{ width: `${kcalPct}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Protein', val: `${Math.round(todayTotals.protein)}g`, color: 'text-cyan' },
                  { label: 'Fett', val: `${Math.round(todayTotals.fat)}g`, color: 'text-violet' },
                  { label: 'Kolh', val: `${Math.round(todayTotals.carbs)}g`, color: 'text-gold' },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-[10px] text-faint">{m.label}</p>
                    <p className={`font-display text-sm tnum ${m.color}`}>{m.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meals for selected day */}
          <div className="space-y-2">
            {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(mt => (
              <div key={mt}>
                <p className="text-xs font-semibold text-faint uppercase tracking-wide mb-1.5">
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
            <div className="text-center py-8 bg-card rounded-2xl border border-dashed border-line">
              <p className="text-faint text-sm">Inga recept ännu</p>
              <p className="text-faint text-xs mt-1">Importera recept för att generera en veckoplan</p>
              <button
                onClick={() => setFitnessPage('recipes')}
                className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-[#2a1d08]"
                style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
              >
                Gå till Recept
              </button>
            </div>
          )}
          </div>

          {/* Right: whole-week overview (compact) */}
          {recipes.length > 0 && (
            <div className="bg-card border border-line rounded-xl overflow-hidden lg:sticky lg:top-6">
              <p className="px-4 pt-4 pb-2 text-xs font-semibold text-faint uppercase tracking-wide">Hela veckan</p>
              {DAYS.map((day, d) => {
                const tots = dayTotals(plan[d]);
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-t border-line hover:bg-white/5 transition-colors"
                    style={selectedDay === d ? { background: 'rgba(233,193,120,.1)' } : undefined}
                  >
                    <span className={`text-sm font-medium w-8 ${selectedDay === d ? 'text-gold' : 'text-mut'}`}>{day}</span>
                    <div className="flex-1 grid grid-cols-3 gap-1 text-[11px] text-mut">
                      {(['breakfast', 'lunch', 'dinner'] as MealType[]).map(mt => (
                        <span key={mt} className="truncate">
                          {plan[d][mt].recipeName || '–'}
                        </span>
                      ))}
                    </div>
                    {tots.kcal > 0 && (
                      <span className="text-[11px] text-faint flex-shrink-0 tnum">{tots.kcal} kcal</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          </div>
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
