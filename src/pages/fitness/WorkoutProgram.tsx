import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import type { WorkoutProgram, WorkoutDay, ProgramExercise } from '../../types';
import {
  Dumbbell, ChevronRight, ArrowLeft, Play, Edit2, X, Plus, Trash2, Clock, RotateCcw,
} from 'lucide-react';
import { IDumbbell, ITrend } from '../../components/ui/Icons';
import { getExerciseByName } from '../../utils/exerciseUtils';

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

// ── Huvud-komponent ───────────────────────────────────────────────────────────

export default function WorkoutProgramPage() {
  const { user } = useAuthStore();
  const { setFitnessPage, setPendingWorkout, setSelectedExerciseId } = useStore();

  function openExerciseDetail(name: string) {
    const resolved = getExerciseByName(name);
    if (!resolved) return;
    setSelectedExerciseId(resolved.id);
    setFitnessPage('exercises');
  }
  const [program, setProgram] = useState<WorkoutProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editExercise, setEditExercise] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
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
        <p className="text-sm text-faint mt-1 mb-4">Gör onboarding för att få ett personligt program</p>
        <button onClick={() => setFitnessPage('onboarding')} className="px-5 py-2.5 text-[#2a1d08] rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
          Starta onboarding
        </button>
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
      <div className="bg-panel border-b border-line px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
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
              <button onClick={() => setFitnessPage('onboarding')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5" title="Nytt program">
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
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {saving && (
          <div className="text-xs text-faint text-center py-1">Sparar…</div>
        )}

        {weekGrid.map((day, dayIdx) => {
          const schedIdx = program.schedule.findIndex(d => d.dayName === WEEK_DAYS[dayIdx]);
          if (!day) {
            // Rest day
            return (
              <div key={dayIdx} className="flex items-center gap-3 px-4 py-3 bg-card rounded-2xl border border-line opacity-60">
                <div className="w-10 text-xs font-semibold text-faint uppercase">{WEEK_DAYS[dayIdx].slice(0, 3)}</div>
                <span className="text-sm text-faint">Vilodag</span>
              </div>
            );
          }

          return (
            <div key={dayIdx} className="bg-card rounded-2xl border border-line overflow-hidden">
              {/* Day header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                onClick={() => !editMode && setSelectedDay(day)}
              >
                <div className="w-10 text-xs font-semibold text-gold uppercase">{WEEK_DAYS[dayIdx].slice(0, 3)}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">{day.splitLabel}</p>
                  <p className="text-xs text-faint tnum">{day.exercises.length} övningar</p>
                </div>
                {!editMode && (
                  <div className="flex items-center gap-1 text-gold">
                    <Play size={14} />
                    <ChevronRight size={14} className="text-faint" />
                  </div>
                )}
              </button>

              {/* Exercise list */}
              <div className="divide-y divide-line">
                {day.exercises.map((ex, exIdx) => {
                  const resolved = !editMode && ex.name ? getExerciseByName(ex.name) : undefined;
                  return (
                  <div key={exIdx} className="flex items-center gap-3 px-4 py-2.5 pl-14">
                    <div
                      className={`flex-1 min-w-0 ${resolved ? 'cursor-pointer group/ex' : ''}`}
                      onClick={resolved ? () => openExerciseDetail(ex.name) : undefined}
                    >
                      <p className={`text-sm font-medium flex items-center gap-1 ${resolved ? 'text-ink group-hover/ex:text-gold transition-colors' : 'text-ink'}`}>
                        {ex.name || <span className="text-faint italic">Namnlös</span>}
                        {resolved && <ChevronRight size={13} className="text-faint group-hover/ex:text-gold" />}
                      </p>
                      <p className="text-xs text-faint tnum">{ex.sets} × {ex.repsRange} · {formatRest(ex.rest)} vila</p>
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
                    className="w-full flex items-center gap-2 px-4 py-2.5 pl-14 text-gold hover:bg-[rgba(233,193,120,.1)] text-sm">
                    <Plus size={14} />
                    Lägg till övning
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Progression note */}
        <div className="vh-card p-4" style={{ background: 'linear-gradient(150deg,#1b160c,#241a0b)', border: '1px solid rgba(233,193,120,.25)' }}>
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
