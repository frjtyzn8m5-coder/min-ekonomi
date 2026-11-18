import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Play, Square, Plus, Trash2, Check,
  Timer, Dumbbell, ChevronRight, History, Clock, X,
  TrendingUp, Calendar, Trophy,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Exercise, WorkoutSet, WorkoutSession, SetType } from '../../types';
import ExerciseDB from './ExerciseDB';
import { saveWorkoutSession, loadWorkoutSessions } from '../../lib/fitnessDb';
import { calculate1RM, calculateProgression, detectStagnation } from '../../utils/progressionEngine';
import { getExerciseById, getExerciseByName } from '../../utils/exerciseUtils';

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

function totalVolumeFromSets(sets: WorkoutSet[]): number {
  return sets.filter(s => s.completedAt > 0).reduce((acc, s) => acc + s.weight * s.reps, 0);
}

function groupSetsByExercise(sets: WorkoutSet[]) {
  const map = new Map<string, { exerciseId: string; exerciseName: string; sets: WorkoutSet[] }>();
  for (const s of sets) {
    if (!map.has(s.exerciseId)) map.set(s.exerciseId, { exerciseId: s.exerciseId, exerciseName: s.exerciseName, sets: [] });
    map.get(s.exerciseId)!.sets.push(s);
  }
  return Array.from(map.values());
}

function getSessionExerciseNames(session: WorkoutSession): string[] {
  if (session.sets?.length) return [...new Set(session.sets.map(s => s.exerciseName))];
  return ((session as any).exercises ?? []).map((e: any) => e.exerciseName);
}

function getSessionDuration(session: WorkoutSession): number | null {
  if (session.endTime && session.startTime) return Math.round((session.endTime - session.startTime) / 1000);
  return (session as any).duration ?? null;
}

function getSessionVolume(session: WorkoutSession): number {
  if (session.totalVolumeKg != null) return session.totalVolumeKg;
  if (session.sets?.length) return totalVolumeFromSets(session.sets);
  const legacy = (session as any).exercises ?? [];
  return legacy.reduce((acc: number, ex: any) =>
    acc + (ex.sets ?? []).reduce((s: number, set: any) =>
      s + (set.completed ? (set.weight ?? 0) * (set.reps ?? 0) : 0), 0), 0);
}

function getBest1RM(sessions: WorkoutSession[], exerciseId: string): number {
  let best = 0;
  for (const session of sessions) {
    for (const s of session.sets ?? []) {
      if (s.exerciseId === exerciseId && s.estimated1RM) best = Math.max(best, s.estimated1RM);
    }
  }
  return best;
}

// ── Set type labels / colors ───────────────────────────────────────────────────

const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: 'Uppv.', working: 'Arbete', top_set: 'Topp', back_off: 'Back-off',
  dropset: 'Drop', superset_a: 'SS-A', superset_b: 'SS-B', giant_set: 'Giant',
  myo_reps: 'Myo', rest_pause: 'RP', cluster: 'Cluster',
  long_partials: 'L.Part.', integrated_partials: 'I.Part.', mechanical_dropset: 'Mek.D.',
  failure: 'Failure', amrap: 'AMRAP',
};

const ALL_SET_TYPES: SetType[] = [
  'warmup', 'working', 'top_set', 'back_off',
  'dropset', 'superset_a', 'superset_b', 'giant_set',
  'myo_reps', 'rest_pause', 'cluster',
  'long_partials', 'integrated_partials', 'mechanical_dropset',
  'failure', 'amrap',
];

const SET_TYPE_COLOR: Partial<Record<SetType, string>> = {
  warmup: 'bg-[rgba(233,193,120,.15)] text-gold',
  working: 'bg-[rgba(95,224,208,.15)] text-cyan',
  top_set: 'bg-[rgba(155,140,255,.15)] text-violet',
  back_off: 'bg-[rgba(155,140,255,.12)] text-violet',
  dropset: 'bg-[rgba(255,143,122,.15)] text-coral',
  failure: 'bg-[rgba(255,143,122,.22)] text-coral',
  amrap: 'bg-[rgba(233,193,120,.18)] text-gold',
};

function stColor(t: SetType) { return SET_TYPE_COLOR[t] ?? 'bg-soft text-mut'; }

// ── Draft types (in-session, not yet persisted) ────────────────────────────────

interface DraftSet {
  id: string;
  setType: SetType;
  weight: number;
  reps: number;
  rpe?: number;
  completedAt: number;
  estimated1RM?: number;
  isPersonalRecord?: boolean;
}

interface DraftExercise {
  exerciseId: string;
  exerciseName: string;
  sets: DraftSet[];
}

function draftToSets(drafts: DraftExercise[]): WorkoutSet[] {
  const result: WorkoutSet[] = [];
  for (const ex of drafts) {
    ex.sets.filter(s => s.completedAt > 0).forEach((s, i) => {
      result.push({
        id: s.id,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        setNumber: i + 1,
        setType: s.setType,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        estimated1RM: s.estimated1RM,
        isPersonalRecord: s.isPersonalRecord,
        completedAt: s.completedAt,
      });
    });
  }
  return result;
}

// ── RestTimer ──────────────────────────────────────────────────────────────────

function RestTimer({ defaultSeconds = 90, onDone }: { defaultSeconds?: number; onDone: () => void }) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [running, setRunning] = useState(true);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => {
      setSeconds(s => { if (s <= 1) { clearInterval(ref.current!); setRunning(false); onDone(); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(ref.current!);
  }, [running, onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{ background: 'rgba(233,193,120,.1)', border: '1px solid rgba(233,193,120,.25)' }}
    >
      <Timer size={14} className="text-gold flex-shrink-0" />
      <span className="font-display font-bold text-gold w-12 text-sm tnum">{formatDuration(seconds)}</span>
      <div className="flex gap-1">
        {[60, 90, 120, 180].map(p => (
          <button key={p} onClick={() => { setSeconds(p); setRunning(true); }}
            className="text-[10px] text-gold px-1.5 py-0.5 rounded-full hover:bg-[rgba(233,193,120,.2)] transition-colors tnum"
            style={{ background: 'rgba(233,193,120,.15)' }}>
            {p}s
          </button>
        ))}
      </div>
      <button onClick={() => { setRunning(false); onDone(); }} className="ml-auto text-faint hover:text-gold">
        <X size={13} />
      </button>
    </motion.div>
  );
}

// ── SetRow ─────────────────────────────────────────────────────────────────────

function SetRow({ set, index, onChange, onDelete, onComplete }: {
  set: DraftSet; index: number;
  onChange: (u: DraftSet) => void; onDelete: () => void; onComplete: () => void;
}) {
  const [showDrop, setShowDrop] = useState(false);
  const isCompleted = set.completedAt > 0;

  return (
    <div className={`rounded-lg ${isCompleted ? 'bg-[rgba(95,224,208,.1)]' : 'bg-soft'}`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className="w-4 text-xs font-semibold text-faint text-center flex-shrink-0 tnum">{index + 1}</span>

        {/* Set type */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setShowDrop(s => !s)}
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${stColor(set.setType)}`}>
            {SET_TYPE_LABELS[set.setType]}
          </button>
          {showDrop && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-line rounded-xl shadow-lg p-1 grid grid-cols-2 gap-0.5 w-40">
              {ALL_SET_TYPES.map(t => (
                <button key={t} onClick={() => { onChange({ ...set, setType: t }); setShowDrop(false); }}
                  className={`text-[10px] px-2 py-1 rounded-lg text-left ${set.setType === t ? stColor(t) : 'hover:bg-white/5 text-mut'}`}>
                  {SET_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Weight */}
        <div className="flex-1">
          <input type="number" inputMode="decimal" placeholder="kg"
            value={set.weight || ''}
            onChange={e => onChange({ ...set, weight: e.target.value ? Number(e.target.value) : 0 })}
            className="w-full text-center text-sm font-medium tnum bg-card text-ink border border-line rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-[rgba(233,193,120,.5)] focus:border-[rgba(233,193,120,.5)]" />
        </div>

        {/* Reps */}
        <div className="flex-1">
          <input type="number" inputMode="numeric" placeholder="reps"
            value={set.reps || ''}
            onChange={e => onChange({ ...set, reps: e.target.value ? Number(e.target.value) : 0 })}
            className="w-full text-center text-sm font-medium tnum bg-card text-ink border border-line rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-[rgba(233,193,120,.5)] focus:border-[rgba(233,193,120,.5)]" />
        </div>

        {/* RPE */}
        <div className="w-10">
          <input type="number" inputMode="decimal" placeholder="RPE" min={1} max={10}
            value={set.rpe ?? ''}
            onChange={e => onChange({ ...set, rpe: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full text-center text-xs tnum bg-card text-ink border border-line rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-[rgba(233,193,120,.5)] focus:border-[rgba(233,193,120,.5)]" />
        </div>

        {/* Complete */}
        <button onClick={onComplete}
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
            isCompleted ? 'text-[#2a1d08]' : 'bg-card border border-line text-faint hover:border-[rgba(233,193,120,.5)] hover:text-gold'
          }`}
          style={isCompleted ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}>
          <Check size={12} />
        </button>

        {/* Delete */}
        <button onClick={onDelete} className="w-5 h-5 flex items-center justify-center text-faint hover:text-coral flex-shrink-0">
          <Trash2 size={11} />
        </button>
      </div>

      {isCompleted && set.estimated1RM && (
        <div className="px-3 pb-1.5 flex items-center gap-1 text-[10px] text-cyan tnum">
          <TrendingUp size={9} />
          Est. 1RM: {set.estimated1RM} kg
          {set.isPersonalRecord && <span className="ml-1 font-bold text-gold">🏆 PR!</span>}
        </div>
      )}
    </div>
  );
}

// ── Progression suggestion badge ───────────────────────────────────────────────

function ProgressionBadge({ exerciseId, sessions }: { exerciseId: string; sessions: WorkoutSession[] }) {
  const exercise = getExerciseById(exerciseId);
  if (!exercise) return null;

  // Sessions that include this exercise, most-recent first.
  const relevant = sessions.filter(s => (s.sets ?? []).some(set => set.exerciseId === exerciseId));
  const previousSets = (relevant[0]?.sets ?? []).filter(s => s.exerciseId === exerciseId);
  if (previousSets.length === 0) return null;

  // Stagnation check needs the last 3 relevant sessions, ordered oldest → newest.
  const stagnationHistory = relevant.slice(0, 3).reverse().map(s => s.sets ?? []);
  const stagnation = detectStagnation(stagnationHistory, exerciseId, exercise.nameSv ?? exercise.name);

  try {
    const s = calculateProgression({
      exercise, previousSets,
      targetReps: exercise.defaultRepRange,
      targetRPE: exercise.defaultRPETarget,
    });
    const colors = {
      increase_weight: 'bg-[rgba(95,224,208,.1)] text-cyan border-[rgba(95,224,208,.2)]',
      increase_reps: 'bg-[rgba(155,140,255,.1)] text-violet border-[rgba(155,140,255,.2)]',
      maintain: 'bg-soft text-mut border-line',
      decrease: 'bg-[rgba(233,193,120,.1)] text-gold border-[rgba(233,193,120,.2)]',
      deload: 'bg-[rgba(255,143,122,.1)] text-coral border-[rgba(255,143,122,.2)]',
    };
    const icons = { increase_weight: '↑', increase_reps: '+', maintain: '=', decrease: '↓', deload: '♻' };
    return (
      <>
        {stagnation && (
          <div className="flex items-start gap-2 text-[11px] px-3 py-1.5 border-b bg-[rgba(255,143,122,.1)] text-coral border-[rgba(255,143,122,.2)]">
            <span className="font-bold">♻</span>
            <span>{stagnation.message}</span>
          </div>
        )}
        <div className={`flex items-start gap-2 text-[11px] px-3 py-1.5 border-b tnum ${colors[s.changeType]}`}>
          <span className="font-bold">{icons[s.changeType]}</span>
          <span>{s.rationale} <span className="opacity-60">({s.suggestedWeight} kg × {s.suggestedReps})</span></span>
        </div>
      </>
    );
  } catch { return null; }
}

// ── Exercise block ─────────────────────────────────────────────────────────────

function ExerciseBlock({ draft, sessions, onChange, onDelete, onPR, historicalBest }: {
  draft: DraftExercise; sessions: WorkoutSession[];
  onChange: (u: DraftExercise) => void; onDelete: () => void;
  onPR: () => void; historicalBest: number;
}) {
  const [showTimer, setShowTimer] = useState(false);
  const exercise = getExerciseById(draft.exerciseId);
  const restSec = exercise?.defaultRestSeconds ?? 90;

  function addSet() {
    const prev = draft.sets[draft.sets.length - 1];
    const newSet: DraftSet = {
      id: uid(),
      setType: prev?.setType === 'warmup' ? 'working' : (prev?.setType ?? 'working'),
      weight: prev?.weight ?? 0, reps: prev?.reps ?? 0, completedAt: 0,
    };
    onChange({ ...draft, sets: [...draft.sets, newSet] });
  }

  function updateSet(i: number, updated: DraftSet) {
    const sets = [...draft.sets]; sets[i] = updated; onChange({ ...draft, sets });
  }

  function deleteSet(i: number) {
    onChange({ ...draft, sets: draft.sets.filter((_, idx) => idx !== i) });
  }

  function completeSet(i: number) {
    const set = draft.sets[i];
    if (set.completedAt > 0) {
      const sets = [...draft.sets]; sets[i] = { ...set, completedAt: 0, isPersonalRecord: false };
      onChange({ ...draft, sets }); return;
    }
    if (!set.weight || !set.reps) return;
    const estimated1RM = calculate1RM(set.weight, set.reps) ?? undefined;
    const isPersonalRecord = estimated1RM != null && estimated1RM > historicalBest;
    const sets = [...draft.sets];
    sets[i] = { ...set, completedAt: Date.now(), estimated1RM, isPersonalRecord };
    onChange({ ...draft, sets });
    setShowTimer(true);
    if (isPersonalRecord) onPR();
  }

  const done = draft.sets.filter(s => s.completedAt > 0).length;

  return (
    <div className="bg-card rounded-2xl border border-line overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">{draft.exerciseName}</p>
          <p className="text-xs text-faint tnum">{done}/{draft.sets.length} set klara</p>
        </div>
        <button onClick={() => setShowTimer(t => !t)}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showTimer ? 'text-gold' : 'bg-soft text-faint'}`}
          style={showTimer ? { background: 'rgba(233,193,120,.15)' } : undefined}>
          <Timer size={13} />
        </button>
        <button onClick={onDelete} className="w-7 h-7 rounded-lg flex items-center justify-center bg-soft text-faint hover:bg-[rgba(255,143,122,.12)] hover:text-coral transition-colors">
          <Trash2 size={13} />
        </button>
      </div>

      <ProgressionBadge exerciseId={draft.exerciseId} sessions={sessions} />

      <div className="p-3 space-y-2">
        <AnimatePresence>
          {showTimer && <RestTimer key="timer" defaultSeconds={restSec} onDone={() => setShowTimer(false)} />}
        </AnimatePresence>

        <div className="flex items-center gap-1.5 px-2">
          <span className="w-4" /><span className="w-16 text-[9px] text-faint text-center">Typ</span>
          <span className="flex-1 text-[10px] text-faint text-center">Vikt</span>
          <span className="flex-1 text-[10px] text-faint text-center">Reps</span>
          <span className="w-10 text-[10px] text-faint text-center">RPE</span>
          <span className="w-7" /><span className="w-5" />
        </div>

        {draft.sets.map((set, i) => (
          <SetRow key={set.id} set={set} index={i}
            onChange={u => updateSet(i, u)}
            onDelete={() => deleteSet(i)}
            onComplete={() => completeSet(i)} />
        ))}

        <button onClick={addSet}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gold hover:bg-[rgba(233,193,120,.1)] rounded-lg transition-colors">
          <Plus size={12} /> Lägg till set
        </button>
      </div>
    </div>
  );
}

// ── PR flash notification ──────────────────────────────────────────────────────

function PRFlash({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.1, y: -10 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-[#2a1d08] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold pointer-events-none"
      style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
      <Trophy size={18} /> Nytt personbästa! 🏆
    </motion.div>
  );
}

// ── Session summary modal ──────────────────────────────────────────────────────

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

function SessionSummaryModal({ sets, durationSec, prCount, saving, onSave, onCancel }: {
  sets: WorkoutSet[]; durationSec: number; prCount: number; saving: boolean;
  onSave: (mood: 1|2|3|4|5, sessionRPE: number, notes: string) => void;
  onCancel: () => void;
}) {
  const [mood, setMood] = useState<1|2|3|4|5>(3);
  const [rpe, setRpe] = useState(7);
  const [notes, setNotes] = useState('');
  const vol = Math.round(totalVolumeFromSets(sets));
  const exCount = new Set(sets.map(s => s.exerciseId)).size;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
        className="bg-card border border-line rounded-3xl w-full max-w-md p-6 space-y-5 text-ink">
        <h3 className="font-display text-lg text-ink text-center">Pass avslutat! 💪</h3>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Tid', value: formatDuration(durationSec) },
            { label: 'Övningar', value: String(exCount) },
            { label: 'Volym', value: `${vol} kg` },
            { label: 'PR', value: prCount > 0 ? `${prCount} 🏆` : '–' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-soft rounded-xl p-2.5 text-center">
              <p className="font-display text-sm text-ink tnum">{value}</p>
              <p className="text-[10px] text-faint mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold text-mut mb-2">Hur kändes passet?</p>
          <div className="flex justify-around">
            {([1,2,3,4,5] as const).map(m => (
              <button key={m} onClick={() => setMood(m)}
                className={`text-2xl transition-all ${mood === m ? 'scale-125' : 'opacity-40'}`}>
                {MOOD_EMOJI[m]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-mut mb-1">Passansträngning (RPE {rpe})</p>
          <input type="range" min={1} max={10} value={rpe}
            onChange={e => setRpe(Number(e.target.value))}
            className="w-full accent-[#e9c178]" />
          <div className="flex justify-between text-[10px] text-faint">
            <span>Lätt</span><span>Måttlig</span><span>Maximal</span>
          </div>
        </div>

        <textarea placeholder="Anteckningar (valfritt)..." value={notes}
          onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full text-sm bg-soft text-ink border border-line rounded-xl px-3 py-2 resize-none placeholder-faint focus:outline-none focus:ring-1 focus:ring-[rgba(233,193,120,.5)]" />

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-line text-sm text-mut font-medium">
            Tillbaka
          </button>
          <button onClick={() => onSave(mood, rpe, notes)} disabled={saving}
            className="flex-1 py-3 rounded-xl text-[#2a1d08] text-sm font-semibold disabled:opacity-50 transition-colors"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
            {saving ? 'Sparar...' : 'Spara pass'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Session history card ───────────────────────────────────────────────────────

function SessionHistoryCard({ session, onClick }: { session: WorkoutSession; onClick: () => void }) {
  const duration = getSessionDuration(session);
  const vol = getSessionVolume(session);
  const names = getSessionExerciseNames(session);
  const name = session.name ?? (session as any).programDayName ?? 'Fristående pass';
  return (
    <button onClick={onClick}
      className="w-full bg-card rounded-xl border border-line p-4 text-left hover:border-[rgba(233,193,120,.3)] active:scale-[0.99] transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink">{name}</p>
          <p className="text-xs text-faint mt-0.5">{formatDate(session.date)}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {names.slice(0, 3).map(n => (
              <span key={n} className="text-[10px] bg-soft text-mut px-2 py-0.5 rounded-full">{n}</span>
            ))}
            {names.length > 3 && (
              <span className="text-[10px] bg-soft text-mut px-2 py-0.5 rounded-full">+{names.length - 3} till</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-faint">
          {duration && <span className="flex items-center gap-1 tnum"><Clock size={10} />{formatDuration(duration)}</span>}
          {vol > 0 && <span className="flex items-center gap-1 tnum"><TrendingUp size={10} />{Math.round(vol).toLocaleString('sv-SE')} kg</span>}
          <ChevronRight size={14} className="text-faint mt-1" />
        </div>
      </div>
    </button>
  );
}

// ── Session detail (read-only) ─────────────────────────────────────────────────

function SessionDetail({ session, onBack }: { session: WorkoutSession; onBack: () => void }) {
  const vol = getSessionVolume(session);
  const duration = getSessionDuration(session);
  const name = session.name ?? (session as any).programDayName ?? 'Fristående pass';
  const exercises = session.sets?.length
    ? groupSetsByExercise(session.sets)
    : ((session as any).exercises ?? []);

  return (
    <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-panel">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
          <ChevronLeft size={18} className="text-mut" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-ink truncate">{name}</h2>
          <p className="text-xs text-faint">{formatDate(session.date)}</p>
        </div>
        {session.mood && <span className="text-xl">{MOOD_EMOJI[session.mood]}</span>}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 bg-bg">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Övningar', value: String(exercises.length) },
            { label: 'Tid', value: duration ? formatDuration(duration) : '–' },
            { label: 'Volym', value: vol > 0 ? `${Math.round(vol).toLocaleString('sv-SE')} kg` : '–' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card rounded-xl border border-line p-3 text-center">
              <p className="font-display text-sm text-ink tnum">{value}</p>
              <p className="text-xs text-faint mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {session.notes && <div className="bg-soft rounded-xl p-3 text-sm text-mut">{session.notes}</div>}

        {exercises.map((ex: any) => {
          const exSets: any[] = ex.sets ?? [];
          const done = exSets.filter((s: any) => s.completedAt > 0 || s.completed);
          return (
            <div key={ex.exerciseId} className="bg-card rounded-2xl border border-line overflow-hidden">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">{ex.exerciseName}</p>
                <span className="text-xs text-faint tnum">{done.length} set</span>
              </div>
              <div className="p-3 space-y-1">
                {done.map((s: any, i: number) => (
                  <div key={s.id} className="flex gap-2 px-2 py-1.5 bg-[rgba(95,224,208,.08)] rounded-lg items-center">
                    <span className="w-4 text-xs text-faint text-center tnum">{i + 1}</span>
                    {s.setType && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${stColor(s.setType as SetType)}`}>
                        {SET_TYPE_LABELS[s.setType as SetType] ?? s.setType}
                      </span>
                    )}
                    <span className="flex-1 text-xs font-medium text-ink text-center tnum">{s.weight != null ? `${s.weight} kg` : '–'}</span>
                    <span className="flex-1 text-xs font-medium text-ink text-center tnum">{s.reps ?? '–'} reps</span>
                    <span className="w-12 text-xs text-mut text-center tnum">{s.rpe != null ? `RPE ${s.rpe}` : '–'}</span>
                    {s.isPersonalRecord && <Trophy size={11} className="text-gold" />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Active session ─────────────────────────────────────────────────────────────

function ActiveSession({ exercises, dayName, startTime, sessions, onAddExercise, onUpdate, onFinish, onCancel }: {
  exercises: DraftExercise[]; dayName?: string; startTime: number; sessions: WorkoutSession[];
  onAddExercise: () => void; onUpdate: (e: DraftExercise[]) => void;
  onFinish: () => void; onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [prFlash, setPrFlash] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime]);

  const completedSets = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.completedAt > 0).length, 0);
  const totalSets = exercises.reduce((a, ex) => a + ex.sets.length, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-panel sticky top-0 z-10">
        <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
          <X size={18} className="text-mut" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-ink truncate">{dayName ?? 'Nytt pass'}</h2>
          <div className="flex items-center gap-3 text-xs text-faint">
            <span className="flex items-center gap-1 tnum"><Clock size={10} />{formatDuration(elapsed)}</span>
            <span className="tnum">{completedSets}/{totalSets} set</span>
          </div>
        </div>
        <button onClick={onFinish} disabled={exercises.length === 0}
          className="flex items-center gap-1.5 text-[#2a1d08] text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
          <Square size={12} /> Avsluta
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3 bg-bg">
        {exercises.length === 0 ? (
          <div className="text-center py-16 text-faint">
            <Dumbbell size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium mb-1">Inga övningar ännu</p>
            <p className="text-xs">Lägg till övningar för att börja logga</p>
          </div>
        ) : exercises.map((ex, i) => (
          <ExerciseBlock key={ex.exerciseId + i} draft={ex} sessions={sessions}
            onChange={u => { const next = [...exercises]; next[i] = u; onUpdate(next); }}
            onDelete={() => onUpdate(exercises.filter((_, idx) => idx !== i))}
            onPR={() => setPrFlash(true)}
            historicalBest={getBest1RM(sessions, ex.exerciseId)} />
        ))}

        <button onClick={onAddExercise}
          className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-line rounded-2xl text-sm text-gold font-medium hover:border-[rgba(233,193,120,.4)] hover:bg-[rgba(233,193,120,.08)] transition-all">
          <Plus size={16} /> Lägg till övning
        </button>
      </div>

      <AnimatePresence>
        {prFlash && <PRFlash key="pr" onDone={() => setPrFlash(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ── WorkoutLog (root) ──────────────────────────────────────────────────────────

interface WorkoutLogProps {
  initialExercises?: { name: string }[];
  programDayName?: string;
}

type View = 'home' | 'session' | 'pick-exercise' | 'history' | 'session-detail';

export default function WorkoutLog({ initialExercises, programDayName }: WorkoutLogProps) {
  const { setFitnessPage, pendingWorkout, setPendingWorkout } = useStore();
  const { user } = useAuthStore();

  const resolvedInitial = initialExercises ?? pendingWorkout?.exercises;
  const resolvedDayName = programDayName ?? pendingWorkout?.dayName;

  const [view, setView] = useState<View>(resolvedInitial ? 'session' : 'home');
  const [sessionExercises, setSessionExercises] = useState<DraftExercise[]>(() =>
    resolvedInitial
      ? resolvedInitial.map(ex => {
          const resolved = getExerciseByName(ex.name);
          return {
            exerciseId: resolved?.id ?? ex.name.toLowerCase().replace(/\s+/g, '_'),
            exerciseName: resolved?.nameSv ?? resolved?.name ?? ex.name,
            sets: [{ id: uid(), setType: 'working' as SetType, weight: 0, reps: 0, completedAt: 0 }],
          };
        })
      : []
  );
  const [startTime, setStartTime] = useState(Date.now());
  const [dayName, setDayName] = useState<string | undefined>(resolvedDayName);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [pendingSets, setPendingSets] = useState<WorkoutSet[]>([]);
  const [pendingDuration, setPendingDuration] = useState(0);

  useEffect(() => { if (pendingWorkout) setPendingWorkout(null); }, []);

  useEffect(() => {
    if (!user) return;
    loadWorkoutSessions(user.uid).then(setSessions).catch(console.error).finally(() => setLoadingSessions(false));
  }, [user]);

  const startNewSession = useCallback(() => {
    setSessionExercises([]);
    setStartTime(Date.now());
    setDayName(undefined);
    setView('session');
  }, []);

  const addExerciseToSession = useCallback((ex: Exercise) => {
    setSessionExercises(prev => [...prev, {
      exerciseId: ex.id,
      exerciseName: ex.nameSv ?? ex.name,
      sets: [{ id: uid(), setType: 'working' as SetType, weight: 0, reps: 0, completedAt: 0 }],
    }]);
    setView('session');
  }, []);

  const requestFinish = useCallback(() => {
    const sets = draftToSets(sessionExercises);
    if (sets.length === 0) return;
    setPendingSets(sets);
    setPendingDuration(Math.round((Date.now() - startTime) / 1000));
    setShowSummary(true);
  }, [sessionExercises, startTime]);

  const saveSession = useCallback(async (mood: 1|2|3|4|5, sessionRPE: number, notes: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const endTime = Date.now();
      const session: WorkoutSession = {
        id: uid(),
        date: new Date().toISOString().slice(0, 10),
        name: dayName ?? 'Fristående pass',
        startTime, endTime,
        totalVolumeKg: totalVolumeFromSets(pendingSets),
        sets: pendingSets,
        sessionRPE, mood,
        notes: notes || undefined,
      };
      await saveWorkoutSession(user.uid, session);
      setSessions(prev => [session, ...prev]);
      setShowSummary(false);
      setView('home');
      setSessionExercises([]);
      setPendingSets([]);
    } catch (e) {
      alert('Kunde inte spara passet. Kontrollera anslutningen.');
      console.error(e);
    } finally { setSaving(false); }
  }, [user, pendingSets, dayName, startTime]);

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto relative bg-bg text-ink">
      <AnimatePresence mode="wait">

        {view === 'pick-exercise' && (
          <motion.div key="pick" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col h-full">
            <ExerciseDB standalone={false} onBack={() => setView('session')} onAddToSession={addExerciseToSession} addLabel="Välj övning" />
          </motion.div>
        )}

        {view === 'session' && (
          <motion.div key="session" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
            <ActiveSession exercises={sessionExercises} dayName={dayName} startTime={startTime} sessions={sessions}
              onAddExercise={() => setView('pick-exercise')} onUpdate={setSessionExercises}
              onFinish={requestFinish} onCancel={() => setView('home')} />
          </motion.div>
        )}

        {view === 'session-detail' && selectedSession && (
          <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
            <SessionDetail session={selectedSession} onBack={() => setView('history')} />
          </motion.div>
        )}

        {view === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-panel">
              <button onClick={() => setView('home')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
                <ChevronLeft size={18} className="text-mut" />
              </button>
              <div className="flex items-center gap-2">
                <History size={16} className="text-gold" />
                <h2 className="font-display text-ink">Passhistorik</h2>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-2 bg-bg">
              {loadingSessions ? (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-16 text-faint">
                  <History size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Inga pass loggade än</p>
                </div>
              ) : sessions.map(s => (
                <SessionHistoryCard key={s.id} session={s} onClick={() => { setSelectedSession(s); setView('session-detail'); }} />
              ))}
            </div>
          </motion.div>
        )}

        {view === 'home' && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-panel">
              <button onClick={() => setFitnessPage('home')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">
                <ChevronLeft size={18} className="text-mut" />
              </button>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(233,193,120,.15)' }}>
                  <Dumbbell size={14} className="text-gold" />
                </div>
                <h1 className="font-display text-ink text-sm">Träningslogg</h1>
              </div>
              <button onClick={() => setView('history')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-faint">
                <History size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4 bg-bg">
              <div className="vh-card p-5">
                <h3 className="text-sm font-semibold text-ink mb-1">Starta nytt pass</h3>
                <p className="text-xs text-faint mb-4">Logga övningar med settyp, vikt, reps och RPE. Progressionsförslag ingår.</p>
                <button onClick={startNewSession}
                  className="w-full flex items-center justify-center gap-2 text-[#2a1d08] font-semibold py-3 rounded-xl active:scale-[0.98] transition-all"
                  style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
                  <Play size={16} /> Starta fristående pass
                </button>
              </div>

              <button onClick={() => setFitnessPage('program')}
                className="vh-card w-full flex items-center gap-3 p-4 transition-all text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(155,140,255,.14)' }}>
                  <Calendar size={16} className="text-violet" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Starta från program</p>
                  <p className="text-xs text-faint">Dagens övningar läggs in automatiskt</p>
                </div>
                <ChevronRight size={16} className="text-faint" />
              </button>

              <button onClick={() => setFitnessPage('exercises')}
                className="vh-card w-full flex items-center gap-3 p-4 transition-all text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(233,193,120,.14)' }}>
                  <Dumbbell size={16} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Övningsdatabas</p>
                  <p className="text-xs text-faint">Sök bland alla övningar</p>
                </div>
                <ChevronRight size={16} className="text-faint" />
              </button>

              {!loadingSessions && sessions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-ink">Senaste pass</h3>
                    <button onClick={() => setView('history')} className="text-xs text-gold">Visa alla</button>
                  </div>
                  <div className="space-y-2">
                    {sessions.slice(0, 3).map(s => (
                      <SessionHistoryCard key={s.id} session={s} onClick={() => { setSelectedSession(s); setView('session-detail'); }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Summary modal – rendered outside AnimatePresence to overlay session view */}
      <AnimatePresence>
        {showSummary && (
          <SessionSummaryModal
            key="summary"
            sets={pendingSets}
            durationSec={pendingDuration}
            prCount={pendingSets.filter(s => s.isPersonalRecord).length}
            saving={saving}
            onSave={saveSession}
            onCancel={() => setShowSummary(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export { WorkoutLog };
