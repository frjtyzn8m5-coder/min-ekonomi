import { useState } from 'react';
import { ChevronRight, ChevronLeft, UtensilsCrossed, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { PrimaryGoal, Gender, ActivityLevel, ActiveModule } from '../../types';
import { calculateBMR, calculateTDEE, calculateMacroTargets } from '../../utils/calculations';
import { saveUserProfile } from '../../lib/db';

const TOTAL_STEPS = 4;

type DietPref = 'vegetarian' | 'vegan' | 'gluten_free' | 'lactose_free' | 'no_pork' | 'no_shellfish';
type CookingTime = 'minimal' | 'moderate' | 'generous';
type MealVariation = 'high' | 'medium' | 'low';

export default function NutritionOnboarding() {
  const { userProfile, setUserProfile, setModule, setFitnessPage } = useStore();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Steg 1 – Mål
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>(
    userProfile?.primaryGoal ?? 'general_health'
  );

  // Steg 2 – Grundmått
  const [birthYear, setBirthYear] = useState(userProfile?.birthDate?.slice(0, 4) ?? '');
  const [height, setHeight] = useState(userProfile?.height?.toString() ?? '');
  const [weight, setWeight] = useState(userProfile?.currentWeight?.toString() ?? '');
  const [gender, setGender] = useState<Gender>(userProfile?.gender ?? 'prefer_not_to_say');

  // Steg 3 – Kostpreferenser
  const [dietPrefs, setDietPrefs] = useState<Set<DietPref>>(
    new Set((userProfile?.dietaryPreferences ?? []) as DietPref[])
  );

  // Steg 4 – Tid och variation
  const [cookingTime, setCookingTime] = useState<CookingTime>(
    userProfile?.cookingTimePreference ?? 'moderate'
  );
  const [variation, setVariation] = useState<MealVariation>(
    userProfile?.mealVariationPreference ?? 'medium'
  );

  const progressPercent = (step / TOTAL_STEPS) * 100;

  function toggleDietPref(pref: DietPref) {
    setDietPrefs(prev => {
      const next = new Set(prev);
      if (next.has(pref)) next.delete(pref);
      else next.add(pref);
      return next;
    });
  }

  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    const now = Date.now();

    const w = weight ? parseFloat(weight) : undefined;
    const h = height ? parseFloat(height) : undefined;
    const age = birthYear ? new Date().getFullYear() - parseInt(birthYear) : undefined;

    let bmr: number | undefined;
    let estimatedTDEE: number | undefined;
    let macros = {};

    if (w && h && age) {
      bmr = Math.round(calculateBMR(w, h, age, gender));
      estimatedTDEE = calculateTDEE(bmr, 'moderately_active' as ActivityLevel);
      macros = calculateMacroTargets(estimatedTDEE, w, primaryGoal);
    }

    const updated = {
      ...(userProfile ?? {
        uid: user.uid,
        displayName: user.displayName ?? undefined,
        email: user.email ?? undefined,
        activeModules: ['nutrition'] as ActiveModule[],
        onboardingCompletedModules: [] as ActiveModule[],
        gender,
        activityLevel: 'moderately_active' as ActivityLevel,
        trainingDaysPerWeek: 0,
        experienceLevel: 'beginner' as const,
        availableEquipment: [],
        batchCookingEnabled: false,
        breakfastPreference: 'full_variation' as const,
        sleepTargetHours: 8,
        stepsTargetDaily: 8000,
        createdAt: now,
        appVersion: '1.0.0',
      }),
      gender,
      birthDate: birthYear ? `${birthYear}-06-15` : undefined,
      height: h,
      currentWeight: w,
      primaryGoal,
      dietaryPreferences: [...dietPrefs],
      cookingTimePreference: cookingTime,
      mealVariationPreference: variation,
      bmr,
      estimatedTDEE,
      onboardingCompletedModules: [
        ...(userProfile?.onboardingCompletedModules ?? []),
        'nutrition' as ActiveModule,
      ],
      updatedAt: now,
      ...macros,
    };

    setUserProfile(updated as any);
    try {
      await saveUserProfile(user.uid, updated as any);
    } catch (e) {
      console.error('Kunde inte spara profil:', e);
    }

    setSaving(false);
    setModule('fitness');
    setFitnessPage('foodlog');
  }

  return (
    <div className="min-h-full bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <UtensilsCrossed size={18} className="text-orange-500" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Kostprofil</h1>
              <p className="text-xs text-gray-400">Steg {step} av {TOTAL_STEPS}</p>
            </div>
          </div>
          {step < TOTAL_STEPS && (
            <button onClick={() => setStep(s => Math.min(s + 1, TOTAL_STEPS))} className="text-xs text-gray-400 hover:text-gray-600">
              Hoppa över →
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-5">
          <div
            className="bg-orange-400 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4"
          >

            {/* Steg 1 – Mål */}
            {step === 1 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-gray-900 text-lg">Vad är ditt primära mål?</h2>
                {([
                  { id: 'lose_fat',       emoji: '🔥', label: 'Gå ner i kroppsfett',    desc: 'Kalorirestriktion + bevara muskler' },
                  { id: 'gain_muscle',    emoji: '💪', label: 'Bygga muskelmassa',        desc: 'Kaloriöverskott + högt protein' },
                  { id: 'recomp',         emoji: '⚡', label: 'Recomp – båda samtidigt', desc: 'Runt underhållskalorier, högt protein' },
                  { id: 'maintain',       emoji: '⚖️', label: 'Bibehålla',              desc: 'Ät på underhåll' },
                  { id: 'general_health', emoji: '🥗', label: 'Allmän hälsa',           desc: 'Balanserad kost, inga strikta regler' },
                ] as const).map(({ id, emoji, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => setPrimaryGoal(id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      primaryGoal === id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-medium ${primaryGoal === id ? 'text-orange-700' : 'text-gray-800'}`}>{emoji} {label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Steg 2 – Grundmått */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 text-lg">Dina grundmått</h2>
                <p className="text-sm text-gray-400">Används för att beräkna ditt dagliga kaloribehov.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Kön</label>
                    <div className="flex gap-2">
                      {([{ id: 'male', label: 'Man' }, { id: 'female', label: 'Kvinna' }] as const).map(({ id, label }) => (
                        <button
                          key={id}
                          onClick={() => setGender(id)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                            gender === id ? 'bg-orange-400 text-white' : 'border border-gray-200 text-gray-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Födelseår</label>
                    <input
                      type="number"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="1995"
                      value={birthYear}
                      onChange={e => setBirthYear(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Längd (cm)</label>
                    <input
                      type="number"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="175"
                      value={height}
                      onChange={e => setHeight(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Vikt (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="70.0"
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                    />
                  </div>
                </div>
                {birthYear && height && weight && gender !== 'prefer_not_to_say' && (
                  <div className="bg-orange-50 rounded-xl px-4 py-3">
                    <p className="text-xs text-orange-700 font-medium">
                      Beräknat kaloribehov: ~{calculateTDEE(
                        calculateBMR(parseFloat(weight), parseFloat(height), new Date().getFullYear() - parseInt(birthYear), gender as Gender),
                        'moderately_active'
                      ).toLocaleString('sv-SE')} kcal/dag
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Steg 3 – Kostpreferenser */}
            {step === 3 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-gray-900 text-lg">Har du några kostpreferenser?</h2>
                {([
                  { id: 'vegetarian',   label: 'Vegetarisk' },
                  { id: 'vegan',        label: 'Vegansk' },
                  { id: 'gluten_free',  label: 'Glutenfritt' },
                  { id: 'lactose_free', label: 'Laktosfritt' },
                  { id: 'no_pork',      label: 'Utan fläsk' },
                  { id: 'no_shellfish', label: 'Utan skaldjur' },
                ] as const).map(({ id, label }) => {
                  const on = dietPrefs.has(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleDietPref(id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                        on ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`text-sm font-medium ${on ? 'text-orange-700' : 'text-gray-800'}`}>{label}</span>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${on ? 'bg-orange-400 border-orange-400' : 'border-gray-300'}`}>
                        {on && <Check size={11} className="text-white" />}
                      </div>
                    </button>
                  );
                })}
                <p className="text-xs text-gray-400">Lämna tomt om du inte har några begränsningar.</p>
              </div>
            )}

            {/* Steg 4 – Tid och variation */}
            {step === 4 && (
              <div className="space-y-5">
                <h2 className="font-semibold text-gray-900 text-lg">Hur lagar du helst mat?</h2>
                <div>
                  <p className="text-sm text-gray-700 font-medium mb-2">Tid per dag</p>
                  <div className="space-y-2">
                    {([
                      { id: 'minimal',  emoji: '⚡', label: 'Snabbt (< 15 min)',      desc: 'Enkla recept, batch-cooking' },
                      { id: 'moderate', emoji: '🍳', label: 'Lagom (15–45 min)',       desc: 'Normala vardagsrecept' },
                      { id: 'generous', emoji: '🧑‍🍳', label: 'Gärna mer (45+ min)', desc: 'Gillar att laga mat' },
                    ] as const).map(({ id, emoji, label, desc }) => (
                      <button
                        key={id}
                        onClick={() => setCookingTime(id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                          cookingTime === id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className={`text-sm font-medium ${cookingTime === id ? 'text-orange-700' : 'text-gray-800'}`}>{emoji} {label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-700 font-medium mb-2">Variation i maten</p>
                  <div className="space-y-2">
                    {([
                      { id: 'high',   label: 'Hög',   desc: 'Aldrig samma rätt två gånger i rad' },
                      { id: 'medium', label: 'Medel', desc: 'OK att repetera om det är gott' },
                      { id: 'low',    label: 'Låg',   desc: 'Rutinen är bra, samma frukost varje dag är fint' },
                    ] as const).map(({ id, label, desc }) => (
                      <button
                        key={id}
                        onClick={() => setVariation(id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                          variation === id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className={`text-sm font-medium ${variation === id ? 'text-orange-700' : 'text-gray-800'}`}>{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
              Tillbaka
            </button>
          )}
          <button
            onClick={step < TOTAL_STEPS ? () => setStep(s => s + 1) : handleFinish}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Sparar...' : step < TOTAL_STEPS ? (
              <><span>Nästa</span><ChevronRight size={16} /></>
            ) : (
              <><span>Till matdagboken</span><ChevronRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
