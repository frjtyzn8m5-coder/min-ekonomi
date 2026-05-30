import { useState } from 'react';
import { ChevronRight, ChevronLeft, Dumbbell, Check } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { TrainingProfile } from '../../types';
import { generateProgram } from '../../utils/programGenerator';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';

// ── Hjälpfunktion: Navy-kropp­sfett ───────────────────────────────────────────

function navyBodyFat(gender: 'male' | 'female', waist: number, neck: number, height: number, hips?: number): number {
  if (gender === 'male') {
    return 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76;
  }
  return 163.205 * Math.log10(waist + (hips ?? 0) - neck) - 97.684 * Math.log10(height) - 78.387;
}

// ── Steg-definitioner ─────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

const EQUIPMENT_OPTIONS = [
  { id: 'barbell', label: 'Skivstång + Rack' },
  { id: 'dumbbells', label: 'Hantlar' },
  { id: 'cables', label: 'Kabelmaskin' },
  { id: 'smith', label: 'Smith Machine' },
  { id: 'bench', label: 'Bänk' },
  { id: 'bodyweight', label: 'Kroppsvikt' },
];

const FULL_GYM = EQUIPMENT_OPTIONS.map(e => e.id);
const HOME_GYM = ['dumbbells', 'bench', 'bodyweight'];
const BODYWEIGHT_ONLY = ['bodyweight'];

// ── Komponent ─────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { setFitnessPage } = useStore();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Formulärstate
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const [knowsBF, setKnowsBF] = useState<boolean | null>(null);
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const [neck, setNeck] = useState('');
  const [hips, setHips] = useState('');

  const [goal, setGoal] = useState<TrainingProfile['goal']>('gain_muscle');
  const [experience, setExperience] = useState<TrainingProfile['experienceLevel']>('intermediate');
  const [trainingDays, setTrainingDays] = useState(4);
  const [cardio, setCardio] = useState(false);
  const [cardioDays, setCardioDays] = useState(2);
  const [cardioType, setCardioType] = useState('Löpning');
  const [equipment, setEquipment] = useState<string[]>(FULL_GYM);
  const [injuries, setInjuries] = useState('');
  const [preferBuilt, setPreferBuilt] = useState(true);

  function toggleEquipment(id: string) {
    setEquipment(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  }

  function calcNavy(): number | undefined {
    const w = parseFloat(waist), n = parseFloat(neck), h = parseFloat(height);
    if (!w || !n || !h) return undefined;
    if (gender === 'female' && !hips) return undefined;
    return Math.max(0, navyBodyFat(gender, w, n, h, parseFloat(hips)));
  }

  async function handleFinish() {
    if (!user) return;
    setSaving(true);

    const computedBF = knowsBF === false ? calcNavy() : (bodyFat ? parseFloat(bodyFat) : undefined);

    const profile: TrainingProfile = {
      age: parseInt(age) || 25,
      gender,
      height: parseFloat(height) || 175,
      weight: parseFloat(weight) || 75,
      bodyFat: computedBF,
      goal,
      experienceLevel: experience,
      trainingDaysPerWeek: trainingDays,
      availableEquipment: equipment,
      cardioDaysPerWeek: cardio ? cardioDays : undefined,
      cardioType: cardio ? cardioType : undefined,
      injuries: injuries || undefined,
      preferBuilt,
    };

    const program = generateProgram(profile);

    try {
      await setDoc(doc(db, 'users', user.uid, 'fitness', 'trainingProfile'), profile);
      await setDoc(doc(db, 'users', user.uid, 'fitness', 'workoutProgram'), program);
    } catch (err) {
      console.error('Kunde inte spara träningsprofil:', err);
    }

    setSaving(false);
    setFitnessPage('program');
  }

  const canNext: Record<number, boolean> = {
    1: !!age && !!height && !!weight,
    2: knowsBF !== null && (knowsBF ? !!bodyFat : (!!waist && !!neck && (gender === 'male' || !!hips))),
    3: true,
    4: true,
    5: true,
    6: equipment.length > 0,
    7: true,
  };

  return (
    <div className="min-h-full bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Dumbbell size={18} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Träningsprofil</h1>
            <p className="text-xs text-gray-400">Steg {step} av {TOTAL_STEPS}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">

          {/* Steg 1 – Grundinfo */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 text-lg">Hej! Berätta lite om dig</h2>
              <p className="text-sm text-gray-400">Vi använder detta för att beräkna din TDEE och rätt träningsbelastning.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ålder</label>
                  <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="25" value={age} onChange={e => setAge(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Kön</label>
                  <div className="flex gap-2">
                    {(['male', 'female'] as const).map(g => (
                      <button key={g} onClick={() => setGender(g)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${gender === g ? 'bg-emerald-600 text-white' : 'border border-gray-200 text-gray-600'}`}>
                        {g === 'male' ? 'Man' : 'Kvinna'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Längd (cm)</label>
                  <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="180" value={height} onChange={e => setHeight(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Vikt (kg)</label>
                  <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="80" value={weight} onChange={e => setWeight(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Steg 2 – Kroppsfett */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 text-lg">Kroppssammansättning</h2>
              <p className="text-sm text-gray-400">Vet du ditt ungefärliga kroppsfett?</p>
              <div className="flex gap-3">
                {[true, false].map(v => (
                  <button key={String(v)} onClick={() => setKnowsBF(v)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${knowsBF === v ? 'bg-emerald-600 text-white' : 'border border-gray-200 text-gray-600'}`}>
                    {v ? 'Ja, jag vet' : 'Nej, mät åt mig'}
                  </button>
                ))}
              </div>
              {knowsBF === true && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Kroppsfett %</label>
                  <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="15" value={bodyFat} onChange={e => setBodyFat(e.target.value)} />
                </div>
              )}
              {knowsBF === false && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Mät med ett måttband (cm):</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Midjemått</label>
                      <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="85" value={waist} onChange={e => setWaist(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Halsmått</label>
                      <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="38" value={neck} onChange={e => setNeck(e.target.value)} />
                    </div>
                    {gender === 'female' && (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Höftmått</label>
                        <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="95" value={hips} onChange={e => setHips(e.target.value)} />
                      </div>
                    )}
                  </div>
                  {waist && neck && height && (gender === 'male' || hips) && (
                    <div className="bg-emerald-50 rounded-xl px-3 py-2">
                      <p className="text-sm text-emerald-700 font-medium">
                        Beräknat kroppsfett: ~{calcNavy()?.toFixed(1)}%
                      </p>
                      <p className="text-xs text-emerald-600 mt-0.5">Navy-metoden</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Steg 3 – Mål */}
          {step === 3 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-900 text-lg">Vad är ditt primära mål?</h2>
              {([
                { id: 'lose_fat', label: '🔥 Gå ner i kroppsfett', desc: 'Kalorirestriktion + bevara muskler' },
                { id: 'gain_muscle', label: '💪 Bygga muskler', desc: 'Hypertrofi-fokus, 6-12 reps' },
                { id: 'recomp', label: '⚡ Recomp', desc: 'Gå ner i fett och bygga muskler samtidigt' },
                { id: 'strength', label: '🏋️ Bli starkare', desc: 'Styrka/1RM, 3-6 reps, långa vilor' },
                { id: 'endurance', label: '🏃 Förbättra kondition', desc: 'Mer cardio, lättare styrketräning' },
              ] as const).map(({ id, label, desc }) => (
                <button key={id} onClick={() => setGoal(id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${goal === id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className={`text-sm font-medium ${goal === id ? 'text-emerald-700' : 'text-gray-800'}`}>{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Steg 4 – Erfarenhet */}
          {step === 4 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-900 text-lg">Träningserfarenhet</h2>
              <p className="text-sm text-gray-400">Hur länge har du tränat regelbundet?</p>
              {([
                { id: 'beginner', label: 'Nybörjare', desc: 'Mindre än 1 år, lär sig grundrörelserna' },
                { id: 'intermediate', label: 'Medel', desc: '1–3 år, kan de flesta övningar med god teknik' },
                { id: 'advanced', label: 'Avancerad', desc: '3+ år, behöver avancerad periodisering' },
              ] as const).map(({ id, label, desc }) => (
                <button key={id} onClick={() => setExperience(id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${experience === id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className={`text-sm font-medium ${experience === id ? 'text-emerald-700' : 'text-gray-800'}`}>{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Steg 5 – Schema */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-gray-900 text-lg">Träningsschema</h2>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-700 font-medium">Styrketräningsdagar per vecka</label>
                  <span className="text-lg font-bold text-emerald-600">{trainingDays}</span>
                </div>
                <input type="range" min={2} max={6} value={trainingDays} onChange={e => setTrainingDays(parseInt(e.target.value))}
                  className="w-full accent-emerald-500" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {trainingDays <= 3 ? 'Helkroppsträning 3×/vecka rekommenderas' :
                   trainingDays === 4 ? 'Upper/Lower 4×/vecka rekommenderas' :
                   'Push/Pull/Ben rekommenderas'}
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-gray-700 font-medium">Tränar du kondition också?</label>
                  <button onClick={() => setCardio(v => !v)}
                    className={`w-10 h-6 rounded-full transition-colors relative ${cardio ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                    <span className={`block w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${cardio ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
                {cardio && (
                  <div className="space-y-3 pl-1">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Typ av konditionsträning</label>
                      <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Löpning, cykling, HIIT..." value={cardioType} onChange={e => setCardioType(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Dagar per vecka: {cardioDays}</label>
                      <input type="range" min={1} max={5} value={cardioDays} onChange={e => setCardioDays(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Steg 6 – Utrustning */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 text-lg">Tillgänglig utrustning</h2>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Fullt gym', preset: FULL_GYM },
                  { label: 'Hemmagym', preset: HOME_GYM },
                  { label: 'Kroppsvikt', preset: BODYWEIGHT_ONLY },
                ].map(({ label, preset }) => (
                  <button key={label} onClick={() => setEquipment(preset)}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                    {label}
                  </button>
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
          )}

          {/* Steg 7 – Preferenser */}
          {step === 7 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 text-lg">Sista steget!</h2>
              <div>
                <label className="text-sm text-gray-700 font-medium block mb-1">Skador eller saker att undvika?</label>
                <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" placeholder="T.ex. knäproblem, ont i axeln... (valfritt)" value={injuries} onChange={e => setInjuries(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-gray-700 font-medium block mb-2">Vill du ha ett färdigt program?</label>
                <div className="flex gap-3">
                  <button onClick={() => setPreferBuilt(true)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${preferBuilt ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'}`}>
                    🎯 Ge mig ett program
                  </button>
                  <button onClick={() => setPreferBuilt(false)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${!preferBuilt ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'}`}>
                    🔧 Bygg eget
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <ChevronLeft size={16} />
              Tillbaka
            </button>
          )}
          <button
            onClick={step < TOTAL_STEPS ? () => setStep(s => s + 1) : handleFinish}
            disabled={!canNext[step] || saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Sparar...' : step < TOTAL_STEPS ? (
              <><span>Nästa</span><ChevronRight size={16} /></>
            ) : (
              <><span>Skapa mitt program</span><Check size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
