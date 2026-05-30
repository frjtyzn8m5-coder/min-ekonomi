import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import type { WorkoutProgram, WorkoutDay, ProgramExercise } from '../../types';
import {
  Dumbbell, ChevronRight, ArrowLeft, Play, Edit2, X, Plus, Trash2, Clock, RotateCcw,
} from 'lucide-react';

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{day.dayName}</h2>
            <p className="text-xs text-gray-400">{day.splitLabel} · {day.exercises.length} övningar</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {day.exercises.map((ex, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-emerald-700">{i + 1}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{ex.name}</p>
                <p className="text-xs text-gray-400">
                  {ex.sets} set × {ex.repsRange} reps · <Clock size={10} className="inline" /> {formatRest(ex.rest)}
                </p>
                {ex.note && <p className="text-xs text-gray-400 italic">{ex.note}</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => { onClose(); onStartWorkout(day); }}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Redigera övning</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Övningsnamn" value={name} onChange={e => setName(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Set</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" value={sets} onChange={e => setSets(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Reps</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="8-12" value={reps} onChange={e => setReps(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Vila (s)</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" value={rest} onChange={e => setRest(e.target.value)} />
            </div>
          </div>
          <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Anteckning (valfritt)" value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">Avbryt</button>
          <button onClick={() => onSave({ name, sets: parseInt(sets) || 3, repsRange: reps, rest: parseInt(rest) || 90, note: note || undefined })}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
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
  const { setFitnessPage } = useStore();
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
    // Navigate to WorkoutLog with the day pre-loaded
    // For now just go to workout log — full integration in a later session
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
      <div className="min-h-full flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <Dumbbell size={40} className="text-gray-300 mb-3" />
        <p className="font-medium text-gray-500">Inget program hittat</p>
        <p className="text-sm text-gray-400 mt-1 mb-4">Gör onboarding för att få ett personligt program</p>
        <button onClick={() => setFitnessPage('onboarding')} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">
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
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setFitnessPage('home')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 -ml-1">
                <ArrowLeft size={18} className="text-gray-600" />
              </button>
              <Dumbbell size={20} className="text-emerald-600" />
              <div>
                <h1 className="text-base font-bold text-gray-900">{program.name}</h1>
                <p className="text-xs text-gray-400">
                  {GOAL_LABELS[program.goal]} · {SPLIT_LABELS[program.split]} · {program.daysPerWeek}×/vecka
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFitnessPage('onboarding')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100" title="Nytt program">
                <RotateCcw size={16} className="text-gray-500" />
              </button>
              <button onClick={() => setEditMode(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editMode ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
          <div className="text-xs text-gray-400 text-center py-1">Sparar…</div>
        )}

        {weekGrid.map((day, dayIdx) => {
          const schedIdx = program.schedule.findIndex(d => d.dayName === WEEK_DAYS[dayIdx]);
          if (!day) {
            // Rest day
            return (
              <div key={dayIdx} className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-gray-100 opacity-60">
                <div className="w-10 text-xs font-semibold text-gray-400 uppercase">{WEEK_DAYS[dayIdx].slice(0, 3)}</div>
                <span className="text-sm text-gray-400">Vilodag</span>
              </div>
            );
          }

          return (
            <div key={dayIdx} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Day header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                onClick={() => !editMode && setSelectedDay(day)}
              >
                <div className="w-10 text-xs font-semibold text-emerald-600 uppercase">{WEEK_DAYS[dayIdx].slice(0, 3)}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{day.splitLabel}</p>
                  <p className="text-xs text-gray-400">{day.exercises.length} övningar</p>
                </div>
                {!editMode && (
                  <div className="flex items-center gap-1 text-emerald-600">
                    <Play size={14} />
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                )}
              </button>

              {/* Exercise list */}
              <div className="divide-y divide-gray-50">
                {day.exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="flex items-center gap-3 px-4 py-2.5 pl-14">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium">{ex.name || <span className="text-gray-300 italic">Namnlös</span>}</p>
                      <p className="text-xs text-gray-400">{ex.sets} × {ex.repsRange} · {formatRest(ex.rest)} vila</p>
                    </div>
                    {editMode && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setEditExercise({ dayIdx: schedIdx, exIdx })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDeleteExercise(schedIdx, exIdx)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {editMode && (
                  <button onClick={() => handleAddExercise(schedIdx)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 pl-14 text-emerald-600 hover:bg-emerald-50 text-sm">
                    <Plus size={14} />
                    Lägg till övning
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Progression note */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-emerald-800 mb-1">📈 Progressiv överbelastning</p>
          <p className="text-xs text-emerald-700">
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
