import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings2, Trash2, Flame, Beef, Wheat, Droplets, TrendingUp, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { saveFoodEntry, deleteFoodEntry, loadFoodLog, loadFoodLogRange, saveNutritionSettings } from '../../lib/foodDb';
import { sumDayNutrition, tdeeFromProfile } from '../../utils/tdee';
import type { FoodEntry, NutritionSettings } from '../../types';
import type { SelectedFood } from '../../components/fitness/FoodSearch';

const FoodSearch = lazy(() => import('../../components/fitness/FoodSearch'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Idag';
  if (dateStr === yesterday) return 'Igår';
  return d.toLocaleDateString('sv-SE', { weekday: 'long', month: 'long', day: 'numeric' });
}

const MEAL_LABELS: Record<FoodEntry['mealType'], string> = {
  breakfast: 'Frukost',
  lunch: 'Lunch',
  dinner: 'Middag',
  snack: 'Mellanmål',
};

const MEAL_ORDER: FoodEntry['mealType'][] = ['breakfast', 'lunch', 'dinner', 'snack'];

function scaleNutrition(entry: FoodEntry): FoodEntry['nutrition'] {
  const f = entry.amount / 100;
  return {
    kcal: Math.round(entry.nutrition.kcal * f),
    protein: Math.round(entry.nutrition.protein * f * 10) / 10,
    fat: Math.round(entry.nutrition.fat * f * 10) / 10,
    carbs: Math.round(entry.nutrition.carbs * f * 10) / 10,
    fiber: entry.nutrition.fiber != null ? Math.round(entry.nutrition.fiber * f * 10) / 10 : undefined,
  };
}

// ─── Macro bar ────────────────────────────────────────────────────────────────

function MacroBar({ label, value, target, color, unit = 'g' }: {
  label: string; value: number; target: number; color: string; unit?: string;
}) {
  const pct = Math.min((value / target) * 100, 100);
  const over = value > target;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-xs font-semibold ${over ? 'text-red-500' : 'text-gray-700'}`}>
          {value}{unit} / {target}{unit}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${over ? 'bg-red-400' : color}`}
        />
      </div>
    </div>
  );
}

// ─── Settings panel ───────────────────────────────────────────────────────────

function NutritionSettingsPanel({
  settings,
  onSave,
  onClose,
}: {
  settings: NutritionSettings;
  onSave: (s: Partial<NutritionSettings>) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(settings);
  const { fitnessProfile } = useStore();

  function autoCalc() {
    // Calculate suggested targets from profile
    const tdee = tdeeFromProfile(fitnessProfile, local);
    let kcal = tdee;
    if (local.goal === 'lose_fat') kcal = Math.round(tdee * 0.8);
    if (local.goal === 'gain_muscle') kcal = Math.round(tdee * 1.1);
    const protein = Math.round(75 * 2.0); // 2g/kg of ~75kg default; in real app use current weight
    const fat = Math.round((kcal * 0.25) / 9);
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    setLocal(l => ({ ...l, targetCalories: kcal, proteinTarget: protein, carbTarget: carbs, fatTarget: fat }));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-40 bg-white flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Näringsinställningar</h2>
        <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Goal */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mål</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {([['lose_fat', 'Minska fett'], ['maintain', 'Bibehåll'], ['gain_muscle', 'Bygg muskler']] as const).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setLocal(l => ({ ...l, goal: val }))}
                className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                  local.goal === val
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Activity level */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Aktivitetsnivå</label>
          <div className="space-y-1 mt-2">
            {([
              [1.2, 'Stillasittande', 'Lite eller ingen träning'],
              [1.375, 'Lätt aktiv', '1–3 dagar/vecka'],
              [1.55, 'Måttligt aktiv', '3–5 dagar/vecka'],
              [1.725, 'Mycket aktiv', '6–7 dagar/vecka'],
              [1.9, 'Extremt aktiv', 'Fysiskt arbete + träning'],
            ] as [number, string, string][]).map(([val, lbl, desc]) => (
              <button
                key={val}
                onClick={() => setLocal(l => ({ ...l, activityLevel: val }))}
                className={`w-full px-3 py-2 rounded-xl text-left text-sm border transition-colors ${
                  local.activityLevel === val
                    ? 'bg-orange-50 border-orange-300'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <span className="font-medium text-gray-900">{lbl}</span>
                <span className="text-xs text-gray-400 ml-1">— {desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* BMR formula */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">BMR-formel</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {([['mifflin', 'Mifflin'], ['harris', 'Harris-B'], ['katch', 'Katch-M']] as const).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setLocal(l => ({ ...l, bmrFormula: val }))}
                className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                  local.bmrFormula === val
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-calculate button */}
        <button
          onClick={autoCalc}
          className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium"
        >
          Beräkna automatiskt från profil
        </button>

        {/* Manual targets */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Manuella mål</label>
          <div className="space-y-3 mt-2">
            {([
              ['targetCalories', 'Kalorier (kcal)', 'kcal'],
              ['proteinTarget', 'Protein (g)', 'g'],
              ['carbTarget', 'Kolhydrater (g)', 'g'],
              ['fatTarget', 'Fett (g)', 'g'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-500">{label}</label>
                <input
                  type="number"
                  value={local[key]}
                  onChange={e => setLocal(l => ({ ...l, [key]: Number(e.target.value) }))}
                  className="w-full mt-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={() => { onSave(local); onClose(); }}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold text-sm"
        >
          Spara
        </button>
      </div>
    </motion.div>
  );
}

// ─── Meal section ─────────────────────────────────────────────────────────────

function MealSection({
  mealType,
  entries,
  onAddFood,
  onDelete,
}: {
  mealType: FoodEntry['mealType'];
  entries: FoodEntry[];
  onAddFood: (mealType: FoodEntry['mealType']) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const mealKcal = entries.reduce((sum, e) => sum + scaleNutrition(e).kcal, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900">{MEAL_LABELS[mealType]}</span>
          {mealKcal > 0 && (
            <span className="text-xs text-gray-400">{mealKcal} kcal</span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {entries.map(entry => {
              const n = scaleNutrition(entry);
              return (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{entry.foodName}</p>
                    <p className="text-xs text-gray-400">{entry.amount}g · P {n.protein}g · F {n.fat}g · K {n.carbs}g</p>
                  </div>
                  <span className="text-sm font-medium text-gray-700 flex-shrink-0">{n.kcal} kcal</span>
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            <div className="border-t border-gray-50">
              <button
                onClick={() => onAddFood(mealType)}
                className="w-full flex items-center gap-2 px-4 py-3 text-orange-500 text-sm font-medium hover:bg-orange-50 transition-colors"
              >
                <Plus size={16} />
                Lägg till mat
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FoodLog() {
  const { setFitnessPage, nutritionSettings, setNutritionSettings, fitnessProfile } = useStore();
  const { user } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(toDateStr(new Date()));
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [weekData, setWeekData] = useState<{ date: string; kcal: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeMeal, setActiveMeal] = useState<FoodEntry['mealType']>('breakfast');
  const [weekLoaded, setWeekLoaded] = useState(false);

  // Load day entries
  const loadDay = useCallback(async (date: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await loadFoodLog(user.uid, date);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDay(currentDate);
  }, [currentDate, loadDay]);

  // Load 7-day overview once
  useEffect(() => {
    if (!user || weekLoaded) return;
    const dateTo = toDateStr(new Date());
    const dateFrom = toDateStr(new Date(Date.now() - 6 * 86400000));
    loadFoodLogRange(user.uid, dateFrom, dateTo).then(allEntries => {
      const byDate: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = toDateStr(new Date(Date.now() - i * 86400000));
        byDate[d] = 0;
      }
      for (const e of allEntries) {
        byDate[e.date] = (byDate[e.date] ?? 0) + scaleNutrition(e).kcal;
      }
      setWeekData(Object.entries(byDate).map(([date, kcal]) => ({ date, kcal: Math.round(kcal) })));
      setWeekLoaded(true);
    });
  }, [user, weekLoaded]);

  const dayNutrition = sumDayNutrition(entries.map(e => ({ ...e, nutrition: scaleNutrition(e) })));
  const { targetCalories, proteinTarget, carbTarget, fatTarget } = nutritionSettings;

  // Calorie ring percentage
  const kcalPct = Math.min((dayNutrition.kcal / targetCalories) * 100, 100);
  const kcalOver = dayNutrition.kcal > targetCalories;

  async function handleAddFood(selected: SelectedFood) {
    if (!user) return;
    const { item, amount } = selected;
    const factor = amount / 100;
    const entry: FoodEntry = {
      id: `${user.uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: currentDate,
      mealType: activeMeal,
      foodId: item.id,
      foodName: item.name,
      amount,
      nutrition: {
        kcal: item.energy_kcal,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
        fiber: item.fiber,
      },
      source: item.source,
      timestamp: Date.now(),
    };
    // Optimistic update
    setEntries(prev => [...prev, entry]);
    await saveFoodEntry(user.uid, entry);
    // Update week chart
    setWeekData(prev => prev.map(d =>
      d.date === currentDate
        ? { ...d, kcal: d.kcal + Math.round(entry.nutrition.kcal * factor) }
        : d
    ));
  }

  async function handleDelete(id: string) {
    if (!user) return;
    const entry = entries.find(e => e.id === id);
    setEntries(prev => prev.filter(e => e.id !== id));
    if (entry) {
      await deleteFoodEntry(user.uid, id);
      const n = scaleNutrition(entry);
      setWeekData(prev => prev.map(d =>
        d.date === currentDate ? { ...d, kcal: Math.max(0, d.kcal - n.kcal) } : d
      ));
    }
  }

  async function handleSaveSettings(s: Partial<NutritionSettings>) {
    setNutritionSettings(s);
    if (user) await saveNutritionSettings(user.uid, s);
  }

  const mealEntries = (meal: FoodEntry['mealType']) =>
    entries.filter(e => e.mealType === meal);

  const isToday = currentDate === toDateStr(new Date());

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setFitnessPage('home')} className="text-gray-400">
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-bold text-gray-900">Mat & Kalorier</h1>
          <button onClick={() => setShowSettings(true)} className="text-gray-400">
            <Settings2 size={20} />
          </button>
        </div>

        {/* Date navigator */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentDate(toDateStr(new Date(new Date(currentDate).getTime() - 86400000)))}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-gray-700 capitalize">
            {formatDate(currentDate)}
          </span>
          <button
            disabled={isToday}
            onClick={() => setCurrentDate(toDateStr(new Date(new Date(currentDate).getTime() + 86400000)))}
            className={`w-8 h-8 flex items-center justify-center rounded-xl ${isToday ? 'text-gray-200' : 'hover:bg-gray-100 text-gray-400'}`}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-24">

        {/* Calorie summary card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-4">
            {/* Circular progress */}
            <div className="relative flex-shrink-0">
              <svg width="80" height="80" className="-rotate-90">
                <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                <circle
                  cx="40" cy="40" r="32" fill="none"
                  stroke={kcalOver ? '#f87171' : '#f97316'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - kcalPct / 100)}`}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-sm font-bold ${kcalOver ? 'text-red-500' : 'text-gray-900'}`}>
                  {dayNutrition.kcal}
                </span>
                <span className="text-[9px] text-gray-400">kcal</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                <span>Mål: {targetCalories} kcal</span>
                <span className={kcalOver ? 'text-red-500 font-medium' : 'text-gray-400'}>
                  {kcalOver
                    ? `+${dayNutrition.kcal - targetCalories} över`
                    : `${targetCalories - dayNutrition.kcal} kvar`}
                </span>
              </div>
              <div className="space-y-2 mt-2">
                <MacroBar label="Protein" value={Math.round(dayNutrition.protein)} target={proteinTarget} color="bg-blue-400" />
                <MacroBar label="Kolhydrater" value={Math.round(dayNutrition.carbs)} target={carbTarget} color="bg-amber-400" />
                <MacroBar label="Fett" value={Math.round(dayNutrition.fat)} target={fatTarget} color="bg-rose-400" />
              </div>
            </div>
          </div>

          {/* Quick macro chips */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
            {[
              { icon: Flame, label: `${Math.round(dayNutrition.kcal)} kcal`, color: 'text-orange-500 bg-orange-50' },
              { icon: Beef, label: `${Math.round(dayNutrition.protein)}g`, color: 'text-blue-500 bg-blue-50' },
              { icon: Wheat, label: `${Math.round(dayNutrition.carbs)}g`, color: 'text-amber-500 bg-amber-50' },
              { icon: Droplets, label: `${Math.round(dayNutrition.fat)}g`, color: 'text-rose-500 bg-rose-50' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className={`flex-1 flex flex-col items-center py-1.5 rounded-xl ${color}`}>
                <Icon size={12} />
                <span className="text-[11px] font-semibold mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Meal sections */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="text-orange-400 animate-spin" />
          </div>
        ) : (
          MEAL_ORDER.map(meal => (
            <MealSection
              key={meal}
              mealType={meal}
              entries={mealEntries(meal)}
              onAddFood={(m) => { setActiveMeal(m); setShowSearch(true); }}
              onDelete={handleDelete}
            />
          ))
        )}

        {/* 7-day chart */}
        {weekData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-orange-400" />
              <span className="text-sm font-semibold text-gray-900">7 dagar</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={weekData} barSize={18}>
                <XAxis
                  dataKey="date"
                  tickFormatter={d => new Date(d + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short' })}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [`${v} kcal`, 'Kalorier']}
                  labelFormatter={d => new Date(d + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f3f4f6' }}
                />
                <ReferenceLine y={targetCalories} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Bar dataKey="kcal" fill="#fdba74" radius={[4, 4, 0, 0]}
                  label={false}
                />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-gray-400 text-center mt-1">
              Orange streckad linje = mål ({targetCalories} kcal)
            </p>
          </div>
        )}
      </div>

      {/* Search overlay */}
      <AnimatePresence>
        {showSearch && (
          <Suspense fallback={
            <div className="fixed inset-0 z-40 bg-white flex items-center justify-center">
              <Loader2 size={24} className="text-orange-400 animate-spin" />
            </div>
          }>
            <FoodSearch
              onSelect={handleAddFood}
              onClose={() => setShowSearch(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Settings overlay */}
      <AnimatePresence>
        {showSettings && (
          <NutritionSettingsPanel
            settings={nutritionSettings}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
