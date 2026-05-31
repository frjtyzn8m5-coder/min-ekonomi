/**
 * MuscleMap – SVG-baserad muskelkarta med tre lägen.
 * Ersätter react-muscle-highlighter med en intern SVG-lösning.
 */
import type { AnatomicalMuscle } from '../../types';
import { getExerciseById } from '../../utils/exerciseUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

type MuscleRole = 'primary' | 'secondary' | 'stabilizer' | 'none';
type FatigueState = 'fresh' | 'ready' | 'recovering' | 'resting';

export interface MuscleMapProps {
  mode: 'exercise' | 'weekly_volume' | 'fatigue';
  exerciseId?: string;
  weeklyVolume?: Partial<Record<AnatomicalMuscle, number>>;
  lastTrainedDays?: Partial<Record<AnatomicalMuscle, number>>;
  onMuscleClick?: (muscle: AnatomicalMuscle) => void;
  compact?: boolean;
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function roleColor(role: MuscleRole): string {
  switch (role) {
    case 'primary':   return '#f97316'; // orange-500
    case 'secondary': return '#3b82f6'; // blue-500
    case 'stabilizer':return '#9ca3af'; // gray-400
    default:          return '#e5e7eb'; // gray-200
  }
}

function volumeColor(sets: number): string {
  if (sets === 0)  return '#e5e7eb';
  if (sets <= 5)   return '#bbf7d0';
  if (sets <= 10)  return '#4ade80';
  if (sets <= 20)  return '#16a34a';
  return '#dc2626';
}

function fatigueColor(days: number | undefined): string {
  if (days === undefined) return '#e5e7eb'; // never trained → grey
  if (days < 1)   return '#fbbf24'; // yellow – just trained
  if (days < 2)   return '#fb923c'; // orange – 24–48h
  if (days <= 7)  return '#4ade80'; // green – ready
  return '#e5e7eb';                 // grey – 7+ days, high priority
}

// ── SVG muscle shapes (simplified polygons / paths) ──────────────────────────
// Front view: chest, abs, quads, shoulders, biceps, obliques
// Back view:  lats, traps, glutes, hamstrings, triceps, erectors

// Each shape is { id: AnatomicalMuscle, front: boolean, d: string }
const MUSCLE_SHAPES: Array<{
  id: AnatomicalMuscle;
  front: boolean;
  d: string;
  label: string;
}> = [
  // ── FRONT ──
  // Pectoralis major (chest) – two sides
  {
    id: 'pectoralis_major',
    front: true,
    d: 'M 68,55 C 68,50 75,45 85,48 C 90,55 88,68 82,72 C 76,70 68,65 68,55 Z',
    label: 'Bröst L',
  },
  {
    id: 'pectoralis_major',
    front: true,
    d: 'M 132,55 C 132,50 125,45 115,48 C 110,55 112,68 118,72 C 124,70 132,65 132,55 Z',
    label: 'Bröst R',
  },
  // Anterior deltoid (front shoulder)
  {
    id: 'anterior_deltoid',
    front: true,
    d: 'M 60,45 C 58,38 62,32 68,35 C 72,40 70,50 68,55 C 64,52 60,48 60,45 Z',
    label: 'Främre delt L',
  },
  {
    id: 'anterior_deltoid',
    front: true,
    d: 'M 140,45 C 142,38 138,32 132,35 C 128,40 130,50 132,55 C 136,52 140,48 140,45 Z',
    label: 'Främre delt R',
  },
  // Medial deltoid
  {
    id: 'medial_deltoid',
    front: true,
    d: 'M 55,42 C 52,36 56,28 62,30 C 66,34 66,40 64,46 C 60,44 56,43 55,42 Z',
    label: 'Laterala delt L',
  },
  {
    id: 'medial_deltoid',
    front: true,
    d: 'M 145,42 C 148,36 144,28 138,30 C 134,34 134,40 136,46 C 140,44 144,43 145,42 Z',
    label: 'Laterala delt R',
  },
  // Biceps
  {
    id: 'biceps_brachii',
    front: true,
    d: 'M 52,55 C 48,55 44,62 44,70 C 44,78 48,84 52,84 C 56,84 58,78 58,70 C 58,62 56,55 52,55 Z',
    label: 'Biceps L',
  },
  {
    id: 'biceps_brachii',
    front: true,
    d: 'M 148,55 C 152,55 156,62 156,70 C 156,78 152,84 148,84 C 144,84 142,78 142,70 C 142,62 144,55 148,55 Z',
    label: 'Biceps R',
  },
  // Rectus abdominis
  {
    id: 'rectus_abdominis',
    front: true,
    d: 'M 87,75 C 87,72 89,70 91,70 C 93,70 95,72 95,75 L 95,90 C 95,92 93,94 91,94 C 89,94 87,92 87,90 Z',
    label: 'Mage övre',
  },
  {
    id: 'rectus_abdominis',
    front: true,
    d: 'M 105,75 C 105,72 107,70 109,70 C 111,70 113,72 113,75 L 113,90 C 113,92 111,94 109,94 C 107,94 105,92 105,90 Z',
    label: 'Mage övre R',
  },
  {
    id: 'rectus_abdominis',
    front: true,
    d: 'M 87,95 C 87,93 89,91 91,91 L 95,91 C 95,93 95,110 91,110 C 88,110 87,108 87,95 Z',
    label: 'Mage nedre',
  },
  // Obliques
  {
    id: 'obliques',
    front: true,
    d: 'M 79,75 C 77,70 79,63 83,68 C 84,75 85,82 84,90 C 82,90 79,85 79,75 Z',
    label: 'Obliques L',
  },
  {
    id: 'obliques',
    front: true,
    d: 'M 121,75 C 123,70 121,63 117,68 C 116,75 115,82 116,90 C 118,90 121,85 121,75 Z',
    label: 'Obliques R',
  },
  // Quadriceps
  {
    id: 'quadriceps',
    front: true,
    d: 'M 78,118 C 76,115 74,108 76,100 C 79,93 85,95 87,100 L 88,130 C 86,132 80,128 78,118 Z',
    label: 'Quad L',
  },
  {
    id: 'quadriceps',
    front: true,
    d: 'M 122,118 C 124,115 126,108 124,100 C 121,93 115,95 113,100 L 112,130 C 114,132 120,128 122,118 Z',
    label: 'Quad R',
  },
  // Gastrocnemius (front calf)
  {
    id: 'gastrocnemius',
    front: true,
    d: 'M 79,162 C 77,158 77,150 80,146 C 83,143 86,145 87,150 L 87,165 C 85,167 80,165 79,162 Z',
    label: 'Vad L',
  },
  {
    id: 'gastrocnemius',
    front: true,
    d: 'M 121,162 C 123,158 123,150 120,146 C 117,143 114,145 113,150 L 113,165 C 115,167 120,165 121,162 Z',
    label: 'Vad R',
  },
  // Forearms (front)
  {
    id: 'forearms',
    front: true,
    d: 'M 47,88 C 44,88 41,94 41,102 C 41,110 44,116 47,116 C 50,116 52,110 52,102 C 52,94 50,88 47,88 Z',
    label: 'Underarm L',
  },
  {
    id: 'forearms',
    front: true,
    d: 'M 153,88 C 156,88 159,94 159,102 C 159,110 156,116 153,116 C 150,116 148,110 148,102 C 148,94 150,88 153,88 Z',
    label: 'Underarm R',
  },

  // ── BACK ──
  // Trapezius
  {
    id: 'trapezius',
    front: false,
    d: 'M 80,30 C 80,25 88,20 100,22 C 112,20 120,25 120,30 L 118,50 C 110,55 90,55 82,50 Z',
    label: 'Trapezius',
  },
  // Latissimus dorsi
  {
    id: 'latissimus_dorsi',
    front: false,
    d: 'M 68,52 C 64,55 62,65 64,80 C 66,88 72,92 78,90 C 82,82 84,68 82,55 C 78,50 72,50 68,52 Z',
    label: 'Lat L',
  },
  {
    id: 'latissimus_dorsi',
    front: false,
    d: 'M 132,52 C 136,55 138,65 136,80 C 134,88 128,92 122,90 C 118,82 116,68 118,55 C 122,50 128,50 132,52 Z',
    label: 'Lat R',
  },
  // Rhomboids
  {
    id: 'rhomboids',
    front: false,
    d: 'M 82,50 C 86,47 90,48 100,48 C 110,48 114,47 118,50 L 116,68 C 110,72 90,72 84,68 Z',
    label: 'Romboiderna',
  },
  // Rear deltoid
  {
    id: 'rear_deltoid',
    front: false,
    d: 'M 60,42 C 58,36 62,28 68,32 C 72,36 72,45 70,52 C 66,50 60,46 60,42 Z',
    label: 'Bakre delt L',
  },
  {
    id: 'rear_deltoid',
    front: false,
    d: 'M 140,42 C 142,36 138,28 132,32 C 128,36 128,45 130,52 C 134,50 140,46 140,42 Z',
    label: 'Bakre delt R',
  },
  // Triceps
  {
    id: 'triceps_brachii',
    front: false,
    d: 'M 52,52 C 48,52 44,60 44,70 C 44,80 48,86 52,86 C 56,86 58,80 58,70 C 58,60 56,52 52,52 Z',
    label: 'Triceps L',
  },
  {
    id: 'triceps_brachii',
    front: false,
    d: 'M 148,52 C 152,52 156,60 156,70 C 156,80 152,86 148,86 C 144,86 142,80 142,70 C 142,60 144,52 148,52 Z',
    label: 'Triceps R',
  },
  // Erector spinae
  {
    id: 'erector_spinae',
    front: false,
    d: 'M 90,72 C 88,70 87,65 88,60 C 90,57 95,57 96,60 L 96,90 C 95,92 91,92 90,90 Z',
    label: 'Erector L',
  },
  {
    id: 'erector_spinae',
    front: false,
    d: 'M 110,72 C 112,70 113,65 112,60 C 110,57 105,57 104,60 L 104,90 C 105,92 109,92 110,90 Z',
    label: 'Erector R',
  },
  // Gluteus maximus
  {
    id: 'gluteus_maximus',
    front: false,
    d: 'M 78,95 C 76,92 74,85 78,80 C 82,76 88,78 90,85 L 90,100 C 88,104 80,102 78,95 Z',
    label: 'Glutes L',
  },
  {
    id: 'gluteus_maximus',
    front: false,
    d: 'M 122,95 C 124,92 126,85 122,80 C 118,76 112,78 110,85 L 110,100 C 112,104 120,102 122,95 Z',
    label: 'Glutes R',
  },
  // Hamstrings
  {
    id: 'hamstrings',
    front: false,
    d: 'M 78,102 C 76,100 74,108 76,118 C 78,128 82,134 86,132 L 88,104 C 86,100 80,100 78,102 Z',
    label: 'Hamstring L',
  },
  {
    id: 'hamstrings',
    front: false,
    d: 'M 122,102 C 124,100 126,108 124,118 C 122,128 118,134 114,132 L 112,104 C 114,100 120,100 122,102 Z',
    label: 'Hamstring R',
  },
  // Gastrocnemius (back calf)
  {
    id: 'gastrocnemius',
    front: false,
    d: 'M 79,148 C 77,144 78,136 81,133 C 84,130 87,132 88,138 L 88,155 C 86,157 80,155 79,148 Z',
    label: 'Vad L bak',
  },
  {
    id: 'gastrocnemius',
    front: false,
    d: 'M 121,148 C 123,144 122,136 119,133 C 116,130 113,132 112,138 L 112,155 C 114,157 120,155 121,148 Z',
    label: 'Vad R bak',
  },
  // Rotator cuff (back)
  {
    id: 'rotator_cuff',
    front: false,
    d: 'M 62,38 C 62,34 66,30 70,32 C 72,36 72,42 70,46 C 66,46 62,42 62,38 Z',
    label: 'Rotatorkuff L',
  },
  {
    id: 'rotator_cuff',
    front: false,
    d: 'M 138,38 C 138,34 134,30 130,32 C 128,36 128,42 130,46 C 134,46 138,42 138,38 Z',
    label: 'Rotatorkuff R',
  },
];

// ── Body silhouette paths ─────────────────────────────────────────────────────

const BODY_FRONT = `
  M 100,10 C 88,10 80,18 80,26 C 80,34 84,40 90,44 L 68,52 C 58,56 56,68 60,80
  L 56,120 C 55,130 58,138 64,140 L 68,175 C 70,182 75,186 80,185
  C 85,184 88,180 87,175 L 84,145 C 90,147 95,148 100,148
  C 105,148 110,147 116,145 L 113,175 C 112,180 115,184 120,185
  C 125,186 130,182 132,175 L 136,140 C 142,138 145,130 144,120
  L 140,80 C 144,68 142,56 132,52 L 110,44 C 116,40 120,34 120,26 C 120,18 112,10 100,10 Z
`;

const BODY_BACK = `
  M 100,10 C 88,10 80,18 80,26 C 80,34 84,40 90,44 L 68,52 C 58,56 56,68 60,80
  L 56,120 C 55,130 58,138 64,140 L 68,175 C 70,182 75,186 80,185
  C 85,184 88,180 87,175 L 84,145 C 90,147 95,148 100,148
  C 105,148 110,147 116,145 L 113,175 C 112,180 115,184 120,185
  C 125,186 130,182 132,175 L 136,140 C 142,138 145,130 144,120
  L 140,80 C 144,68 142,56 132,52 L 110,44 C 116,40 120,34 120,26 C 120,18 112,10 100,10 Z
`;

// ── Build colour maps per mode ────────────────────────────────────────────────

function buildExerciseColors(exerciseId?: string): Map<AnatomicalMuscle, string> {
  const map = new Map<AnatomicalMuscle, string>();
  if (!exerciseId) return map;
  const ex = getExerciseById(exerciseId);
  if (!ex) return map;
  ex.primaryMuscles.forEach(m => map.set(m, roleColor('primary')));
  ex.secondaryMuscles.forEach(m => { if (!map.has(m)) map.set(m, roleColor('secondary')); });
  ex.stabilizers.forEach(m => { if (!map.has(m)) map.set(m, roleColor('stabilizer')); });
  return map;
}

function buildVolumeColors(volume?: Partial<Record<AnatomicalMuscle, number>>): Map<AnatomicalMuscle, string> {
  const map = new Map<AnatomicalMuscle, string>();
  if (!volume) return map;
  for (const [muscle, sets] of Object.entries(volume)) {
    map.set(muscle as AnatomicalMuscle, volumeColor(sets as number));
  }
  return map;
}

function buildFatigueColors(lastTrained?: Partial<Record<AnatomicalMuscle, number>>): Map<AnatomicalMuscle, string> {
  const map = new Map<AnatomicalMuscle, string>();
  if (!lastTrained) return map;
  for (const [muscle, days] of Object.entries(lastTrained)) {
    map.set(muscle as AnatomicalMuscle, fatigueColor(days as number));
  }
  return map;
}

// ── SVG Body View ─────────────────────────────────────────────────────────────

function BodyView({
  front,
  colorMap,
  onMuscleClick,
  compact,
}: {
  front: boolean;
  colorMap: Map<AnatomicalMuscle, string>;
  onMuscleClick?: (m: AnatomicalMuscle) => void;
  compact?: boolean;
}) {
  const size = compact ? 120 : 180;
  const shapes = MUSCLE_SHAPES.filter(s => s.front === front);

  // Deduplicate by id – collect all paths for same muscle
  const seen = new Set<AnatomicalMuscle>();
  const deduped = shapes.filter(s => {
    if (seen.has(s.id)) return true; // allow duplicates (left/right)
    seen.add(s.id);
    return true;
  });

  return (
    <svg viewBox="30 5 140 185" width={size} height={size * 1.1} className="flex-shrink-0">
      {/* body silhouette */}
      <path d={front ? BODY_FRONT : BODY_BACK} fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1" />

      {/* muscle shapes */}
      {deduped.map((shape, i) => {
        const color = colorMap.get(shape.id) ?? '#e5e7eb';
        return (
          <path
            key={`${shape.id}-${i}`}
            d={shape.d}
            fill={color}
            fillOpacity={color === '#e5e7eb' ? 0.5 : 0.85}
            stroke={color === '#e5e7eb' ? '#d1d5db' : color}
            strokeWidth="0.5"
            style={{ cursor: onMuscleClick ? 'pointer' : 'default' }}
            onClick={() => onMuscleClick?.(shape.id)}
          />
        );
      })}

      {/* label */}
      <text x="100" y="195" textAnchor="middle" fontSize="9" fill="#9ca3af">
        {front ? 'Framsida' : 'Baksida'}
      </text>
    </svg>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function ExerciseLegend() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {[
        { color: '#f97316', label: 'Primär' },
        { color: '#3b82f6', label: 'Sekundär' },
        { color: '#9ca3af', label: 'Stabilisator' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-[11px] text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  );
}

function VolumeLegend() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] text-gray-500">Set/vecka:</span>
      {[
        { color: '#e5e7eb', label: '0' },
        { color: '#bbf7d0', label: '1–5' },
        { color: '#4ade80', label: '6–10' },
        { color: '#16a34a', label: '11–20' },
        { color: '#dc2626', label: '>20' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  );
}

function FatigueLegend() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[
        { color: '#fbbf24', label: '<24h (vila)' },
        { color: '#fb923c', label: '24–48h' },
        { color: '#4ade80', label: 'Redo' },
        { color: '#e5e7eb', label: 'Ej tränad' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: color }} />
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
      ))}
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
  let colorMap: Map<AnatomicalMuscle, string>;

  if (mode === 'exercise') {
    colorMap = buildExerciseColors(exerciseId);
  } else if (mode === 'weekly_volume') {
    colorMap = buildVolumeColors(weeklyVolume);
  } else {
    colorMap = buildFatigueColors(lastTrainedDays);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-4">
        <BodyView front={true}  colorMap={colorMap} onMuscleClick={onMuscleClick} compact={compact} />
        <BodyView front={false} colorMap={colorMap} onMuscleClick={onMuscleClick} compact={compact} />
      </div>

      {!compact && (
        <div className="pt-1">
          {mode === 'exercise'      && <ExerciseLegend />}
          {mode === 'weekly_volume' && <VolumeLegend />}
          {mode === 'fatigue'       && <FatigueLegend />}
        </div>
      )}
    </div>
  );
}
