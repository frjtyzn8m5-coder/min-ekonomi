import { useState } from 'react';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { IUtensils } from '../../components/ui/Icons';
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
    <div className="min-h-full bg-bg text-ink flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="vh-tile vh-tile--gold w-9 h-9">
              <IUtensils size={18} />
            </div>
            <div>
              <h1 className="font-display text-base text-ink">Kostprofil</h1>
              <p className="text-xs text-faint tnum">Steg {step} av {TOTAL_STEPS}</p>
            </div>
          </div>
          {step < TOTAL_STEPS && (
            <button onClick={() => setStep(s => Math.min(s + 1, TOTAL_STEPS))} className="text-xs text-faint hover:text-mut">
              Hoppa över →
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="w-full bg-soft rounded-full h-1.5 mb-5">
          <div
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg,#cf9a3f,#f4d79a)' }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
            className="bg-card rounded-2xl border border-line p-6 mb-4"
          >

            {/* Steg 1 – Mål */}
            {step === 1 && (
              <div className="space-y-3">
                <h2 className="font-display text-ink text-lg">Vad är ditt primära mål?</h2>
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
                      primaryGoal === id ? 'border-gold' : 'border-line hover:border-mut'
                    }`}
                    style={primaryGoal === id ? { background: 'rgba(233,193,120,.12)' } : undefined}
                  >
                    <p className={`text-sm font-medium ${primaryGoal === id ? 'text-gold' : 'text-ink'}`}>{emoji} {label}</p>
                    <p className="text-xs text-faint mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Steg 2 – Grundmått */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-display text-ink text-lg">Dina grundmått</h2>
                <p className="text-sm text-faint">Används för att beräkna ditt dagliga kaloribehov.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-mut mb-1 block">Kön</label>
                    <div className="flex gap-2">
                      {([{ id: 'male', label: 'Man' }, { id: 'female', label: 'Kvinna' }] as const).map(({ id, label }) => (
                        <button
                          key={id}
                          onClick={() => setGender(id)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                            gender === id ? 'text-[#2a1d08]' : 'border border-line text-mut'
                          }`}
                          style={gender === id ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-mut mb-1 block">Födelseår</label>
                    <input
                      type="number"
                      className="w-full border border-line bg-soft text-ink rounded-xl px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-gold"
                      placeholder="1995"
                      value={birthYear}
                      onChange={e => setBirthYear(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-mut mb-1 block">Längd (cm)</label>
                    <input
                      type="number"
                      className="w-full border border-line bg-soft text-ink rounded-xl px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-gold"
                      placeholder="175"
                      value={height}
                      onChange={e => setHeight(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-mut mb-1 block">Vikt (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full border border-line bg-soft text-ink rounded-xl px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-gold"
                      placeholder="70.0"
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                    />
                  </div>
                </div>
                {birthYear && height && weight && gender !== 'prefer_not_to_say' && (
                  <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(233,193,120,.1)' }}>
                    <p className="text-xs text-gold font-medium tnum">
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
                <h2 className="font-display text-ink text-lg">Har du några kostpreferenser?</h2>
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
                        on ? 'border-gold' : 'border-line hover:border-mut'
                      }`}
                      style={on ? { background: 'rgba(233,193,120,.12)' } : undefined}
                    >
                      <span className={`text-sm font-medium ${on ? 'text-gold' : 'text-ink'}`}>{label}</span>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${on ? 'bg-gold border-gold' : 'border-faint'}`}>
                        {on && <Check size={11} className="text-[#2a1d08]" />}
                      </div>
                    </button>
                  );
                })}
                <p className="text-xs text-faint">Lämna tomt om du inte har några begränsningar.</p>
              </div>
            )}

            {/* Steg 4 – Tid och variation */}
            {step === 4 && (
              <div className="space-y-5">
                <h2 className="font-display text-ink text-lg">Hur lagar du helst mat?</h2>
                <div>
                  <p className="text-sm text-mut font-medium mb-2">Tid per dag</p>
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
                          cookingTime === id ? 'border-gold' : 'border-line hover:border-mut'
                        }`}
                        style={cookingTime === id ? { background: 'rgba(233,193,120,.12)' } : undefined}
                      >
                        <p className={`text-sm font-medium ${cookingTime === id ? 'text-gold' : 'text-ink'}`}>{emoji} {label}</p>
                        <p className="text-xs text-faint mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-mut font-medium mb-2">Variation i maten</p>
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
                          variation === id ? 'border-gold' : 'border-line hover:border-mut'
                        }`}
                        style={variation === id ? { background: 'rgba(233,193,120,.12)' } : undefined}
                      >
                        <p className={`text-sm font-medium ${variation === id ? 'text-gold' : 'text-ink'}`}>{label}</p>
                        <p className="text-xs text-faint mt-0.5">{desc}</p>
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
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-line text-sm font-medium text-mut hover:bg-white/5"
            >
              <ChevronLeft size={16} />
              Tillbaka
            </button>
          )}
          <button
            onClick={step < TOTAL_STEPS ? () => setStep(s => s + 1) : handleFinish}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-[#2a1d08] disabled:opacity-40 transition-colors"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
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
