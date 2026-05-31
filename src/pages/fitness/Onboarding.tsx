import { useState } from 'react';
import { ChevronRight, ChevronLeft, Dumbbell, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Gender, PrimaryGoal, ExperienceLevel, ActivityLevel, Contraceptive, ActiveModule, UserProfile } from '../../types';
import { calculateBMR, calculateTDEE, calculateMacroTargets, getAgeFromBirthDate } from '../../utils/calculations';
import { saveUserProfile } from '../../lib/db';

// ── Utrustning ────────────────────────────────────────────────────────────────

const EQUIPMENT_OPTIONS = [
  { id: 'barbell', label: 'Skivstång + Rack' },
  { id: 'dumbbells', label: 'Hantlar' },
  { id: 'cables', label: 'Kabelmaskiner' },
  { id: 'smith', label: 'Smith Machine' },
  { id: 'bench', label: 'Bänk' },
  { id: 'deadlift_bar', label: 'Marklyftsstång' },
  { id: 'bodyweight', label: 'Kroppsvikt / hemmagym' },
];
const FULL_GYM = EQUIPMENT_OPTIONS.map(e => e.id);
const HOME_GYM = ['dumbbells', 'bench', 'bodyweight'];
const BODYWEIGHT_ONLY = ['bodyweight'];

// ── Rekommendationslogik ──────────────────────────────────────────────────────

interface ProgramOption {
  id: string;
  name: string;
  daysPerWeek: number;
  durationWeeks: number;
  level: string;
  goal: string;
  description: string;
  days: { dayName: string; exercises: { name: string; sets: number; repsRange: string; rest: number }[] }[];
}

const PROGRAM_LIBRARY: ProgramOption[] = [
  {
    id: 'fullbody_3d',
    name: 'Helkropp 3×/vecka',
    daysPerWeek: 3,
    durationWeeks: 12,
    level: 'Nybörjare–Medel',
    goal: 'Styrka & muskler',
    description: 'Perfekt startpunkt. Tränar hela kroppen tre gånger i veckan för maximal inlärning och styrkeökning.',
    days: [
      { dayName: 'Dag A', exercises: [
        { name: 'Knäböj', sets: 3, repsRange: '6-8', rest: 180 },
        { name: 'Bänkpress', sets: 3, repsRange: '6-8', rest: 150 },
        { name: 'Skivstångsrodd', sets: 3, repsRange: '6-10', rest: 120 },
        { name: 'Romanian deadlift', sets: 2, repsRange: '10-12', rest: 120 },
        { name: 'Lateral raises', sets: 3, repsRange: '15-20', rest: 60 },
      ]},
      { dayName: 'Dag B', exercises: [
        { name: 'Marklyft', sets: 3, repsRange: '4-6', rest: 240 },
        { name: 'Militärpress', sets: 3, repsRange: '6-10', rest: 150 },
        { name: 'Latsdrag bred', sets: 3, repsRange: '10-12', rest: 90 },
        { name: 'Leg press', sets: 3, repsRange: '10-12', rest: 90 },
        { name: 'Biceps curl', sets: 3, repsRange: '10-12', rest: 60 },
      ]},
    ],
  },
  {
    id: 'upper_lower_4d',
    name: 'Upper/Lower 4×/vecka',
    daysPerWeek: 4,
    durationWeeks: 12,
    level: 'Medel',
    goal: 'Hypertrofi',
    description: 'Klassisk och bevisad split. Överkropp måndag/torsdag, underkropp tisdag/fredag.',
    days: [
      { dayName: 'Upper A', exercises: [
        { name: 'Bänkpress', sets: 4, repsRange: '6-8', rest: 150 },
        { name: 'Lutande hantelpress', sets: 3, repsRange: '8-12', rest: 90 },
        { name: 'Skivstångsrodd', sets: 4, repsRange: '6-10', rest: 150 },
        { name: 'Latsdrag bred', sets: 3, repsRange: '10-12', rest: 90 },
        { name: 'Militärpress', sets: 3, repsRange: '8-12', rest: 120 },
        { name: 'Lateral raises', sets: 4, repsRange: '15-20', rest: 60 },
        { name: 'Triceps pushdown', sets: 3, repsRange: '12-15', rest: 60 },
        { name: 'Biceps curl', sets: 3, repsRange: '10-12', rest: 60 },
      ]},
      { dayName: 'Lower A', exercises: [
        { name: 'Knäböj', sets: 4, repsRange: '6-8', rest: 180 },
        { name: 'Romanian deadlift', sets: 3, repsRange: '8-12', rest: 150 },
        { name: 'Leg press', sets: 3, repsRange: '10-15', rest: 90 },
        { name: 'Leg curl', sets: 3, repsRange: '10-12', rest: 90 },
        { name: 'Stående vadpress', sets: 4, repsRange: '15-20', rest: 60 },
      ]},
    ],
  },
  {
    id: 'ppl_6d',
    name: 'Push/Pull/Legs 6×/vecka',
    daysPerWeek: 6,
    durationWeeks: 16,
    level: 'Medel–Avancerad',
    goal: 'Maximal hypertrofi',
    description: 'Hög volym och frekvens. Kräver god återhämtning. PPL-split med dubbel frekvens per muskelgrupp.',
    days: [
      { dayName: 'Push A', exercises: [
        { name: 'Bänkpress', sets: 4, repsRange: '4-6', rest: 180 },
        { name: 'Lutande hantelpress', sets: 3, repsRange: '8-12', rest: 90 },
        { name: 'Kabelflyes', sets: 3, repsRange: '12-15', rest: 60 },
        { name: 'Militärpress', sets: 3, repsRange: '8-12', rest: 120 },
        { name: 'Lateral raises', sets: 4, repsRange: '15-20', rest: 60 },
        { name: 'Triceps pushdown', sets: 3, repsRange: '12-15', rest: 60 },
        { name: 'Overhead triceps extension', sets: 3, repsRange: '10-15', rest: 60 },
      ]},
      { dayName: 'Pull A', exercises: [
        { name: 'Marklyft', sets: 3, repsRange: '4-6', rest: 240 },
        { name: 'Skivstångsrodd', sets: 4, repsRange: '6-10', rest: 150 },
        { name: 'Latsdrag bred', sets: 3, repsRange: '10-12', rest: 90 },
        { name: 'Seated cable row', sets: 3, repsRange: '10-12', rest: 90 },
        { name: 'Face pulls', sets: 3, repsRange: '15-20', rest: 60 },
        { name: 'Hammer curl', sets: 3, repsRange: '10-12', rest: 60 },
        { name: 'Biceps curl', sets: 3, repsRange: '10-12', rest: 60 },
      ]},
      { dayName: 'Legs A', exercises: [
        { name: 'Knäböj', sets: 4, repsRange: '4-6', rest: 240 },
        { name: 'Romanian deadlift', sets: 3, repsRange: '8-12', rest: 150 },
        { name: 'Leg press', sets: 3, repsRange: '10-15', rest: 90 },
        { name: 'Leg curl', sets: 3, repsRange: '10-12', rest: 90 },
        { name: 'Leg extension', sets: 3, repsRange: '12-15', rest: 60 },
        { name: 'Stående vadpress', sets: 4, repsRange: '15-20', rest: 60 },
      ]},
    ],
  },
  {
    id: 'pure_bodybuilding_ul',
    name: 'Pure Bodybuilding – Upper/Lower',
    daysPerWeek: 4,
    durationWeeks: 16,
    level: 'Medel–Avancerad',
    goal: 'Maximal hypertrofi',
    description: 'Det vetenskapligt optimerade valet för muskeltillväxt. Inspirerat av Jeff Nippards forskning. Hög volym, progressiv belastning.',
    days: [
      { dayName: 'Upper A', exercises: [
        { name: 'Bänkpress', sets: 4, repsRange: '4-6', rest: 180 },
        { name: 'Lutande DB Press', sets: 3, repsRange: '8-12', rest: 90 },
        { name: 'Kabelflyes', sets: 3, repsRange: '12-15', rest: 60 },
        { name: 'Militärpress', sets: 3, repsRange: '8-12', rest: 120 },
        { name: 'Lateral Raises', sets: 4, repsRange: '15-20', rest: 60 },
        { name: 'Triceps Pushdown', sets: 3, repsRange: '12-15', rest: 60 },
      ]},
      { dayName: 'Lower A', exercises: [
        { name: 'Knäböj', sets: 4, repsRange: '6-8', rest: 210 },
        { name: 'Romanian Deadlift', sets: 3, repsRange: '8-12', rest: 150 },
        { name: 'Leg Press', sets: 3, repsRange: '10-15', rest: 90 },
        { name: 'Leg Curl', sets: 3, repsRange: '10-12', rest: 90 },
        { name: 'Stående Vadpress', sets: 4, repsRange: '15-20', rest: 60 },
      ]},
    ],
  },
];

function recommendPrograms(days: number, level: ExperienceLevel, goal: PrimaryGoal): string[] {
  const scores: Record<string, number> = {};
  for (const p of PROGRAM_LIBRARY) {
    let score = 0;
    // Dagar-matchning
    if (Math.abs(p.daysPerWeek - days) === 0) score += 3;
    else if (Math.abs(p.daysPerWeek - days) === 1) score += 1;
    // Nivå
    if (level === 'beginner' && p.id === 'fullbody_3d') score += 3;
    if (level === 'intermediate' && (p.id === 'upper_lower_4d' || p.id === 'pure_bodybuilding_ul')) score += 3;
    if (level === 'advanced' && p.id === 'ppl_6d') score += 3;
    // Mål
    if ((goal === 'gain_muscle' || goal === 'recomp') && p.id === 'pure_bodybuilding_ul') score += 2;
    if (goal === 'maintain' && p.id === 'fullbody_3d') score += 2;
    scores[p.id] = score;
  }
  return PROGRAM_LIBRARY
    .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
    .map(p => p.id);
}

// ── Förhandsgranskningsmodal ───────────────────────────────────────────────────

function PreviewModal({ program, onSelect, onClose }: {
  program: ProgramOption;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{program.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{program.durationWeeks} veckor · {program.daysPerWeek} dagar/vecka · {program.level}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 flex-shrink-0">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">{program.description}</p>
          {program.days.map((day, di) => (
            <div key={di}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{day.dayName}</p>
              <div className="space-y-1.5">
                {day.exercises.map((ex, ei) => (
                  <div key={ei} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 flex-shrink-0">{ei + 1}</span>
                    <div>
                      <p className="text-sm text-gray-800">{ex.name}</p>
                      <p className="text-xs text-gray-400">{ex.sets} set × {ex.repsRange} reps · {ex.rest >= 60 ? `${Math.floor(ex.rest/60)} min` : `${ex.rest}s`} vila</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onSelect} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">
            Välj detta program
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Huvud-komponent ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const { userProfile, setUserProfile, setFitnessPage } = useStore();
  const { user } = useAuthStore();

  // Totalt antal steg (8 om female, annars 8; steg 8 visas konditionellt)
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [previewProgram, setPreviewProgram] = useState<ProgramOption | null>(null);

  // Steg 1 – Kön
  const [gender, setGender] = useState<Gender>('male');

  // Steg 2 – Grundmått
  const [birthYear, setBirthYear] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Steg 3 – Mål
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>('gain_muscle');

  // Steg 4 – Kroppsmål (konditionellt)
  const [targetWeight, setTargetWeight] = useState('');
  const [weeklyChange, setWeeklyChange] = useState('-0.5');

  // Steg 5 – Erfarenhet
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate');

  // Steg 6 – Träningsdagar + utrustning
  const [trainingDays, setTrainingDays] = useState(4);
  const [equipment, setEquipment] = useState<string[]>(FULL_GYM);

  // Steg 7 – Programval
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  // Steg 8 – Menscykel
  const [cycleEnabled, setCycleEnabled] = useState(false);
  const [lastPeriod, setLastPeriod] = useState('');
  const [cycleLength, setCycleLength] = useState('28');
  const [contraceptive, setContraceptive] = useState<Contraceptive>('none');

  const showGoalStep = primaryGoal === 'lose_fat' || primaryGoal === 'gain_muscle' || primaryGoal === 'recomp';
  const showCycleStep = gender === 'female';

  // Bygg en steg-lista dynamiskt
  const steps = [
    1, // Kön
    2, // Grundmått
    3, // Mål
    ...(showGoalStep ? [4] : []),   // Kroppsmål (konditionellt)
    5, // Erfarenhet
    6, // Träningsdagar + utrustning
    7, // Programval
    ...(showCycleStep ? [8] : []),  // Menscykel (konditionellt)
    9, // Klar
  ];

  const totalSteps = steps.length;
  const currentStepIndex = steps.indexOf(step);
  const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;

  function nextStep() {
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  }
  function prevStep() {
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  }
  function skipStep() { nextStep(); }

  function toggleEquipment(id: string) {
    setEquipment(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  }

  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    const now = Date.now();

    // Bygg birthDate från år
    const birthDate = birthYear ? `${birthYear}-06-15` : undefined; // approximation
    const age = birthDate ? getAgeFromBirthDate(birthDate) : undefined;

    let bmr: number | undefined;
    let estimatedTDEE: number | undefined;
    const w = weight ? parseFloat(weight) : undefined;
    const h = height ? parseFloat(height) : undefined;

    if (w && h && age) {
      bmr = Math.round(calculateBMR(w, h, age, gender));
      estimatedTDEE = calculateTDEE(bmr, 'moderately_active');
    }

    let macros = {};
    if (estimatedTDEE && w) {
      macros = calculateMacroTargets(
        estimatedTDEE,
        w,
        primaryGoal,
        weeklyChange ? parseFloat(weeklyChange) : undefined,
      );
    }

    const selectedProgram = PROGRAM_LIBRARY.find(p => p.id === selectedProgramId);

    const newProfile: UserProfile = {
      ...(userProfile ?? {
        uid: user.uid,
        displayName: user.displayName ?? undefined,
        email: user.email ?? undefined,
        activeModules: ['fitness'] as ActiveModule[],
        onboardingCompletedModules: [],
        activityLevel: 'moderately_active' as ActivityLevel,
        dietaryPreferences: [],
        cookingTimePreference: 'moderate' as const,
        mealVariationPreference: 'medium' as const,
        batchCookingEnabled: false,
        breakfastPreference: 'full_variation' as const,
        sleepTargetHours: 8,
        stepsTargetDaily: 8000,
        createdAt: now,
        appVersion: '1.0.0',
      }),
      gender,
      birthDate,
      height: h,
      currentWeight: w,
      primaryGoal,
      targetWeight: targetWeight ? parseFloat(targetWeight) : undefined,
      weeklyWeightChangeTarget: weeklyChange ? parseFloat(weeklyChange) : undefined,
      experienceLevel,
      trainingDaysPerWeek: trainingDays,
      availableEquipment: equipment,
      activeProgramId: selectedProgramId ?? undefined,
      activeProgramStartDate: selectedProgram ? new Date().toISOString().slice(0, 10) : undefined,
      cycleTrackingEnabled: showCycleStep ? cycleEnabled : undefined,
      lastPeriodStartDate: cycleEnabled && lastPeriod ? lastPeriod : undefined,
      averageCycleLength: cycleEnabled ? parseInt(cycleLength) || 28 : undefined,
      contraceptive: showCycleStep ? contraceptive : undefined,
      bmr,
      estimatedTDEE,
      onboardingCompletedModules: [
        ...(userProfile?.onboardingCompletedModules ?? []),
        'fitness' as ActiveModule,
      ],
      updatedAt: now,
      ...macros,
    };

    setUserProfile(newProfile);
    try {
      await saveUserProfile(user.uid, newProfile);
    } catch (e) {
      console.error('Kunde inte spara profil:', e);
    }

    setSaving(false);
    setFitnessPage(selectedProgramId ? 'program' : 'home');
  }

  const recommendedIds = recommendPrograms(trainingDays, experienceLevel, primaryGoal);
  const sortedPrograms = [...PROGRAM_LIBRARY].sort(
    (a, b) => recommendedIds.indexOf(a.id) - recommendedIds.indexOf(b.id)
  );

  return (
    <div className="min-h-full bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Dumbbell size={18} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Träningsprofil</h1>
              <p className="text-xs text-gray-400">Steg {currentStepIndex + 1} av {totalSteps}</p>
            </div>
          </div>
          {step !== 9 && (
            <button onClick={skipStep} className="text-xs text-gray-400 hover:text-gray-600">
              Hoppa över →
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-5">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Steg-innehåll */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4"
          >

            {/* Steg 1 – Kön */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 text-lg">Berätta lite om dig själv</h2>
                <p className="text-sm text-gray-400">Används för att beräkna kalorier och visa rätt rekommendationer.</p>
                <div className="space-y-2">
                  {([
                    { id: 'male', label: 'Man' },
                    { id: 'female', label: 'Kvinna' },
                    { id: 'prefer_not_to_say', label: 'Föredrar att inte ange' },
                  ] as const).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setGender(id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center justify-between ${
                        gender === id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`text-sm font-medium ${gender === id ? 'text-emerald-700' : 'text-gray-800'}`}>{label}</span>
                      {gender === id && <Check size={16} className="text-emerald-600" />}
                    </button>
                  ))}
                </div>
                {gender === 'female' && (
                  <p className="text-xs text-blue-600 bg-blue-50 rounded-xl px-3 py-2">
                    Du får frågor om menscykeln senare – kan förbättra tränings­rekommendationerna.
                  </p>
                )}
              </div>
            )}

            {/* Steg 2 – Grundmått */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 text-lg">Dina grundmått</h2>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Födelseår</label>
                    <input
                      type="number"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="1995"
                      value={birthYear}
                      onChange={e => setBirthYear(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Längd (cm)</label>
                    <input
                      type="number"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="80.0"
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                    />
                  </div>
                </div>
                {birthYear && height && weight && (
                  <div className="bg-emerald-50 rounded-xl px-4 py-3">
                    <p className="text-xs text-emerald-700 font-medium">
                      Beräknat TDEE: ~{calculateTDEE(
                        calculateBMR(parseFloat(weight), parseFloat(height), new Date().getFullYear() - parseInt(birthYear), gender),
                        'moderately_active'
                      ).toLocaleString('sv-SE')} kcal/dag
                    </p>
                    <p className="text-xs text-emerald-600 mt-0.5">Baserat på måttlig aktivitetsnivå</p>
                  </div>
                )}
              </div>
            )}

            {/* Steg 3 – Mål */}
            {step === 3 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-gray-900 text-lg">Vad är ditt primära mål?</h2>
                {([
                  { id: 'lose_fat',       emoji: '🔥', label: 'Förlora kroppsfett',     desc: 'Gå ner i fettprocent, bevara muskelmassa' },
                  { id: 'gain_muscle',    emoji: '💪', label: 'Bygga muskelmassa',       desc: 'Öka styrka och muskler med minsta möjliga fettökning' },
                  { id: 'recomp',         emoji: '⚡', label: 'Recomp – båda samtidigt', desc: 'Mest effektivt vid måttlig fettprocent' },
                  { id: 'maintain',       emoji: '⚖️', label: 'Bibehålla',              desc: 'Håll nuvarande vikt och komposition' },
                  { id: 'general_health', emoji: '🏃', label: 'Allmän hälsa',           desc: 'Röra på sig, må bra, inga specifika krav' },
                ] as const).map(({ id, emoji, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => setPrimaryGoal(id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      primaryGoal === id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-medium ${primaryGoal === id ? 'text-emerald-700' : 'text-gray-800'}`}>
                      {emoji} {label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Steg 4 – Kroppsmål (konditionellt) */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 text-lg">Hur specifik vill du vara?</h2>
                <p className="text-sm text-gray-400">Alla fält är valfria – du kan ändra detta senare.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Målvikt (kg)</label>
                    <input type="number" step="0.1" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="75.0" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Veckoförändring (kg/v)</label>
                    <input type="number" step="0.1" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="-0.5" value={weeklyChange} onChange={e => setWeeklyChange(e.target.value)} />
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-blue-700">ℹ️ Vi rekommenderar aldrig mer än 1% kroppsvikt per vecka. Det minskar risken för muskelmassaförlust.</p>
                </div>
              </div>
            )}

            {/* Steg 5 – Erfarenhet */}
            {step === 5 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-gray-900 text-lg">Hur länge har du tränat styrketräning?</h2>
                {([
                  { id: 'beginner',     emoji: '🌱', label: 'Nybörjare',  sub: 'Mindre än 1 år',  desc: 'Snabb styrkeökning, alla program fungerar' },
                  { id: 'intermediate', emoji: '💪', label: 'Medelnivå',  sub: '1–3 år',           desc: 'Etablerade lyft, behöver mer strukturerat program' },
                  { id: 'advanced',     emoji: '🏆', label: 'Avancerad',  sub: 'Mer än 3 år',      desc: 'Långsam progression, behöver avancerad periodisering' },
                ] as const).map(({ id, emoji, label, sub, desc }) => (
                  <button key={id} onClick={() => setExperienceLevel(id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${experienceLevel === id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className={`text-sm font-medium ${experienceLevel === id ? 'text-emerald-700' : 'text-gray-800'}`}>{emoji} {label} – <span className="font-normal">{sub}</span></p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Steg 6 – Träningsdagar + utrustning */}
            {step === 6 && (
              <div className="space-y-5">
                <h2 className="font-semibold text-gray-900 text-lg">Ditt träningsschema</h2>
                <div>
                  <p className="text-sm text-gray-700 font-medium mb-3">Hur många dagar per vecka kan du styrketräna?</p>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5, 6].map(d => (
                      <button key={d} onClick={() => setTrainingDays(d)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${trainingDays === d ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {trainingDays <= 3 ? 'Helkroppsträning rekommenderas' : trainingDays === 4 ? 'Upper/Lower-split rekommenderas' : 'Push/Pull/Legs rekommenderas'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-700 font-medium mb-2">Tillgänglig utrustning</p>
                  <div className="flex gap-2 mb-3">
                    {[{ label: 'Fullt gym', preset: FULL_GYM }, { label: 'Hemmagym', preset: HOME_GYM }, { label: 'Kroppsvikt', preset: BODYWEIGHT_ONLY }].map(({ label, preset }) => (
                      <button key={label} onClick={() => setEquipment(preset)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-emerald-50 hover:text-emerald-700 transition-colors">{label}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {EQUIPMENT_OPTIONS.map(({ id, label }) => {
                      const on = equipment.includes(id);
                      return (
                        <button key={id} onClick={() => toggleEquipment(id)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors ${on ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'}`}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${on ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                            {on && <Check size={10} className="text-white" />}
                          </div>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Steg 7 – Programval */}
            {step === 7 && (
              <div className="space-y-3">
                <h2 className="font-semibold text-gray-900 text-lg">Välj ditt träningsprogram</h2>
                <p className="text-xs text-gray-400">Sorterat efter vad som passar dig bäst.</p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {sortedPrograms.map((p, i) => {
                    const recommended = i === 0;
                    const on = selectedProgramId === p.id;
                    return (
                      <div key={p.id} className={`rounded-xl border p-4 transition-colors ${on ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                        {recommended && <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mb-2 inline-block">⭐ REKOMMENDERAS FÖR DIG</span>}
                        <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.daysPerWeek} dagar/vecka · {p.durationWeeks} veckor · {p.level}</p>
                        <p className="text-xs text-gray-500 mt-1">{p.description}</p>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setSelectedProgramId(p.id)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${on ? 'bg-emerald-600 text-white' : 'border border-emerald-500 text-emerald-700 hover:bg-emerald-50'}`}>
                            {on ? '✓ Vald' : 'Välj'}
                          </button>
                          <button onClick={() => setPreviewProgram(p)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">Förhandsgranska ↗</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => { setSelectedProgramId(null); nextStep(); }} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center">Börja utan program – lägg till senare</button>
              </div>
            )}

            {/* Steg 8 – Menscykel */}
            {step === 8 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 text-lg">Träna i takt med din kropp</h2>
                <p className="text-sm text-gray-400">Vill du aktivera Menscykel-hubben?</p>
                <div className="space-y-2">
                  {([{ v: true, label: 'Ja – Visa mig anpassade rekommendationer per fas' }, { v: false, label: 'Inte nu – Kan aktiveras senare i inställningar' }] as const).map(({ v, label }) => (
                    <button key={String(v)} onClick={() => setCycleEnabled(v)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center justify-between ${cycleEnabled === v ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className={`text-sm ${cycleEnabled === v ? 'text-emerald-700 font-medium' : 'text-gray-700'}`}>{label}</span>
                      {cycleEnabled === v && <Check size={16} className="text-emerald-600" />}
                    </button>
                  ))}
                </div>
                {cycleEnabled && (
                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Senaste mensstart</label>
                      <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" value={lastPeriod} onChange={e => setLastPeriod(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Genomsnittlig cykellängd: {cycleLength} dagar</label>
                      <input type="range" min={21} max={40} value={cycleLength} onChange={e => setCycleLength(e.target.value)} className="w-full accent-emerald-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-2 block">Preventivmedel</label>
                      <div className="space-y-1.5">
                        {([{ id: 'none', label: 'Inga' }, { id: 'combined_pill', label: 'Kombinerade p-piller' }, { id: 'mini_pill', label: 'Mini-piller' }, { id: 'hormonal_iud', label: 'Hormonspirel' }, { id: 'copper_iud', label: 'Kopparspiral' }, { id: 'other', label: 'Annat / Vill inte ange' }] as const).map(({ id, label }) => (
                          <button key={id} onClick={() => setContraceptive(id)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${contraceptive === id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Steg 9 – Klar */}
            {step === 9 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 text-xl">Du är klar! 🎉</h2>
                <p className="text-sm text-gray-500">Här är din profil:</p>
                <div className="space-y-2">
                  {[
                    { label: 'Mål', value: { lose_fat: '🔥 Förlora kroppsfett', gain_muscle: '💪 Bygga muskelmassa', recomp: '⚡ Recomp', maintain: '⚖️ Bibehålla', general_health: '🏃 Allmän hälsa' }[primaryGoal] },
                    weight && { label: 'Vikt', value: `${weight} kg` },
                    height && { label: 'Längd', value: `${height} cm` },
                    { label: 'Träningsdagar', value: `${trainingDays} dagar/vecka` },
                    { label: 'Erfarenhet', value: { beginner: 'Nybörjare', intermediate: 'Medel', advanced: 'Avancerad' }[experienceLevel] },
                    selectedProgramId && { label: 'Program', value: PROGRAM_LIBRARY.find(p => p.id === selectedProgramId)?.name ?? selectedProgramId },
                    (birthYear && weight && height) && {
                      label: 'Beräknat TDEE',
                      value: `~${calculateTDEE(calculateBMR(parseFloat(weight), parseFloat(height), new Date().getFullYear() - parseInt(birthYear), gender), 'moderately_active').toLocaleString('sv-SE')} kcal/dag`
                    },
                  ].filter(Boolean).map((item: any, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-500">{item.label}</span>
                      <span className="text-sm font-medium text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentStepIndex > 0 && (
            <button onClick={prevStep} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <ChevronLeft size={16} />
              Tillbaka
            </button>
          )}
          <button
            onClick={step === 9 ? handleFinish : nextStep}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Sparar...' : step === 9 ? (
              <><span>Till appen</span><Check size={16} /></>
            ) : (
              <><span>Nästa</span><ChevronRight size={16} /></>
            )}
          </button>
        </div>
      </div>

      {/* Förhandsgranskningsmodal */}
      <AnimatePresence>
        {previewProgram && (
          <PreviewModal
            program={previewProgram}
            onSelect={() => { setSelectedProgramId(previewProgram.id); setPreviewProgram(null); }}
            onClose={() => setPreviewProgram(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
