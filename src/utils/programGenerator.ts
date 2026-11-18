// ── Träningsprogram-generator (evidensbaserad) ────────────────────────────────
//
// Genererar riktiga hypertrofi-/styrkeprogram från det riktiga övnings-
// biblioteket (~876 övningar i exercises.json) utifrån användarens input.
//
// Designprinciper som är inbyggda (kort sammanfattning av forskningsläget):
//
//  • SPLIT efter frekvens: muskeln växer bäst när veckovolymen fördelas på
//    ≥2 pass/vecka. 2–3 dagar → helkropp (hög frekvens per muskel), 4 → upper/
//    lower, 5 → push/pull/ben + upper/lower, 6 → push/pull/ben ×2.
//  • VOLYM-LANDMÄRKEN (Israetel/RP): varje muskel har MEV (minsta effektiva
//    volym) och MAV (max adaptiv volym) i arbetsset/vecka. Nybörjare ligger nära
//    MEV (~10 set), medel 12–18, avancerad högre. Fokusmuskler skjuts mot MAV.
//  • REP/INTENSITET efter mål: styrka 3–6 reps @ RPE 7–9 + lång vila, hypertrofi
//    6–12 reps @ RPE 7–9, uthållighet/hälsa 12–20 reps. Compounds lägre reps,
//    isolationer högre.
//  • ÖVNINGSVAL: compounds först (störst avkastning), därefter isolationer. Allt
//    filtreras på tillgänglig utrustning och skadade områden. Alla stora muskel-
//    grupper täcks över veckan.
//  • PERIODISERING: ett block på 4–6 veckor med progressiv överbelastning
//    (stigande RPE + volym på fokusmuskler vecka för vecka) som avslutas med en
//    deload-vecka (~50 % volym, lägre RPE) för återhämtning.
//
// Funktionen är DETERMINISTISK – ingen Math.random. Variation styrs av `seed`.

import type {
  Exercise,
  WorkoutProgram,
  WorkoutDay,
  ProgramExercise,
  ProgramSplit,
  TrainingGoal,
  ExperienceLevel,
  TrainingProfile,
  AnatomicalMuscle,
  ExerciseEquipment,
} from '../types';
import { EXERCISES } from './exerciseUtils';
import { nanoid } from 'nanoid';

// ── Muskelgrupper ─────────────────────────────────────────────────────────────

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core';

const GROUP_MUSCLES: Record<MuscleGroup, AnatomicalMuscle[]> = {
  chest: ['pectoralis_major', 'pectoralis_minor'],
  back: ['latissimus_dorsi', 'rhomboids', 'trapezius'],
  shoulders: ['anterior_deltoid', 'medial_deltoid', 'rear_deltoid'],
  biceps: ['biceps_brachii', 'brachialis', 'brachioradialis'],
  triceps: ['triceps_brachii'],
  quads: ['quadriceps'],
  hamstrings: ['hamstrings'],
  glutes: ['gluteus_maximus', 'gluteus_medius', 'gluteus_minimus'],
  calves: ['gastrocnemius', 'soleus'],
  core: ['rectus_abdominis', 'obliques', 'transverse_abdominis'],
};

export const GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Bröst',
  back: 'Rygg',
  shoulders: 'Axlar',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quadriceps',
  hamstrings: 'Baksida lår',
  glutes: 'Säte',
  calves: 'Vader',
  core: 'Mage/Core',
};

// Veckovolym-landmärken i arbetsset/vecka (MEV → MAV), hypertrofi-baslinje.
const VOLUME_LANDMARKS: Record<MuscleGroup, { mev: number; mav: number }> = {
  chest: { mev: 10, mav: 22 },
  back: { mev: 10, mav: 22 },
  shoulders: { mev: 8, mav: 22 },
  biceps: { mev: 8, mav: 20 },
  triceps: { mev: 8, mav: 18 },
  quads: { mev: 8, mav: 20 },
  hamstrings: { mev: 6, mav: 16 },
  glutes: { mev: 6, mav: 16 },
  calves: { mev: 8, mav: 18 },
  core: { mev: 4, mav: 16 },
};

// ── Options / output-typer ────────────────────────────────────────────────────

export type ProgramFocus = MuscleGroup | 'balanced';

export interface GenerateProgramOptions {
  goal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  trainingDaysPerWeek: number;      // 2–6
  availableEquipment: string[];     // ExerciseEquipment-värden
  sessionLengthMin?: number;        // t.ex. 45 / 60 / 75 / 90 → styr antal övningar/pass
  focus?: ProgramFocus;             // prioriterad muskelgrupp (eller balanserat)
  injuries?: string;                // fritext – områden som undviks
  gender?: 'male' | 'female';
  blockLengthWeeks?: number;        // default 5 (4 progression + 1 deload)
  seed?: number;                    // deterministisk variation
  name?: string;                    // valfritt eget namn
}

export interface MuscleVolume {
  group: MuscleGroup;
  label: string;
  sets: number;   // arbetsset/vecka (vecka 1)
  mev: number;
  mav: number;
  status: 'below' | 'optimal' | 'high';
}

export type ProgramPhase = 'accumulation' | 'intensification' | 'deload';

export interface GeneratedWeek {
  week: number;              // 1-baserat
  phase: ProgramPhase;
  label: string;             // "Vecka 1 · Uppbyggnad"
  rpeTarget: number;         // genomsnittligt RPE-mål
  days: WorkoutDay[];        // träningsdagar (utan vilodagar)
}

// GeneratedProgram ÄR en WorkoutProgram (bakåtkompatibel med spelaren/lagringen):
// `schedule` innehåller vecka 1 utlagd på veckodagar. De extra fälten läser
// förhandsvisningen men ignoreras av den befintliga spelaren.
export interface GeneratedProgram extends WorkoutProgram {
  isGenerated: true;
  seed: number;
  blockLengthWeeks: number;
  sessionLengthMin?: number;
  focus: ProgramFocus;
  weeks: GeneratedWeek[];
  weeklySetsPerMuscle: MuscleVolume[];
  designNotes: string[];
}

// ── Intern planeringsmodell ───────────────────────────────────────────────────

interface PlannedExercise {
  exercise: Exercise;
  group: MuscleGroup;
  sets: number;
  repRange: [number, number];
  rest: number;
  rpe: number;
  isCompound: boolean;
}

interface PlannedSession {
  key: string;
  splitLabel: string;
  dayName: string;
  targets: MuscleGroup[];
  compoundGroups: MuscleGroup[];   // grupper som ska ha en compound-ankare
  items: PlannedExercise[];
}

const WEEK_DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

// Jämn utspridning av träningsdagar över veckan (indexen i WEEK_DAYS).
const TRAIN_ON: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 6],
};

// ── Split-val ─────────────────────────────────────────────────────────────────

function chooseSplit(days: number, experience: ExperienceLevel): ProgramSplit {
  if (days <= 3 || experience === 'beginner') return days >= 4 ? 'upper_lower' : 'full_body';
  if (days === 4) return 'upper_lower';
  return 'ppl';
}

// Session-arketyper (vilka grupper varje passtyp tränar + vilka som ska ha compound).
interface SessionArchetype {
  key: string;
  splitLabel: string;
  targets: MuscleGroup[];
  compoundGroups: MuscleGroup[];
}

const ARCH: Record<string, SessionArchetype> = {
  fullA: { key: 'full_a', splitLabel: 'Helkropp A', targets: ['quads', 'chest', 'back', 'shoulders', 'biceps', 'core'], compoundGroups: ['quads', 'chest', 'back'] },
  fullB: { key: 'full_b', splitLabel: 'Helkropp B', targets: ['hamstrings', 'glutes', 'shoulders', 'back', 'triceps', 'calves'], compoundGroups: ['hamstrings', 'shoulders', 'back'] },
  fullC: { key: 'full_c', splitLabel: 'Helkropp C', targets: ['quads', 'chest', 'back', 'biceps', 'triceps', 'core'], compoundGroups: ['quads', 'chest', 'back'] },
  upperA: { key: 'upper_a', splitLabel: 'Överkropp A', targets: ['chest', 'back', 'shoulders', 'triceps', 'biceps'], compoundGroups: ['chest', 'back'] },
  lowerA: { key: 'lower_a', splitLabel: 'Underkropp A', targets: ['quads', 'hamstrings', 'glutes', 'calves', 'core'], compoundGroups: ['quads', 'hamstrings'] },
  upperB: { key: 'upper_b', splitLabel: 'Överkropp B', targets: ['back', 'chest', 'shoulders', 'biceps', 'triceps'], compoundGroups: ['back', 'chest'] },
  lowerB: { key: 'lower_b', splitLabel: 'Underkropp B', targets: ['hamstrings', 'glutes', 'quads', 'calves', 'core'], compoundGroups: ['hamstrings', 'glutes'] },
  push: { key: 'push', splitLabel: 'Push', targets: ['chest', 'shoulders', 'triceps'], compoundGroups: ['chest', 'shoulders'] },
  pull: { key: 'pull', splitLabel: 'Pull', targets: ['back', 'biceps', 'shoulders'], compoundGroups: ['back'] },
  legs: { key: 'legs', splitLabel: 'Ben', targets: ['quads', 'hamstrings', 'glutes', 'calves'], compoundGroups: ['quads', 'hamstrings'] },
};

function chooseArchetypes(split: ProgramSplit, days: number): SessionArchetype[] {
  if (split === 'full_body') {
    const rot = [ARCH.fullA, ARCH.fullB, ARCH.fullC];
    const out: SessionArchetype[] = [];
    for (let i = 0; i < days; i++) out.push(rot[i % rot.length]);
    return out;
  }
  if (split === 'upper_lower') {
    const rot = [ARCH.upperA, ARCH.lowerA, ARCH.upperB, ARCH.lowerB];
    const out: SessionArchetype[] = [];
    for (let i = 0; i < days; i++) out.push(rot[i % rot.length]);
    return out;
  }
  // PPL
  if (days <= 3) return [ARCH.push, ARCH.pull, ARCH.legs];
  if (days === 4) return [ARCH.push, ARCH.pull, ARCH.legs, ARCH.upperA];
  if (days === 5) return [ARCH.push, ARCH.pull, ARCH.legs, ARCH.upperA, ARCH.lowerA];
  return [ARCH.push, ARCH.pull, ARCH.legs, ARCH.push, ARCH.pull, ARCH.legs];
}

// ── Mål-parametrar ────────────────────────────────────────────────────────────

interface GoalParams {
  compoundReps: [number, number];
  isoReps: [number, number];
  baseRpe: number;
  compoundRest: number;
  isoRest: number;
  volumeScale: number;    // multiplikator på veckovolym
}

function goalParams(goal: TrainingGoal): GoalParams {
  switch (goal) {
    case 'strength':
      return { compoundReps: [3, 6], isoReps: [6, 10], baseRpe: 8, compoundRest: 210, isoRest: 120, volumeScale: 0.75 };
    case 'gain_muscle':
      return { compoundReps: [6, 10], isoReps: [10, 15], baseRpe: 8, compoundRest: 150, isoRest: 75, volumeScale: 1.1 };
    case 'recomp':
      return { compoundReps: [6, 10], isoReps: [10, 15], baseRpe: 8, compoundRest: 120, isoRest: 75, volumeScale: 1.0 };
    case 'lose_fat':
      return { compoundReps: [8, 12], isoReps: [12, 15], baseRpe: 8, compoundRest: 90, isoRest: 50, volumeScale: 0.95 };
    case 'endurance':
    default:
      return { compoundReps: [12, 15], isoReps: [15, 20], baseRpe: 7, compoundRest: 75, isoRest: 45, volumeScale: 0.9 };
  }
}

function experienceScale(exp: ExperienceLevel): number {
  // Position mellan MEV (0) och MAV (1) för icke-fokusgrupper.
  if (exp === 'beginner') return 0.0;
  if (exp === 'intermediate') return 0.4;
  return 0.6;
}

// ── Veckovolym per muskelgrupp ────────────────────────────────────────────────

function weeklyTargetSets(
  group: MuscleGroup,
  opts: GenerateProgramOptions,
  gp: GoalParams,
): number {
  const { mev, mav } = VOLUME_LANDMARKS[group];
  let pos = experienceScale(opts.experienceLevel);
  if (opts.focus && opts.focus !== 'balanced' && opts.focus === group) {
    pos = Math.min(1, pos + 0.4);   // fokusmuskel → mot MAV
  }
  let target = mev + (mav - mev) * pos;
  target *= gp.volumeScale;
  return Math.max(mev, Math.min(mav, Math.round(target)));
}

// ── Utrustnings- & skadefilter ────────────────────────────────────────────────

function parseInjuries(text?: string): Set<MuscleGroup> {
  const avoid = new Set<MuscleGroup>();
  if (!text) return avoid;
  const t = text.toLowerCase();
  const map: { keys: string[]; groups: MuscleGroup[] }[] = [
    { keys: ['axel', 'axlar', 'shoulder', 'rotator', 'rotatorkuff'], groups: ['shoulders'] },
    { keys: ['knä', 'kna', 'knee', 'menisk', 'patella'], groups: ['quads'] },
    { keys: ['rygg', 'ländrygg', 'landrygg', 'back', 'disk', 'ischias', 'spine'], groups: ['back', 'hamstrings'] },
    { keys: ['armbåge', 'armbage', 'elbow', 'tennisarm'], groups: ['biceps', 'triceps'] },
    { keys: ['bröst', 'brost', 'chest', 'pec'], groups: ['chest'] },
    { keys: ['höft', 'hoft', 'hip', 'säte', 'sate', 'glute'], groups: ['glutes', 'hamstrings'] },
    { keys: ['vad', 'vrist', 'ankel', 'ankle', 'calf', 'achilles', 'hälsena', 'halsena'], groups: ['calves'] },
    { keys: ['handled', 'wrist'], groups: ['biceps', 'triceps'] },
  ];
  for (const { keys, groups } of map) {
    if (keys.some((k) => t.includes(k))) groups.forEach((g) => avoid.add(g));
  }
  return avoid;
}

function diffRank(d: Exercise['difficulty']): number {
  return d === 'beginner' ? 0 : d === 'intermediate' ? 1 : 2;
}

function maxDifficulty(exp: ExperienceLevel): number {
  // Nybörjare får tillgång till intermediate-compounds (t.ex. bänkpress), men
  // inte avancerade lyft. Medel/avancerad får allt.
  return exp === 'beginner' ? 1 : 2;
}

// Bygg kandidatlistor per grupp, filtrerade och stabilt sorterade.
function buildCandidatePools(opts: GenerateProgramOptions): Record<MuscleGroup, { compound: Exercise[]; iso: Exercise[] }> {
  const avail = new Set<ExerciseEquipment>(opts.availableEquipment as ExerciseEquipment[]);
  avail.add('bodyweight'); // kroppsvikt alltid möjligt
  const maxDiff = maxDifficulty(opts.experienceLevel);

  const doable = (ex: Exercise, relax: boolean): boolean => {
    if (ex.type !== 'strength') return false;
    if (diffRank(ex.difficulty) > maxDiff) return false;
    if (ex.equipment.length === 0) return true;
    return relax
      ? ex.equipment.some((e) => avail.has(e))
      : ex.equipment.every((e) => avail.has(e));
  };

  const pools = {} as Record<MuscleGroup, { compound: Exercise[]; iso: Exercise[] }>;
  for (const g of Object.keys(GROUP_MUSCLES) as MuscleGroup[]) pools[g] = { compound: [], iso: [] };

  const fill = (relax: boolean) => {
    for (const g of Object.keys(GROUP_MUSCLES) as MuscleGroup[]) {
      if (pools[g].compound.length + pools[g].iso.length > 0) continue;
      const list = EXERCISES.filter((ex) => {
        if (!doable(ex, relax)) return false;
        return ex.primaryMuscles.some((m) => GROUP_MUSCLES[g].includes(m));
      });
      // Stabil sortering: compound > barbell/hantel-prioritet > namn (deterministiskt).
      const eqPriority = (ex: Exercise): number => {
        if (ex.equipment.includes('barbell')) return 0;
        if (ex.equipment.includes('dumbbell')) return 1;
        if (ex.equipment.includes('cable')) return 2;
        if (ex.equipment.includes('machine')) return 3;
        return 4;
      };
      const sorted = [...list].sort((a, b) => eqPriority(a) - eqPriority(b) || a.id.localeCompare(b.id));
      pools[g].compound = sorted.filter((e) => e.isCompound);
      pools[g].iso = sorted.filter((e) => !e.isCompound);
    }
  };

  fill(false);
  fill(true); // relaxa utrustningsfiltret för grupper som blev tomma
  return pools;
}

// ── Pass-byggande ─────────────────────────────────────────────────────────────

function pick(list: Exercise[], offset: number, used: Set<string>): Exercise | null {
  if (list.length === 0) return null;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const cand = list[(offset + i) % n];
    if (!used.has(cand.id)) return cand;
  }
  return list[offset % n]; // alla använda → tillåt återanvändning deterministiskt
}

function buildSessions(opts: GenerateProgramOptions): { sessions: PlannedSession[]; weeklySets: Record<MuscleGroup, number> } {
  const gp = goalParams(opts.goal);
  const split = chooseSplit(opts.trainingDaysPerWeek, opts.experienceLevel);
  const archetypes = chooseArchetypes(split, opts.trainingDaysPerWeek);
  const pools = buildCandidatePools(opts);
  const avoid = parseInjuries(opts.injuries);
  const seed = opts.seed ?? 0;

  // Veckomål och frekvens per grupp.
  const groups = Object.keys(GROUP_MUSCLES) as MuscleGroup[];
  const weeklyTarget: Record<MuscleGroup, number> = {} as Record<MuscleGroup, number>;
  const freq: Record<MuscleGroup, number> = {} as Record<MuscleGroup, number>;
  for (const g of groups) {
    weeklyTarget[g] = avoid.has(g) ? 0 : weeklyTargetSets(g, opts, gp);
    freq[g] = 0;
  }
  for (const a of archetypes) for (const g of a.targets) if (!avoid.has(g)) freq[g] += 1;

  // Max övningar per pass utifrån sessionslängd (~10 min/övning, inkl. uppvärmning).
  const maxExPerSession = opts.sessionLengthMin
    ? Math.max(3, Math.min(9, Math.round(opts.sessionLengthMin / 10)))
    : 7;

  const usedPerGroup: Record<MuscleGroup, Set<string>> = {} as Record<MuscleGroup, Set<string>>;
  const rotPerGroup: Record<MuscleGroup, number> = {} as Record<MuscleGroup, number>;
  for (const g of groups) { usedPerGroup[g] = new Set(); rotPerGroup[g] = seed; }

  const actualWeekly: Record<MuscleGroup, number> = {} as Record<MuscleGroup, number>;
  for (const g of groups) actualWeekly[g] = 0;

  const sessions: PlannedSession[] = archetypes.map((a) => ({
    key: a.key, splitLabel: a.splitLabel, dayName: a.splitLabel, targets: a.targets, compoundGroups: a.compoundGroups, items: [],
  }));

  // För varje pass: fyll compounds först (ankarlyft), sen isolationer, mot
  // set-mål per grupp (veckomål / frekvens), begränsat av passlängd.
  sessions.forEach((session) => {
    const liveTargets = session.targets.filter((g) => !avoid.has(g) && freq[g] > 0);
    const compoundFirst = session.compoundGroups.filter((g) => liveTargets.includes(g));
    const rest = liveTargets.filter((g) => !compoundFirst.includes(g));
    const order = [...compoundFirst, ...rest];

    const perSessionTarget: Record<string, number> = {};
    for (const g of liveTargets) {
      perSessionTarget[g] = Math.max(2, Math.min(6, Math.round(weeklyTarget[g] / Math.max(1, freq[g]))));
    }

    // Runda 1: en compound (eller bästa tillgängliga) per grupp i ordning.
    const added: Record<string, number> = {};
    for (const g of order) {
      if (session.items.length >= maxExPerSession) break;
      const isCompoundGroup = compoundFirst.includes(g);
      const poolPrimary = isCompoundGroup ? pools[g].compound : pools[g].iso;
      const poolFallback = isCompoundGroup ? pools[g].iso : pools[g].compound;
      const chosen = pick(poolPrimary, rotPerGroup[g], usedPerGroup[g]) ?? pick(poolFallback, rotPerGroup[g], usedPerGroup[g]);
      if (!chosen) continue;
      usedPerGroup[g].add(chosen.id);
      rotPerGroup[g] += 1;
      const cmp = chosen.isCompound;
      const setCount = cmp ? (opts.goal === 'strength' ? 4 : 3) : 3;
      session.items.push({
        exercise: chosen, group: g, sets: setCount,
        repRange: cmp ? gp.compoundReps : gp.isoReps,
        rest: cmp ? gp.compoundRest : gp.isoRest,
        rpe: gp.baseRpe, isCompound: cmp,
      });
      added[g] = (added[g] ?? 0) + setCount;
      actualWeekly[g] += setCount;
    }

    // Runda 2: fyll grupper som ännu inte nått sitt pass-mål med en extra övning.
    let guard = 0;
    while (session.items.length < maxExPerSession && guard < 20) {
      guard++;
      // Hitta gruppen med störst underskott mot pass-målet.
      let best: MuscleGroup | null = null;
      let bestDeficit = 0;
      for (const g of liveTargets) {
        const deficit = perSessionTarget[g] - (added[g] ?? 0);
        if (deficit > bestDeficit) { bestDeficit = deficit; best = g; }
      }
      if (!best) break;
      const g = best;
      const chosen = pick(pools[g].iso, rotPerGroup[g], usedPerGroup[g]) ?? pick(pools[g].compound, rotPerGroup[g], usedPerGroup[g]);
      if (!chosen) { added[g] = perSessionTarget[g]; continue; }
      usedPerGroup[g].add(chosen.id);
      rotPerGroup[g] += 1;
      const setCount = 3;
      session.items.push({
        exercise: chosen, group: g, sets: setCount,
        repRange: chosen.isCompound ? gp.compoundReps : gp.isoReps,
        rest: chosen.isCompound ? gp.compoundRest : gp.isoRest,
        rpe: gp.baseRpe, isCompound: chosen.isCompound,
      });
      added[g] = (added[g] ?? 0) + setCount;
      actualWeekly[g] += setCount;
    }

    // Sortera passet: compounds först, därefter isolationer (behåller inbördes ordning).
    session.items.sort((a, b) => Number(b.isCompound) - Number(a.isCompound));
  });

  return { sessions, weeklySets: actualWeekly };
}

// ── Periodisering: bygg veckor ────────────────────────────────────────────────

function repRangeStr(r: [number, number]): string {
  return r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`;
}

function rpeToRir(rpe: number): string {
  const rir = Math.max(0, Math.round(10 - rpe));
  return `RPE ${rpe % 1 === 0 ? rpe : rpe.toFixed(1)} · ~${rir} RIR`;
}

function exName(ex: Exercise): string {
  return ex.nameSv && ex.nameSv.trim() ? ex.nameSv : ex.name;
}

function plannedToProgramExercise(p: PlannedExercise, sets: number, rpe: number, deload: boolean): ProgramExercise {
  return {
    name: exName(p.exercise),
    sets,
    repsRange: repRangeStr(p.repRange),
    rest: p.rest,
    note: deload ? `Deload · ${rpeToRir(rpe)}` : rpeToRir(rpe),
  };
}

function buildWeeks(
  sessions: PlannedSession[],
  opts: GenerateProgramOptions,
  focus: ProgramFocus,
): GeneratedWeek[] {
  const block = Math.max(3, Math.min(8, opts.blockLengthWeeks ?? 5));
  const gp = goalParams(opts.goal);
  const weeks: GeneratedWeek[] = [];

  for (let w = 1; w <= block; w++) {
    const isDeload = w === block;
    const accWeeks = block - 1; // antal uppbyggnadsveckor
    // RPE rampas 0.5/vecka under uppbyggnad, deload sänks kraftigt.
    const rpe = isDeload
      ? Math.max(6, gp.baseRpe - 2)
      : Math.min(gp.baseRpe + 1.5, gp.baseRpe - 1 + (w - 1) * 0.5);

    const phase: ProgramPhase = isDeload
      ? 'deload'
      : w > Math.ceil(accWeeks / 2) ? 'intensification' : 'accumulation';

    const days: WorkoutDay[] = sessions.map((s) => {
      const exercises: ProgramExercise[] = s.items.map((p) => {
        const isFocus = focus !== 'balanced' && p.group === focus;
        let sets = p.sets;
        if (isDeload) {
          sets = Math.max(1, Math.ceil(p.sets * 0.5));
        } else if (opts.goal !== 'strength') {
          // Volymprogression: +1 set på fokusgruppens övningar varannan vecka.
          const bump = isFocus ? Math.floor((w - 1) / 1) : Math.floor((w - 1) / 2);
          sets = Math.min(p.sets + bump, p.sets + (isFocus ? 2 : 1));
        }
        return plannedToProgramExercise(p, sets, rpe, isDeload);
      });
      return { dayName: s.dayName, splitLabel: s.splitLabel, exercises };
    });

    const label = isDeload
      ? `Vecka ${w} · Deload`
      : `Vecka ${w} · ${phase === 'intensification' ? 'Intensifiering' : 'Uppbyggnad'}`;

    weeks.push({ week: w, phase, label, rpeTarget: Math.round(rpe * 10) / 10, days });
  }

  return weeks;
}

// ── Veckodags-schemaläggning (för WorkoutProgram-spelaren) ────────────────────

function scheduleToWeekdays(days: WorkoutDay[]): WorkoutDay[] {
  const trainOn = TRAIN_ON[days.length] ?? TRAIN_ON[3];
  const out: WorkoutDay[] = [];
  days.forEach((d, i) => {
    const weekdayIdx = trainOn[i] ?? i;
    out.push({ ...d, dayName: WEEK_DAYS[weekdayIdx] ?? d.dayName });
  });
  return out;
}

// ── Namngivning & designanteckningar ──────────────────────────────────────────

const SPLIT_LABEL: Record<ProgramSplit, string> = {
  full_body: 'Helkropp',
  upper_lower: 'Upper/Lower',
  ppl: 'Push/Pull/Ben',
};

const GOAL_LABEL: Record<TrainingGoal, string> = {
  lose_fat: 'Fettförbränning',
  gain_muscle: 'Muskelbygge',
  recomp: 'Recomp',
  strength: 'Styrka',
  endurance: 'Kondition',
};

function buildDesignNotes(
  opts: GenerateProgramOptions,
  split: ProgramSplit,
  gp: GoalParams,
  volume: MuscleVolume[],
  block: number,
  avoid: Set<MuscleGroup>,
): string[] {
  const notes: string[] = [];
  notes.push(
    `Split: ${SPLIT_LABEL[split]} vald för ${opts.trainingDaysPerWeek} pass/vecka – ger varje muskel hög nog frekvens (oftast ≥2 ggr/vecka).`,
  );
  notes.push(
    `Rep-schema för ${GOAL_LABEL[opts.goal]}: baslyft ${repRangeStr(gp.compoundReps)} reps, isolationer ${repRangeStr(gp.isoReps)} reps @ RPE ~${gp.baseRpe}.`,
  );
  const topVol = [...volume].sort((a, b) => b.sets - a.sets).slice(0, 3).map((v) => `${v.label} ${v.sets} set`).join(', ');
  notes.push(`Veckovolym följer MEV→MAV-landmärken. Mest volym: ${topVol}.`);
  notes.push(
    `Progression: ${block}-veckorsblock med stigande RPE/volym vecka för vecka, avslutat med en deload-vecka (~50 % volym) för superkompensation.`,
  );
  if (opts.focus && opts.focus !== 'balanced') {
    notes.push(`Fokus på ${GROUP_LABELS[opts.focus]} – extra volym tilldelad mot MAV.`);
  }
  if (avoid.size > 0) {
    const names = [...avoid].map((g) => GROUP_LABELS[g]).join(', ');
    notes.push(`Skadehänsyn: belastning på ${names} nedprioriterad/utesluten utifrån din fritext.`);
  }
  notes.push('Progressiv överbelastning: när alla set klaras i toppen av rep-intervallet → öka vikten nästa pass.');
  return notes;
}

// ── Huvud-API ─────────────────────────────────────────────────────────────────

export function generateProgram(opts: GenerateProgramOptions): GeneratedProgram;
export function generateProgram(profile: TrainingProfile): GeneratedProgram;
export function generateProgram(input: GenerateProgramOptions | TrainingProfile): GeneratedProgram {
  const opts = normalizeInput(input);

  const split = chooseSplit(opts.trainingDaysPerWeek, opts.experienceLevel);
  const gp = goalParams(opts.goal);
  const focus: ProgramFocus = opts.focus ?? 'balanced';
  const avoid = parseInjuries(opts.injuries);
  const block = Math.max(3, Math.min(8, opts.blockLengthWeeks ?? 5));

  const { sessions, weeklySets } = buildSessions(opts);
  const weeks = buildWeeks(sessions, opts, focus);

  // Veckovolym-sammanställning (vecka 1) för förhandsvisningens täckning.
  const weeklySetsPerMuscle: MuscleVolume[] = (Object.keys(GROUP_MUSCLES) as MuscleGroup[])
    .map((g) => {
      const { mev, mav } = VOLUME_LANDMARKS[g];
      const sets = weeklySets[g] ?? 0;
      const status: MuscleVolume['status'] = sets === 0 ? 'below' : sets < mev ? 'below' : sets > mav ? 'high' : 'optimal';
      return { group: g, label: GROUP_LABELS[g], sets, mev, mav, status };
    })
    .filter((v) => v.sets > 0 || !avoid.has(v.group));

  const designNotes = buildDesignNotes(opts, split, gp, weeklySetsPerMuscle, block, avoid);

  // Vecka 1 utlagd på veckodagar = `schedule` (bakåtkompatibelt med spelaren).
  const schedule = scheduleToWeekdays(weeks[0].days);

  const name = opts.name
    ?? `${SPLIT_LABEL[split]} · ${GOAL_LABEL[opts.goal]} ${opts.trainingDaysPerWeek}×/vecka`;

  return {
    id: nanoid(),
    name,
    split,
    daysPerWeek: opts.trainingDaysPerWeek,
    goal: opts.goal,
    experienceLevel: opts.experienceLevel,
    schedule,
    createdAt: Date.now(),
    isGenerated: true,
    seed: opts.seed ?? 0,
    blockLengthWeeks: block,
    sessionLengthMin: opts.sessionLengthMin,
    focus,
    weeks,
    weeklySetsPerMuscle,
    designNotes,
  };
}

// Mappa den äldre TrainingProfile-inputen (Onboarding) till GenerateProgramOptions.
function normalizeInput(input: GenerateProgramOptions | TrainingProfile): GenerateProgramOptions {
  if ('preferBuilt' in input || 'age' in input) {
    const p = input as TrainingProfile;
    return {
      goal: p.goal,
      experienceLevel: p.experienceLevel,
      trainingDaysPerWeek: p.trainingDaysPerWeek,
      availableEquipment: p.availableEquipment,
      injuries: p.injuries,
      gender: p.gender,
      focus: 'balanced',
    };
  }
  return input as GenerateProgramOptions;
}
