import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Play, Square, Plus, Trash2, Check,
  Timer, Dumbbell, ChevronRight, RotateCcw, History,
  TrendingUp, Calendar, Clock, X
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Exercise, LoggedExercise, WorkoutSet, WorkoutSession } from '../../types';
import ExerciseDB from './ExerciseDB';
import {
  saveWorkoutSession,
  loadWorkoutSessions,
} from '../../lib/fitnessDb';

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('sv-SE', { weekday: 'short', month: 'short', day: 'numeric' });
}

function totalVolume(exercises: LoggedExercise[]): number {
  return exercises.reduce((acc, ex) =>
    acc + ex.sets.reduce((s, set) =>
      s + (set.completed ? (set.weight ?? 0) * (set.reps ?? 0) : 0), 0
    ), 0
  );
}

// ── RestTimer ──────────────────────────────────────────────────────────────────

function RestTimer({ onDone }: { onDone: () => void }) {
  const [seconds, setSeconds] = useState(90);
  const [running, setRunning] = useState(true);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(ref.current!); setRunning(false); onDone(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current!);
  }, [running]);

  const presets = [60, 90, 120, 180];

  return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
      <Timer size={16} className="text-amber-600 flex-shrink-0" />
      <span className="font-mono font-bold text-amber-700 text-lg w-14">{formatDuration(seconds)}</span>
      <div className="flex gap-1 flex-wrap">
        {presets.map(p => (
          <button
            key={p}
            onClick={() => { setSeconds(p); setRunning(true); }}
            className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full hover:bg-amber-200 transition-colors"
          >
            {p}s
          </button>
        ))}
      </div>
      <button
        onClick={() => { setRunning(false); onDone(); }}
        className="ml-auto text-amber-500 hover:text-amber-700"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── SetRow ─────────────────────────────────────────────────────────────────────

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  onChange: (updated: WorkoutSet) => void;
  onDelete: () => void;
  onComplete: () => void;
}

function SetRow({ set, index, onChange, onDelete, onComplete }: SetRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${
        set.completed ? 'bg-emerald-50' : 'bg-gray-50'
      }`}
    >
      {/* Set number */}
      <span className="w-5 text-xs font-semibold text-gray-400 text-center flex-shrink-0">{index + 1}</span>

      {/* Weight */}
      <div className="flex-1 relative">
        <input
          type="number"
          placeholder="kg"
          value={set.weight ?? ''}
          onChange={e => onChange({ ...set, weight: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full text-center text-sm font-medium bg-white border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">kg</span>
      </div>

      {/* Reps */}
      <div className="flex-1 relative">
        <input
          type="number"
          placeholder="reps"
          value={set.reps ?? ''}
          onChange={e => onChange({ ...set, reps: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full text-center text-sm font-medium bg-white border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-300">rep</span>
      </div>

      {/* RPE */}
      <div className="w-12 relative">
        <input
          type="number"
          placeholder="RPE"
          min={1}
          max={10}
          value={set.rpe ?? ''}
          onChange={e => onChange({ ...set, rpe: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full text-center text-xs bg-white border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[8px] text-gray-300">rpe</span>
      </div>

      {/* Complete button */}
      <button
        onClick={onComplete}
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
          set.completed
            ? 'bg-emerald-600 text-white'
            : 'bg-white border border-gray-200 text-gray-300 hover:border-emerald-400 hover:text-emerald-500'
        }`}
      >
        <Check size={13} />
      </button>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 flex-shrink-0 transition-colors"
      >
        <Trash2 size={12} />
      </button>
    </motion.div>
  );
}

// ── ExerciseBlock ──────────────────────────────────────────────────────────────

interface ExerciseBlockProps {
  loggedEx: LoggedExercise;
  index: number;
  onChange: (updated: LoggedExercise) => void;
  onDelete: () => void;
}

function ExerciseBlock({ loggedEx, index: _index, onChange, onDelete }: ExerciseBlockProps) {
  const [showTimer, setShowTimer] = useState(false);

  function addSet() {
    const prev = loggedEx.sets[loggedEx.sets.length - 1];
    const newSet: WorkoutSet = {
      id: uid(),
      weight: prev?.weight,
      reps: prev?.reps,
      completed: false,
    };
    onChange({ ...loggedEx, sets: [...loggedEx.sets, newSet] });
  }

  function updateSet(i: number, updated: WorkoutSet) {
    const sets = [...loggedEx.sets];
    sets[i] = updated;
    onChange({ ...loggedEx, sets });
  }

  function deleteSet(i: number) {
    const sets = loggedEx.sets.filter((_, idx) => idx !== i);
    onChange({ ...loggedEx, sets });
  }

  function completeSet(i: number) {
    const sets = [...loggedEx.sets];
    const wasCompleted = sets[i].completed;
    sets[i] = { ...sets[i], completed: !wasCompleted };
    onChange({ ...loggedEx, sets });
    if (!wasCompleted) setShowTimer(true);
  }

  const completedCount = loggedEx.sets.filter(s => s.completed).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Exercise header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{loggedEx.exerciseName}</p>
          <p className="text-xs text-gray-400">{completedCount}/{loggedEx.sets.length} set klara</p>
        </div>
        <button
          onClick={() => setShowTimer(t => !t)}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            showTimer ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          <Timer size={13} />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {/* Rest timer */}
        {showTimer && <RestTimer onDone={() => setShowTimer(false)} />}

        {/* Set headers */}
        <div className="flex items-center gap-2 px-2">
          <span className="w-5" />
          <span className="flex-1 text-[10px] text-gray-400 text-center">Vikt</span>
          <span className="flex-1 text-[10px] text-gray-400 text-center">Reps</span>
          <span className="w-12 text-[10px] text-gray-400 text-center">RPE</span>
          <span className="w-7" />
          <span className="w-6" />
        </div>

        {/* Sets */}
        {loggedEx.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            index={i}
            onChange={u => updateSet(i, u)}
            onDelete={() => deleteSet(i)}
            onComplete={() => completeSet(i)}
          />
        ))}

        {/* Add set */}
        <button
          onClick={addSet}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
        >
          <Plus size={12} />
          Lägg till set
        </button>
      </div>
    </div>
  );
}

// ── Session History Item ───────────────────────────────────────────────────────

function SessionHistoryCard({ session, onClick }: { session: WorkoutSession; onClick: () => void }) {
  const duration = session.duration ? formatDuration(session.duration) : null;
  const vol = session.totalVolume ?? totalVolume(session.exercises);

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-100 p-4 text-left hover:border-gray-200 hover:shadow-sm active:scale-[0.99] transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {session.programDayName ?? 'Fristående pass'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(session.date)}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {session.exercises.slice(0, 3).map(ex => (
              <span key={ex.exerciseId} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {ex.exerciseName}
              </span>
            ))}
            {session.exercises.length > 3 && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                +{session.exercises.length - 3} till
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-gray-400">
          {duration && <span className="flex items-center gap-1"><Clock size={10} />{duration}</span>}
          {vol > 0 && <span className="flex items-center gap-1"><TrendingUp size={10} />{vol.toLocaleString('sv-SE')} kg</span>}
          <ChevronRight size={14} className="text-gray-200 mt-1" />
        </div>
      </div>
    </button>
  );
}

// ── Session Detail (read-only view of past session) ────────────────────────────

function SessionDetail({ session, onBack }: { session: WorkoutSession; onBack: () => void }) {
  const vol = session.totalVolume ?? totalVolume(session.exercises);
  const duration = session.duration ? formatDuration(session.duration) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">{session.programDayName ?? 'Fristående pass'}</h2>
          <p className="text-xs text-gray-400">{formatDate(session.date)}</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Övningar', value: String(session.exercises.length) },
            { label: 'Tid', value: duration ?? '–' },
            { label: 'Volym', value: vol > 0 ? `${vol.toLocaleString('sv-SE')} kg` : '–' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-sm font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Exercises */}
        {session.exercises.map(ex => (
          <div key={ex.exerciseId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-900">{ex.exerciseName}</p>
            </div>
            <div className="p-3 space-y-1.5">
              <div className="flex gap-2 px-2">
                <span className="w-5 text-[10px] text-gray-400">#</span>
                <span className="flex-1 text-[10px] text-gray-400 text-center">Vikt</span>
                <span className="flex-1 text-[10px] text-gray-400 text-center">Reps</span>
                <span className="w-14 text-[10px] text-gray-400 text-center">RPE</span>
              </div>
              {ex.sets.filter(s => s.completed).map((set, i) => (
                <div key={set.id} className="flex gap-2 px-2 py-1.5 bg-emerald-50 rounded-lg items-center">
                  <span className="w-5 text-xs text-gray-400 text-center">{i + 1}</span>
                  <span className="flex-1 text-xs font-medium text-gray-700 text-center">
                    {set.weight != null ? `${set.weight} kg` : '–'}
                  </span>
                  <span className="flex-1 text-xs font-medium text-gray-700 text-center">
                    {set.reps ?? '–'}
                  </span>
                  <span className="w-14 text-xs text-gray-500 text-center">
                    {set.rpe != null ? `RPE ${set.rpe}` : '–'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Active Session ─────────────────────────────────────────────────────────────

interface ActiveSessionProps {
  exercises: LoggedExercise[];
  dayName?: string;
  startTime: number;
  onAddExercise: () => void;
  onUpdate: (exercises: LoggedExercise[]) => void;
  onFinish: () => void;
  onCancel: () => void;
}

function ActiveSession({
  exercises,
  dayName,
  startTime,
  onAddExercise,
  onUpdate,
  onFinish,
  onCancel,
}: ActiveSessionProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime]);

  function updateExercise(i: number, updated: LoggedExercise) {
    const next = [...exercises];
    next[i] = updated;
    onUpdate(next);
  }

  function deleteExercise(i: number) {
    onUpdate(exercises.filter((_, idx) => idx !== i));
  }

  const completedSets = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.completed).length, 0);
  const totalSets     = exercises.reduce((a, ex) => a + ex.sets.length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
          <X size={18} className="text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">{dayName ?? 'Nytt pass'}</h2>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock size={10} />{formatDuration(elapsed)}</span>
            <span>{completedSets}/{totalSets} set</span>
          </div>
        </div>
        <button
          onClick={onFinish}
          disabled={exercises.length === 0}
          className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          <Square size={12} />
          Avsluta
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {exercises.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Dumbbell size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium mb-1">Inga övningar ännu</p>
            <p className="text-xs">Lägg till övningar för att börja logga</p>
          </div>
        ) : (
          exercises.map((ex, i) => (
            <ExerciseBlock
              key={ex.exerciseId + i}
              loggedEx={ex}
              index={i}
              onChange={u => updateExercise(i, u)}
              onDelete={() => deleteExercise(i)}
            />
          ))
        )}

        {/* Add exercise button */}
        <button
          onClick={onAddExercise}
          className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-emerald-600 font-medium hover:border-emerald-300 hover:bg-emerald-50 transition-all"
        >
          <Plus size={16} />
          Lägg till övning
        </button>
      </div>
    </div>
  );
}

// ── WorkoutLog (root) ──────────────────────────────────────────────────────────

interface WorkoutLogProps {
  /** Pre-populated exercises from a program day */
  initialExercises?: { name: string }[];
  /** Name of the program day */
  programDayName?: string;
}

type View = 'home' | 'session' | 'pick-exercise' | 'history' | 'session-detail';

export default function WorkoutLog({ initialExercises, programDayName }: WorkoutLogProps) {
  const { setFitnessPage, pendingWorkout, setPendingWorkout } = useStore();
  const { user } = useAuthStore();

  // Consume pending workout from store (set by WorkoutProgram "Starta passet")
  const resolvedInitial = initialExercises ?? pendingWorkout?.exercises;
  const resolvedDayName = programDayName   ?? pendingWorkout?.dayName;

  const [view, setView]                   = useState<View>(resolvedInitial ? 'session' : 'home');
  const [sessionExercises, setSessionExercises] = useState<LoggedExercise[]>(() =>
    resolvedInitial
      ? resolvedInitial.map(ex => ({
          exerciseId: ex.name.toLowerCase().replace(/\s+/g, '_'),
          exerciseName: ex.name,
          sets: [{ id: uid(), completed: false }],
        }))
      : []
  );
  const [startTime, setStartTime]         = useState<number>(Date.now());
  const [dayName, setDayName]             = useState<string | undefined>(resolvedDayName);
  const [sessions, setSessions]           = useState<WorkoutSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
  const [saving, setSaving]               = useState(false);

  // Clear pending workout from store once consumed
  useEffect(() => {
    if (pendingWorkout) setPendingWorkout(null);
  }, []);

  // Load history
  useEffect(() => {
    if (!user) return;
    loadWorkoutSessions(user.uid)
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoadingSessions(false));
  }, [user]);

  const startNewSession = useCallback(() => {
    setSessionExercises([]);
    setStartTime(Date.now());
    setDayName(undefined);
    setView('session');
  }, []);

  const addExerciseToSession = useCallback((ex: Exercise) => {
    setSessionExercises(prev => [
      ...prev,
      {
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: [{ id: uid(), completed: false }],
      },
    ]);
    setView('session');
  }, []);

  const finishSession = useCallback(async () => {
    if (!user || sessionExercises.length === 0) return;
    setSaving(true);
    try {
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);
      const session: WorkoutSession = {
        id: uid(),
        date: new Date().toISOString().slice(0, 10),
        startTime,
        endTime,
        duration,
        exercises: sessionExercises,
        programDayName: dayName,
        totalVolume: totalVolume(sessionExercises),
      };
      await saveWorkoutSession(user.uid, session);
      setSessions(prev => [session, ...prev]);
      setView('home');
      setSessionExercises([]);
    } catch (e) {
      alert('Kunde inte spara passet. Kontrollera anslutningen.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [user, sessionExercises, startTime, dayName]);

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">

        {/* ── Pick exercise overlay ── */}
        {view === 'pick-exercise' && (
          <motion.div
            key="pick"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col h-full"
          >
            <ExerciseDB
              standalone={false}
              onBack={() => setView('session')}
              onAddToSession={addExerciseToSession}
              addLabel="Välj övning"
            />
          </motion.div>
        )}

        {/* ── Active session ── */}
        {view === 'session' && (
          <motion.div key="session" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
            <ActiveSession
              exercises={sessionExercises}
              dayName={dayName}
              startTime={startTime}
              onAddExercise={() => setView('pick-exercise')}
              onUpdate={setSessionExercises}
              onFinish={finishSession}
              onCancel={() => setView('home')}
            />
            {saving && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </motion.div>
        )}

        {/* ── Session detail ── */}
        {view === 'session-detail' && selectedSession && (
          <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
            <SessionDetail session={selectedSession} onBack={() => setView('history')} />
          </motion.div>
        )}

        {/* ── History ── */}
        {view === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
              <button onClick={() => setView('home')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <ChevronLeft size={18} className="text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                <History size={16} className="text-emerald-600" />
                <h2 className="font-semibold text-gray-900">Passhistorik</h2>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {loadingSessions ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <History size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Inga pass loggade än</p>
                </div>
              ) : (
                sessions.map(s => (
                  <SessionHistoryCard
                    key={s.id}
                    session={s}
                    onClick={() => { setSelectedSession(s); setView('session-detail'); }}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* ── Home ── */}
        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
              <button onClick={() => setFitnessPage('home')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <ChevronLeft size={18} className="text-gray-600" />
              </button>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Dumbbell size={14} className="text-emerald-600" />
                </div>
                <h1 className="font-semibold text-gray-900 text-sm">Träningslogg</h1>
              </div>
              <button
                onClick={() => setView('history')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <History size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Start new session */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Starta nytt pass</h3>
                <p className="text-xs text-gray-400 mb-4">Logga övningar, vikt, reps och RPE. Vila-timer ingår.</p>
                <button
                  onClick={startNewSession}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-medium py-3 rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all"
                >
                  <Play size={16} />
                  Starta fristående pass
                </button>
              </div>

              {/* Program shortcut */}
              <button
                onClick={() => setFitnessPage('program')}
                className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all text-left"
              >
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Starta från program</p>
                  <p className="text-xs text-gray-400">Dagens övningar läggs in automatiskt</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>

              {/* Exercise DB shortcut */}
              <button
                onClick={() => setFitnessPage('exercises')}
                className="w-full flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all text-left"
              >
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Dumbbell size={16} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Övningsdatabas</p>
                  <p className="text-xs text-gray-400">Sök bland alla övningar med videolänk</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>

              {/* Recent sessions */}
              {!loadingSessions && sessions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">Senaste pass</h3>
                    <button
                      onClick={() => setView('history')}
                      className="text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      Visa alla
                    </button>
                  </div>
                  <div className="space-y-2">
                    {sessions.slice(0, 3).map(s => (
                      <SessionHistoryCard
                        key={s.id}
                        session={s}
                        onClick={() => { setSelectedSession(s); setView('session-detail'); }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ── Named export for starting from program ─────────────────────────────────────

export { WorkoutLog };
