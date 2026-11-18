/**
 * MuscleMap – anatomisk muskelkarta byggd på react-body-highlighter (MIT).
 * Visar fram- och baksida med markerade muskler i tre lägen:
 *  - exercise:       primär / sekundär / stabilisator för en övning
 *  - weekly_volume:  antal set per muskelgrupp (heatmap)
 *  - fatigue:        återhämtningsstatus (dagar sedan träning)
 *
 * Behåller samma publika API (MuscleMapProps) som tidigare SVG-versionen så att
 * ExerciseDB och Development inte behöver ändras.
 */
import Model, { type IExerciseData, type Muscle, type IMuscleStats } from 'react-body-highlighter';
import type { AnatomicalMuscle } from '../../types';
import { getExerciseById } from '../../utils/exerciseUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MuscleMapProps {
  mode: 'exercise' | 'weekly_volume' | 'fatigue';
  exerciseId?: string;
  weeklyVolume?: Partial<Record<AnatomicalMuscle, number>>;
  lastTrainedDays?: Partial<Record<AnatomicalMuscle, number>>;
  onMuscleClick?: (muscle: AnatomicalMuscle) => void;
  compact?: boolean;
}

// ── Palette ───────────────────────────────────────────────────────────────────

const GOLD = '#e9c178';
const CYAN = '#5fe0d0';
const VIOLET = '#9b8cff';
const LIME = '#aee07a';
const CORAL = '#ff8f7a';
const BODY_BASE = 'rgba(244,241,234,.10)'; // unworked muscles on dark bg

// ── Muscle mapping: our AnatomicalMuscle → react-body-highlighter Muscle ────────

const MUSCLE_TO_LIB: Record<AnatomicalMuscle, Muscle | null> = {
  pectoralis_major: 'chest',
  pectoralis_minor: 'chest',
  serratus_anterior: 'chest',
  latissimus_dorsi: 'upper-back',
  rhomboids: 'upper-back',
  trapezius: 'trapezius',
  rear_deltoid: 'back-deltoids',
  rotator_cuff: 'back-deltoids',
  anterior_deltoid: 'front-deltoids',
  medial_deltoid: 'front-deltoids',
  biceps_brachii: 'biceps',
  brachialis: 'biceps',
  triceps_brachii: 'triceps',
  brachioradialis: 'forearm',
  forearms: 'forearm',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstring',
  gluteus_maximus: 'gluteal',
  gluteus_medius: 'gluteal',
  gluteus_minimus: 'gluteal',
  gastrocnemius: 'calves',
  soleus: 'calves',
  rectus_abdominis: 'abs',
  transverse_abdominis: 'abs',
  core: 'abs',
  obliques: 'obliques',
  erector_spinae: 'lower-back',
  multifidus: 'lower-back',
};

// Reverse (best-effort, first match) for onMuscleClick callbacks.
const LIB_TO_MUSCLE: Partial<Record<Muscle, AnatomicalMuscle>> = (() => {
  const m: Partial<Record<Muscle, AnatomicalMuscle>> = {};
  for (const [anat, lib] of Object.entries(MUSCLE_TO_LIB) as [AnatomicalMuscle, Muscle | null][]) {
    if (lib && !m[lib]) m[lib] = anat;
  }
  return m;
})();

function mapMuscles(muscles: AnatomicalMuscle[]): Muscle[] {
  const out: Muscle[] = [];
  for (const mm of muscles) {
    const lib = MUSCLE_TO_LIB[mm];
    if (lib && !out.includes(lib)) out.push(lib);
  }
  return out;
}

// ── Build data + colour scale per mode ──────────────────────────────────────────
// react-body-highlighter colours by summed frequency: highlightedColors[freq-1].
// We assign disjoint frequency buckets (higher-priority role wins) so every
// highlighted muscle lands on exactly one colour.

interface BuiltData {
  data: IExerciseData[];
  colors: string[];
}

function buildExercise(exerciseId?: string): BuiltData {
  const colors = [VIOLET, CYAN, GOLD]; // freq 1 = stabiliser, 2 = secondary, 3 = primary
  if (!exerciseId) return { data: [], colors };
  const ex = getExerciseById(exerciseId);
  if (!ex) return { data: [], colors };

  const assigned = new Set<Muscle>();
  const take = (muscles: AnatomicalMuscle[]): Muscle[] => {
    const libs: Muscle[] = [];
    for (const lib of mapMuscles(muscles)) {
      if (!assigned.has(lib)) { assigned.add(lib); libs.push(lib); }
    }
    return libs;
  };

  // primary first (highest priority), then secondary, then stabilisers
  const primary = take(ex.primaryMuscles);
  const secondary = take(ex.secondaryMuscles);
  const stabilisers = take(ex.stabilizers);

  const data: IExerciseData[] = [];
  if (stabilisers.length) data.push({ name: 'Stabilisator', muscles: stabilisers, frequency: 1 });
  if (secondary.length) data.push({ name: 'Sekundär', muscles: secondary, frequency: 2 });
  if (primary.length) data.push({ name: 'Primär', muscles: primary, frequency: 3 });
  return { data, colors };
}

function volumeBucket(sets: number): number {
  if (sets <= 0) return 0;
  if (sets <= 5) return 1;
  if (sets <= 10) return 2;
  if (sets <= 20) return 3;
  return 4;
}

function buildVolume(volume?: Partial<Record<AnatomicalMuscle, number>>): BuiltData {
  const colors = [CYAN, LIME, GOLD, CORAL]; // freq 1..4
  const data: IExerciseData[] = [];
  if (!volume) return { data, colors };
  const byBucket: Record<number, Muscle[]> = {};
  for (const [muscle, sets] of Object.entries(volume)) {
    const b = volumeBucket(sets as number);
    if (b === 0) continue;
    const lib = MUSCLE_TO_LIB[muscle as AnatomicalMuscle];
    if (!lib) continue;
    (byBucket[b] ||= []).push(lib);
  }
  for (const [b, muscles] of Object.entries(byBucket)) {
    data.push({ name: `vol-${b}`, muscles: [...new Set(muscles)], frequency: Number(b) });
  }
  return { data, colors };
}

function fatigueBucket(days: number | undefined): number {
  if (days === undefined) return 0;
  if (days <= 7) return 1;     // ready (lime)
  return 0;
}
// NOTE: fatigue colour semantics – 1=redo(lime), 2=24-48h(coral), 3=<24h(guld)
function buildFatigue(lastTrained?: Partial<Record<AnatomicalMuscle, number>>): BuiltData {
  const colors = [LIME, CORAL, GOLD]; // freq 1..3
  const data: IExerciseData[] = [];
  if (!lastTrained) return { data, colors };
  const byBucket: Record<number, Muscle[]> = {};
  for (const [muscle, days] of Object.entries(lastTrained)) {
    const d = days as number;
    let b: number;
    if (d < 1) b = 3;        // just trained → rest (gold)
    else if (d < 2) b = 2;   // 24–48h (coral)
    else if (d <= 7) b = 1;  // ready (lime)
    else continue;           // 7+ days → base
    const lib = MUSCLE_TO_LIB[muscle as AnatomicalMuscle];
    if (!lib) continue;
    (byBucket[b] ||= []).push(lib);
  }
  for (const [b, muscles] of Object.entries(byBucket)) {
    data.push({ name: `fat-${b}`, muscles: [...new Set(muscles)], frequency: Number(b) });
  }
  return { data, colors };
}

// ── Legends ─────────────────────────────────────────────────────────────────────

function Legend({ items, prefix }: { items: { color: string; label: string }[]; prefix?: string }) {
  return (
    <div className="flex items-center gap-3 flex-wrap justify-center">
      {prefix && <span className="text-[11px] text-mut">{prefix}</span>}
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-[11px] text-mut">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Body view wrapper ────────────────────────────────────────────────────────────

function BodyView({
  type,
  data,
  colors,
  onClick,
  label,
  size,
}: {
  type: 'anterior' | 'posterior';
  data: IExerciseData[];
  colors: string[];
  onClick?: (e: IMuscleStats) => void;
  label: string;
  size: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Model
        type={type}
        data={data}
        bodyColor={BODY_BASE}
        highlightedColors={colors}
        onClick={onClick as any}
        style={{ width: size, height: 'auto' }}
        svgStyle={{ width: '100%', height: 'auto' }}
      />
      <span className="text-[10px] text-faint">{label}</span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MuscleMap({
  mode,
  exerciseId,
  weeklyVolume,
  lastTrainedDays,
  onMuscleClick,
  compact,
}: MuscleMapProps) {
  let built: BuiltData;
  if (mode === 'exercise') built = buildExercise(exerciseId);
  else if (mode === 'weekly_volume') built = buildVolume(weeklyVolume);
  else built = buildFatigue(lastTrainedDays);

  const size = compact ? 120 : 150;

  const handleClick = onMuscleClick
    ? (stats: IMuscleStats) => {
        const anat = LIB_TO_MUSCLE[stats.muscle];
        if (anat) onMuscleClick(anat);
      }
    : undefined;

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-6">
        <BodyView type="anterior" data={built.data} colors={built.colors} onClick={handleClick} label="Framsida" size={size} />
        <BodyView type="posterior" data={built.data} colors={built.colors} onClick={handleClick} label="Baksida" size={size} />
      </div>

      {!compact && (
        <div className="pt-1">
          {mode === 'exercise' && (
            <Legend items={[
              { color: GOLD, label: 'Primär' },
              { color: CYAN, label: 'Sekundär' },
              { color: VIOLET, label: 'Stabilisator' },
            ]} />
          )}
          {mode === 'weekly_volume' && (
            <Legend prefix="Set/vecka:" items={[
              { color: CYAN, label: '1–5' },
              { color: LIME, label: '6–10' },
              { color: GOLD, label: '11–20' },
              { color: CORAL, label: '>20' },
            ]} />
          )}
          {mode === 'fatigue' && (
            <Legend items={[
              { color: GOLD, label: '<24h (vila)' },
              { color: CORAL, label: '24–48h' },
              { color: LIME, label: 'Redo' },
            ]} />
          )}
        </div>
      )}
    </div>
  );
}
