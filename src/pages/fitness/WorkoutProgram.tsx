import { useEffect, useState, type ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import type {
  WorkoutProgram, WorkoutDay, ProgramExercise,
  TrainingGoal, ExperienceLevel, ExerciseEquipment,
} from '../../types';
import {
  Dumbbell, ChevronRight, ArrowLeft, Play, Edit2, X, Plus, Trash2, Clock, RotateCcw,
  Sparkles, Check, RefreshCw,
} from 'lucide-react';
import { IDumbbell, ITrend } from '../../components/ui/Icons';
import { getExerciseByName, EQUIPMENT_LABELS } from '../../utils/exerciseUtils';
import { saveWorkoutProgram } from '../../lib/fitnessDb';
import { isDemoMode } from '../../lib/demoData';
import {
  generateProgram, GROUP_LABELS,
  type GeneratedProgram, type GenerateProgramOptions, type ProgramFocus, type MuscleGroup,
} from '../../utils/programGenerator';

// ── Hjälpare ──────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  lose_fat: '🔥 Fettförbränning',
  gain_muscle: '💪 Muskelbygge',
  recomp: '⚡ Recomp',
  strength: '🏋️ Styrka',
  endurance: '🏃 Kondition',
};

const SPLIT_LABELS: Record<string, string> = {
  full_body: 'Helkropp',
  upper_lower: 'Upper/Lower',
  ppl: 'Push/Pull/Ben',
};

const WEEK_DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

// Image-rich backgrounds for program day cards (cycled per training day)
const DAY_IMAGES = ['f-gym1', 'f-lift2', 'f-run3', 'f-hero'];
const DAY_IMG = (i: number) => `/img/${DAY_IMAGES[i % DAY_IMAGES.length]}.jpg`;

function formatRest(sec: number): string {
  if (sec >= 60) return `${Math.floor(sec / 60)} min ${sec % 60 > 0 ? `${sec % 60}s` : ''}`.trim();
  return `${sec}s`;
}

// ── SessionModal – startar ett pass i WorkoutLog-stil ─────────────────────────

interface SessionModalProps {
  day: WorkoutDay;
  onClose: () => void;
  onStartWorkout: (day: WorkoutDay) => void;
}

function SessionModal({ day, onClose, onStartWorkout }: SessionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-line rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col text-ink">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
          <div>
            <h2 className="font-display text-ink">{day.dayName}</h2>
            <p className="text-xs text-faint tnum">{day.splitLabel} · {day.exercises.length} övningar</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
            <X size={16} className="text-mut" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {day.exercises.map((ex, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(233,193,120,.15)' }}>
                <span className="text-[10px] font-bold text-gold tnum">{i + 1}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{ex.name}</p>
                <p className="text-xs text-faint tnum">
                  {ex.sets} set × {ex.repsRange} reps · <Clock size={10} className="inline" /> {formatRest(ex.rest)}
                </p>
                {ex.note && <p className="text-xs text-faint italic">{ex.note}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-line flex-shrink-0">
          <button
            onClick={() => { onClose(); onStartWorkout(day); }}
            className="w-full py-3 text-[#2a1d08] rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
          >
            <Play size={16} />
            Starta passet
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditExerciseModal ─────────────────────────────────────────────────────────

interface EditExerciseModalProps {
  exercise: ProgramExercise;
  onSave: (ex: ProgramExercise) => void;
  onClose: () => void;
}

function EditExerciseModal({ exercise, onSave, onClose }: EditExerciseModalProps) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(String(exercise.sets));
  const [reps, setReps] = useState(exercise.repsRange);
  const [rest, setRest] = useState(String(exercise.rest));
  const [note, setNote] = useState(exercise.note ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-line rounded-2xl shadow-2xl w-full max-w-sm text-ink">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-display text-ink">Redigera övning</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
            <X size={16} className="text-mut" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <input className="w-full bg-soft text-ink border border-line rounded-xl px-3 py-2.5 text-sm placeholder-faint focus:outline-none focus:ring-2 focus:ring-[rgba(233,193,120,.4)]" placeholder="Övningsnamn" value={name} onChange={e => setName(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-faint mb-1 block">Set</label>
              <input type="number" className="w-full bg-soft text-ink border border-line rounded-xl px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-[rgba(233,193,120,.4)]" value={sets} onChange={e => setSets(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-faint mb-1 block">Reps</label>
              <input className="w-full bg-soft text-ink border border-line rounded-xl px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-[rgba(233,193,120,.4)]" placeholder="8-12" value={reps} onChange={e => setReps(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-faint mb-1 block">Vila (s)</label>
              <input type="number" className="w-full bg-soft text-ink border border-line rounded-xl px-3 py-2.5 text-sm tnum focus:outline-none focus:ring-2 focus:ring-[rgba(233,193,120,.4)]" value={rest} onChange={e => setRest(e.target.value)} />
            </div>
          </div>
          <input className="w-full bg-soft text-ink border border-line rounded-xl px-3 py-2.5 text-sm placeholder-faint focus:outline-none focus:ring-2 focus:ring-[rgba(233,193,120,.4)]" placeholder="Anteckning (valfritt)" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-sm font-medium text-mut">Avbryt</button>
          <button onClick={() => onSave({ name, sets: parseInt(sets) || 3, repsRange: reps, rest: parseInt(rest) || 90, note: note || undefined })}
            className="flex-1 py-2.5 rounded-xl text-[#2a1d08] text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
            Spara
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CreateProgramView – evidensbaserad program-generator ──────────────────────

const GOAL_OPTIONS: { value: TrainingGoal; label: string }[] = [
  { value: 'gain_muscle', label: '💪 Muskelbygge' },
  { value: 'strength', label: '🏋️ Styrka' },
  { value: 'recomp', label: '⚡ Recomp' },
  { value: 'lose_fat', label: '🔥 Fettförbränning' },
  { value: 'endurance', label: '🏃 Kondition' },
];

const EXP_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: 'Nybörjare' },
  { value: 'intermediate', label: 'Medel' },
  { value: 'advanced', label: 'Avancerad' },
];

const EQUIPMENT_OPTIONS: ExerciseEquipment[] = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bench', 'rack', 'bodyweight', 'kettlebell', 'resistance_band',
];

const SESSION_LENGTHS = [45, 60, 75, 90];

const FOCUS_OPTIONS: { value: ProgramFocus; label: string }[] = [
  { value: 'balanced', label: 'Balanserat' },
  ...(Object.keys(GROUP_LABELS) as MuscleGroup[]).map((g) => ({ value: g as ProgramFocus, label: GROUP_LABELS[g] })),
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${active ? 'text-gold border-[rgba(233,193,120,.45)]' : 'text-mut border-line hover:border-[rgba(233,193,120,.25)]'}`}
      style={active ? { background: 'rgba(233,193,120,.12)' } : undefined}
    >
      {children}
    </button>
  );
}

interface CreateProgramViewProps {
  onClose: () => void;
  onActivate: (gen: GeneratedProgram) => Promise<void>;
  defaults: Partial<GenerateProgramOptions>;
}

function CreateProgramView({ onClose, onActivate, defaults }: CreateProgramViewProps) {
  const [goal, setGoal] = useState<TrainingGoal>(defaults.goal ?? 'gain_muscle');
  const [days, setDays] = useState<number>(defaults.trainingDaysPerWeek ?? 4);
  const [experience, setExperience] = useState<ExperienceLevel>(defaults.experienceLevel ?? 'intermediate');
  const [equipment, setEquipment] = useState<ExerciseEquipment[]>(
    (defaults.availableEquipment as ExerciseEquipment[])?.length
      ? (defaults.availableEquipment as ExerciseEquipment[])
      : ['barbell', 'dumbbell', 'cable', 'machine', 'bench', 'rack', 'bodyweight'],
  );
  const [sessionLength, setSessionLength] = useState<number>(60);
  const [focus, setFocus] = useState<ProgramFocus>('balanced');
  const [injuries, setInjuries] = useState<string>(defaults.injuries ?? '');
  const [seed, setSeed] = useState<number>(0);
  const [generated, setGenerated] = useState<GeneratedProgram | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [activating, setActivating] = useState(false);

  function toggleEquip(e: ExerciseEquipment) {
    setEquipment((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  }

  function runGenerate(nextSeed?: number) {
    const s = nextSeed ?? seed;
    const opts: GenerateProgramOptions = {
      goal, trainingDaysPerWeek: days, experienceLevel: experience,
      availableEquipment: equipment, sessionLengthMin: sessionLength,
      focus, injuries: injuries.trim() || undefined, seed: s,
    };
    setGenerated(generateProgram(opts));
    setActiveWeek(0);
  }

  async function handleActivate() {
    if (!generated) return;
    setActivating(true);
    try {
      await onActivate(generated);
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="min-h-full bg-bg text-ink">
      {/* Header */}
      <div className="bg-panel border-b border-line px-4 sm:px-6 lg:px-10 py-4 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto flex items-center gap-2">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 -ml-1">
            <ArrowLeft size={18} className="text-mut" />
          </button>
          <span className="vh-tile vh-tile--gold w-8 h-8"><Sparkles size={16} /></span>
          <div>
            <h1 className="font-display text-base text-ink">Skapa eget program</h1>
            <p className="text-xs text-faint">Evidensbaserad generator · volym, periodisering & deload</p>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 grid grid-cols-1 xl:grid-cols-[minmax(0,380px)_1fr] gap-6 items-start">
        {/* ── Formulär ── */}
        <div className="vh-card p-5 space-y-5">
          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-faint font-medium mb-2">Mål</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map((o) => (
                <Chip key={o.value} active={goal === o.value} onClick={() => setGoal(o.value)}>{o.label}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-faint font-medium mb-2">Pass per vecka</p>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4, 5, 6].map((d) => (
                <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d}×</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-faint font-medium mb-2">Erfarenhet</p>
            <div className="flex flex-wrap gap-2">
              {EXP_OPTIONS.map((o) => (
                <Chip key={o.value} active={experience === o.value} onClick={() => setExperience(o.value)}>{o.label}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-faint font-medium mb-2">Passlängd</p>
            <div className="flex flex-wrap gap-2">
              {SESSION_LENGTHS.map((m) => (
                <Chip key={m} active={sessionLength === m} onClick={() => setSessionLength(m)}>{m} min</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-faint font-medium mb-2">Utrustning</p>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((e) => (
                <Chip key={e} active={equipment.includes(e)} onClick={() => toggleEquip(e)}>{EQUIPMENT_LABELS[e]}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-faint font-medium mb-2">Fokus</p>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((o) => (
                <Chip key={o.value} active={focus === o.value} onClick={() => setFocus(o.value)}>{o.label}</Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-faint font-medium mb-2">Skador / begränsningar (valfritt)</p>
            <input
              className="w-full bg-soft text-ink border border-line rounded-xl px-3 py-2.5 text-sm placeholder-faint focus:outline-none focus:ring-2 focus:ring-[rgba(233,193,120,.4)]"
              placeholder="t.ex. ont i axel, känsligt knä"
              value={injuries}
              onChange={(e) => setInjuries(e.target.value)}
            />
          </div>

          <button
            onClick={() => runGenerate()}
            className="w-full py-3 text-[#2a1d08] rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
          >
            <Sparkles size={16} />
            {generated ? 'Generera om' : 'Generera program'}
          </button>
        </div>

        {/* ── Förhandsvisning ── */}
        <div>
          {!generated ? (
            <div className="vh-card p-10 text-center text-faint">
              <Dumbbell size={36} className="mx-auto mb-3 text-faint" />
              <p className="text-sm">Fyll i dina val och tryck <span className="text-gold">Generera program</span> för att se ett förslag.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Titel + meta */}
              <div className="vh-card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-display text-lg text-ink">{generated.name}</h2>
                    <p className="text-xs text-faint tnum mt-0.5">
                      {GOAL_LABELS[generated.goal]} · {SPLIT_LABELS[generated.split]} · {generated.daysPerWeek}×/vecka · {generated.blockLengthWeeks} veckor
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { const ns = seed + 1; setSeed(ns); runGenerate(ns); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-sm font-medium text-mut hover:border-[rgba(233,193,120,.3)]"
                    >
                      <RefreshCw size={14} /> Variera
                    </button>
                    <button
                      onClick={handleActivate}
                      disabled={activating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[#2a1d08] text-sm font-semibold disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
                    >
                      <Check size={15} /> {activating ? 'Aktiverar…' : 'Aktivera program'}
                    </button>
                  </div>
                </div>

                {/* Designanteckningar */}
                <ul className="mt-4 space-y-1.5">
                  {generated.designNotes.map((n, i) => (
                    <li key={i} className="flex gap-2 text-xs text-mut">
                      <span className="text-gold mt-0.5">▸</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Muskel-täckning */}
              <div className="vh-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="vh-tile vh-tile--gold w-7 h-7"><ITrend size={14} /></span>
                  <p className="text-sm font-semibold text-ink">Veckovolym per muskelgrupp</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {generated.weeklySetsPerMuscle.map((v) => {
                    const pct = Math.min(100, (v.sets / v.mav) * 100);
                    const color = v.status === 'optimal' ? '#bfe26a' : v.status === 'high' ? '#ff8f7a' : '#9b8cff';
                    return (
                      <div key={v.group}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-mut">{v.label}</span>
                          <span className="text-faint tnum">{v.sets} set <span className="opacity-60">(MEV {v.mev}/MAV {v.mav})</span></span>
                        </div>
                        <div className="h-1.5 rounded-full bg-soft overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Veckor */}
              <div className="vh-card p-5">
                <div className="flex flex-wrap gap-2 mb-4">
                  {generated.weeks.map((w, i) => (
                    <button
                      key={w.week}
                      onClick={() => setActiveWeek(i)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${activeWeek === i ? 'text-gold border-[rgba(233,193,120,.45)]' : 'text-mut border-line'}`}
                      style={activeWeek === i ? { background: 'rgba(233,193,120,.12)' } : undefined}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
                  {generated.weeks[activeWeek].days.map((day, di) => (
                    <div key={di} className="bg-card rounded-2xl border border-line overflow-hidden">
                      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                        <h3 className="font-display text-sm text-ink">{day.splitLabel}</h3>
                        <span className="text-[11px] text-faint tnum">{day.exercises.length} övningar</span>
                      </div>
                      <div className="divide-y divide-line">
                        {day.exercises.map((ex, ei) => (
                          <div key={ei} className="px-4 py-2.5">
                            <p className="text-sm font-medium text-ink">{ex.name}</p>
                            <p className="text-xs text-faint tnum">
                              {ex.sets} × {ex.repsRange} · {formatRest(ex.rest)} vila{ex.note ? ` · ${ex.note}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-faint text-center">
                Utkast genererat automatiskt – granska gärna övningsvalen innan du aktiverar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Huvud-komponent ───────────────────────────────────────────────────────────

export default function WorkoutProgramPage() {
  const { user } = useAuthStore();
  const { setFitnessPage, setPendingWorkout, setSelectedExerciseId, userProfile, updateUserProfile } = useStore();

  function openExerciseDetail(name: string) {
    const resolved = getExerciseByName(name);
    if (!resolved) return;
    setSelectedExerciseId(resolved.id);
    setFitnessPage('exercises');
  }
  const [program, setProgram] = useState<WorkoutProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'program' | 'create'>('program');
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editExercise, setEditExercise] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || isDemoMode()) { setLoading(false); return; }
    getDoc(doc(db, 'users', user.uid, 'fitness', 'workoutProgram')).then(snap => {
      if (snap.exists()) setProgram(snap.data() as WorkoutProgram);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  async function saveProgram(updated: WorkoutProgram) {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'fitness', 'workoutProgram'), updated);
      setProgram(updated);
    } catch (err) {
      console.error('Kunde inte spara program:', err);
    }
    setSaving(false);
  }

  // Aktivera ett genererat program: spara (via fitnessDb som rensar undefined),
  // uppdatera profilen (activeProgramId + startdatum + veckoräknare) och visa det.
  async function handleActivateGenerated(gen: GeneratedProgram) {
    if (!user) return;
    await saveWorkoutProgram(user.uid, gen);
    setProgram(gen);
    if (userProfile) {
      try {
        await updateUserProfile({
          activeProgramId: gen.id,
          activeProgramStartDate: new Date().toISOString().slice(0, 10),
          currentProgramWeek: 1,
          currentProgramDayIndex: 0,
        });
      } catch (err) {
        console.error('Kunde inte uppdatera profil:', err);
      }
    }
    setView('program');
  }

  function handleStartWorkout(day: WorkoutDay) {
    setPendingWorkout({ exercises: day.exercises.map(e => ({ name: e.name })), dayName: day.dayName });
    setFitnessPage('workoutlog');
  }

  function handleUpdateExercise(dayIdx: number, exIdx: number, updated: ProgramExercise) {
    if (!program) return;
    const newSchedule = program.schedule.map((d, di) =>
      di !== dayIdx ? d : { ...d, exercises: d.exercises.map((e, ei) => ei !== exIdx ? e : updated) },
    );
    const newProg = { ...program, schedule: newSchedule };
    saveProgram(newProg);
    setEditExercise(null);
  }

  function handleDeleteExercise(dayIdx: number, exIdx: number) {
    if (!program) return;
    const newSchedule = program.schedule.map((d, di) =>
      di !== dayIdx ? d : { ...d, exercises: d.exercises.filter((_, ei) => ei !== exIdx) },
    );
    saveProgram({ ...program, schedule: newSchedule });
  }

  function handleAddExercise(dayIdx: number) {
    if (!program) return;
    const blank: ProgramExercise = { name: '', sets: 3, repsRange: '8-12', rest: 90 };
    const newSchedule = program.schedule.map((d, di) =>
      di !== dayIdx ? d : { ...d, exercises: [...d.exercises, blank] },
    );
    const newProg = { ...program, schedule: newSchedule };
    setProgram(newProg);
    setEditExercise({ dayIdx, exIdx: newProg.schedule[dayIdx].exercises.length - 1 });
  }

  // Standardvärden till generatorformuläret hämtas från profilen om möjlig.
  const createDefaults: Partial<GenerateProgramOptions> = {
    experienceLevel: userProfile?.experienceLevel,
    trainingDaysPerWeek: userProfile?.trainingDaysPerWeek,
    availableEquipment: userProfile?.availableEquipment,
    injuries: userProfile?.injuries,
    goal: program?.goal,
  };

  if (view === 'create') {
    return (
      <CreateProgramView
        onClose={() => setView('program')}
        onActivate={handleActivateGenerated}
        defaults={createDefaults}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-full bg-bg flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-full bg-bg text-ink flex flex-col items-center justify-center p-6 text-center">
        <Dumbbell size={40} className="text-faint mb-3" />
        <p className="font-medium text-mut">Inget program hittat</p>
        <p className="text-sm text-faint mt-1 mb-4">Skapa ett eget program eller gör onboarding</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => setView('create')} className="px-5 py-2.5 text-[#2a1d08] rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
            <Sparkles size={16} /> Skapa eget program
          </button>
          <button onClick={() => setFitnessPage('onboarding')} className="px-5 py-2.5 rounded-xl border border-line text-sm font-medium text-mut">
            Starta onboarding
          </button>
        </div>
      </div>
    );
  }

  // Build a full week grid (7 days), inserting rest days where no training day matches
  const weekGrid = WEEK_DAYS.map(dayName => {
    return program.schedule.find(d => d.dayName === dayName) ?? null;
  });

  return (
    <div className="min-h-full bg-bg text-ink">
      {/* Header */}
      <div className="bg-panel border-b border-line px-4 sm:px-6 lg:px-10 py-4 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setFitnessPage('home')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 -ml-1">
                <ArrowLeft size={18} className="text-mut" />
              </button>
              <span className="vh-tile vh-tile--gold w-8 h-8"><IDumbbell size={16} /></span>
              <div>
                <h1 className="font-display text-base text-ink">{program.name}</h1>
                <p className="text-xs text-faint tnum">
                  {GOAL_LABELS[program.goal]} · {SPLIT_LABELS[program.split]} · {program.daysPerWeek}×/vecka
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setView('create')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-soft text-mut hover:bg-card" title="Skapa eget program">
                <Sparkles size={14} />
                <span className="hidden sm:inline">Skapa eget</span>
              </button>
              <button onClick={() => setFitnessPage('onboarding')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5" title="Nytt program via onboarding">
                <RotateCcw size={16} className="text-mut" />
              </button>
              <button onClick={() => setEditMode(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editMode ? 'text-gold' : 'bg-soft text-mut hover:bg-card'}`}
                style={editMode ? { background: 'rgba(233,193,120,.12)' } : undefined}>
                <Edit2 size={14} />
                {editMode ? 'Klar' : 'Redigera'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Week grid */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6">
        {saving && (
          <div className="text-xs text-faint text-center py-1 mb-2">Sparar…</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
        {weekGrid.map((day, dayIdx) => {
          const schedIdx = program.schedule.findIndex(d => d.dayName === WEEK_DAYS[dayIdx]);
          if (!day) {
            // Rest day
            return (
              <div key={dayIdx} className="bg-card rounded-2xl border border-line overflow-hidden flex flex-col opacity-70">
                <div className="relative h-24 flex items-center justify-center bg-soft">
                  <span className="absolute top-3 left-4 text-[11px] tracking-[0.18em] uppercase text-faint font-medium">{WEEK_DAYS[dayIdx]}</span>
                  <span className="text-sm text-faint">Vilodag</span>
                </div>
              </div>
            );
          }

          return (
            <div key={dayIdx} className="bg-card rounded-2xl border border-line overflow-hidden flex flex-col transition-colors hover:border-[rgba(233,193,120,.3)]">
              {/* Image-rich day header — click to start the session */}
              <button
                className="relative w-full text-left group"
                onClick={() => !editMode && setSelectedDay(day)}
              >
                <div className="relative h-28 overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${DAY_IMG(dayIdx)})`, filter: 'grayscale(1) contrast(1.05) brightness(0.58)' }}
                  />
                  <div className="absolute inset-0" style={{
                    background:
                      'linear-gradient(0deg,rgba(9,9,11,.94),rgba(9,9,11,.2) 72%),' +
                      'radial-gradient(90% 90% at 88% 0%,rgba(233,193,120,.32),transparent 60%)',
                  }} />
                  <div className="relative z-10 h-full flex flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] tracking-[0.18em] uppercase text-gold-2 font-medium">{WEEK_DAYS[dayIdx]}</span>
                      {!editMode && (
                        <span className="inline-flex items-center gap-1 text-[12px] text-white/90 bg-white/10 backdrop-blur border border-white/15 rounded-lg px-2 py-1">
                          <Play size={12} /> Starta
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-display text-white leading-tight" style={{ fontSize: 'clamp(19px,1.6vw,25px)', letterSpacing: '-0.01em' }}>{day.splitLabel}</h3>
                      <p className="text-xs text-white/70 tnum mt-0.5">{day.exercises.length} övningar</p>
                    </div>
                  </div>
                </div>
              </button>

              {/* Exercise list */}
              <div className="divide-y divide-line flex-1">
                {day.exercises.map((ex, exIdx) => {
                  const resolved = !editMode && ex.name ? getExerciseByName(ex.name) : undefined;
                  return (
                  <div key={exIdx} className="flex items-center gap-3 px-4 py-2.5">
                    <div
                      className={`flex-1 min-w-0 ${resolved ? 'cursor-pointer group/ex' : ''}`}
                      onClick={resolved ? () => openExerciseDetail(ex.name) : undefined}
                    >
                      <p className={`text-sm font-medium flex items-center gap-1 ${resolved ? 'text-ink group-hover/ex:text-gold transition-colors' : 'text-ink'}`}>
                        {ex.name || <span className="text-faint italic">Namnlös</span>}
                        {resolved && <ChevronRight size={13} className="text-faint group-hover/ex:text-gold" />}
                      </p>
                      <p className="text-xs text-faint tnum">{ex.sets} × {ex.repsRange} · {formatRest(ex.rest)} vila{ex.note ? ` · ${ex.note}` : ''}</p>
                    </div>
                    {editMode && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setEditExercise({ dayIdx: schedIdx, exIdx })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-faint">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDeleteExercise(schedIdx, exIdx)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[rgba(255,143,122,.12)] text-faint hover:text-coral">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
                {editMode && (
                  <button onClick={() => handleAddExercise(schedIdx)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-gold hover:bg-[rgba(233,193,120,.1)] text-sm">
                    <Plus size={14} />
                    Lägg till övning
                  </button>
                )}
              </div>
            </div>
          );
        })}
        </div>

        {/* Progression note */}
        <div className="vh-card p-4 mt-4" style={{ background: 'linear-gradient(150deg,#1b160c,#241a0b)', border: '1px solid rgba(233,193,120,.25)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="vh-tile vh-tile--gold w-7 h-7"><ITrend size={14} /></span>
            <p className="text-sm font-semibold text-[#f6ead2]">Progressiv överbelastning</p>
          </div>
          <p className="text-xs" style={{ color: '#cdbfa3' }}>
            När du klarar alla set inom rep-rangen med god form → öka vikten med 2,5 kg (överkropp) eller 5 kg (underkropp) vid nästa pass.
          </p>
        </div>
      </div>

      {/* Session modal */}
      {selectedDay && (
        <SessionModal
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
          onStartWorkout={handleStartWorkout}
        />
      )}

      {/* Edit exercise modal */}
      {editExercise && program && (
        <EditExerciseModal
          exercise={program.schedule[editExercise.dayIdx].exercises[editExercise.exIdx]}
          onSave={ex => handleUpdateExercise(editExercise.dayIdx, editExercise.exIdx, ex)}
          onClose={() => setEditExercise(null)}
        />
      )}
    </div>
  );
}
