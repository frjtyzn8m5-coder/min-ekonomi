// ── Träningsprogram-generator (Jeff Nippard-inspirerad) ──────────────────────
// Genererar ett veckoprogram baserat på TrainingProfile.

import type { TrainingProfile, WorkoutProgram, WorkoutDay, ProgramExercise, ProgramSplit } from '../types';
import { nanoid } from 'nanoid';

// ── Övningsbibliotek per muskelgrupp ─────────────────────────────────────────

const PUSH_COMPOUND: ProgramExercise[] = [
  { name: 'Bänkpress', sets: 4, repsRange: '4-6', rest: 180 },
  { name: 'Militärpress', sets: 3, repsRange: '6-10', rest: 150 },
];
const PUSH_ISO: ProgramExercise[] = [
  { name: 'Lutande hantelpress', sets: 3, repsRange: '8-12', rest: 90 },
  { name: 'Kabelflyes', sets: 3, repsRange: '12-15', rest: 60 },
  { name: 'Lateral raises', sets: 4, repsRange: '15-20', rest: 60 },
  { name: 'Framifrån-höjningar', sets: 3, repsRange: '12-15', rest: 60 },
  { name: 'Triceps pushdown', sets: 3, repsRange: '12-15', rest: 60 },
  { name: 'Overhead triceps extension', sets: 3, repsRange: '10-15', rest: 60 },
];
const PULL_COMPOUND: ProgramExercise[] = [
  { name: 'Marklyft', sets: 3, repsRange: '4-6', rest: 240 },
  { name: 'Skivstångsrodd', sets: 4, repsRange: '6-10', rest: 150 },
];
const PULL_ISO: ProgramExercise[] = [
  { name: 'Latsdrag bred', sets: 3, repsRange: '10-12', rest: 90 },
  { name: 'Seated cable row', sets: 3, repsRange: '10-12', rest: 90 },
  { name: 'Face pulls', sets: 3, repsRange: '15-20', rest: 60 },
  { name: 'Hammer curl', sets: 3, repsRange: '10-12', rest: 60 },
  { name: 'Biceps curl', sets: 3, repsRange: '10-12', rest: 60 },
];
const LEGS_COMPOUND: ProgramExercise[] = [
  { name: 'Knäböj', sets: 4, repsRange: '4-6', rest: 240 },
  { name: 'Romanian deadlift', sets: 3, repsRange: '8-12', rest: 150 },
];
const LEGS_ISO: ProgramExercise[] = [
  { name: 'Leg press', sets: 3, repsRange: '10-15', rest: 90 },
  { name: 'Leg curl', sets: 3, repsRange: '10-12', rest: 90 },
  { name: 'Leg extension', sets: 3, repsRange: '12-15', rest: 60 },
  { name: 'Stående vadpress', sets: 4, repsRange: '15-20', rest: 60 },
];
const UPPER_PUSH: ProgramExercise[] = [
  { name: 'Bänkpress', sets: 4, repsRange: '6-8', rest: 150 },
  { name: 'Lutande hantelpress', sets: 3, repsRange: '8-12', rest: 90 },
  { name: 'Militärpress', sets: 3, repsRange: '8-12', rest: 120 },
  { name: 'Lateral raises', sets: 4, repsRange: '15-20', rest: 60 },
  { name: 'Triceps pushdown', sets: 3, repsRange: '12-15', rest: 60 },
];
const UPPER_PULL: ProgramExercise[] = [
  { name: 'Skivstångsrodd', sets: 4, repsRange: '6-10', rest: 150 },
  { name: 'Latsdrag bred', sets: 3, repsRange: '10-12', rest: 90 },
  { name: 'Face pulls', sets: 3, repsRange: '15-20', rest: 60 },
  { name: 'Biceps curl', sets: 3, repsRange: '10-12', rest: 60 },
];
const FULL_BODY_A: ProgramExercise[] = [
  { name: 'Knäböj', sets: 3, repsRange: '6-8', rest: 180 },
  { name: 'Bänkpress', sets: 3, repsRange: '6-8', rest: 150 },
  { name: 'Skivstångsrodd', sets: 3, repsRange: '6-10', rest: 120 },
  { name: 'Romanian deadlift', sets: 2, repsRange: '10-12', rest: 120 },
  { name: 'Lateral raises', sets: 3, repsRange: '15-20', rest: 60 },
  { name: 'Biceps curl', sets: 2, repsRange: '10-12', rest: 60 },
];
const FULL_BODY_B: ProgramExercise[] = [
  { name: 'Marklyft', sets: 3, repsRange: '4-6', rest: 240 },
  { name: 'Lutande bänkpress', sets: 3, repsRange: '8-12', rest: 150 },
  { name: 'Latsdrag bred', sets: 3, repsRange: '10-12', rest: 90 },
  { name: 'Militärpress', sets: 3, repsRange: '8-12', rest: 120 },
  { name: 'Leg press', sets: 3, repsRange: '10-15', rest: 90 },
  { name: 'Triceps pushdown', sets: 2, repsRange: '12-15', rest: 60 },
];
const FULL_BODY_C: ProgramExercise[] = [
  { name: 'Knäböj', sets: 3, repsRange: '8-10', rest: 150 },
  { name: 'Hantelpress', sets: 3, repsRange: '10-12', rest: 90 },
  { name: 'Seated cable row', sets: 3, repsRange: '10-12', rest: 90 },
  { name: 'Leg curl', sets: 3, repsRange: '10-12', rest: 90 },
  { name: 'Face pulls', sets: 3, repsRange: '15-20', rest: 60 },
  { name: 'Hammer curl', sets: 2, repsRange: '10-12', rest: 60 },
];

// ── Styrka-specifika justeringar ──────────────────────────────────────────────

function adjustForStrength(ex: ProgramExercise): ProgramExercise {
  // Lägre rep-ranges, längre vila för styrka
  const lower: Record<string, string> = {
    '6-8': '3-5', '6-10': '4-6', '8-12': '5-7', '10-12': '6-8',
    '10-15': '6-10', '12-15': '8-10', '15-20': '10-15',
  };
  return {
    ...ex,
    repsRange: lower[ex.repsRange] ?? ex.repsRange,
    rest: Math.min(ex.rest + 60, 300),
  };
}

function adjustForHypertrophy(ex: ProgramExercise): ProgramExercise {
  // Standardinställningar passar hypertrofi (6-15 reps)
  return ex;
}

function adjustForFat(ex: ProgramExercise): ProgramExercise {
  // Lägg till lite kortare vila för konditionseffekt
  return { ...ex, rest: Math.max(ex.rest - 15, 45) };
}

function applyGoalAdjustments(
  exercises: ProgramExercise[],
  goal: TrainingProfile['goal'],
): ProgramExercise[] {
  return exercises.map(ex => {
    if (goal === 'strength') return adjustForStrength(ex);
    if (goal === 'lose_fat') return adjustForFat(ex);
    return adjustForHypertrophy(ex);
  });
}

// ── Program-byggar-helpers ─────────────────────────────────────────────────────

function makePushA(goal: TrainingProfile['goal']): WorkoutDay {
  return {
    dayName: 'Push A',
    splitLabel: 'Push',
    exercises: applyGoalAdjustments([
      ...PUSH_COMPOUND,
      PUSH_ISO[0], PUSH_ISO[2], PUSH_ISO[4],
    ], goal),
  };
}

function makePushB(goal: TrainingProfile['goal']): WorkoutDay {
  return {
    dayName: 'Push B',
    splitLabel: 'Push',
    exercises: applyGoalAdjustments([
      { name: 'Bänkpress (Lutande)', sets: 4, repsRange: '6-10', rest: 150 },
      PUSH_COMPOUND[1],
      PUSH_ISO[1], PUSH_ISO[3], PUSH_ISO[5],
    ], goal),
  };
}

function makePullA(goal: TrainingProfile['goal']): WorkoutDay {
  return {
    dayName: 'Pull A',
    splitLabel: 'Pull',
    exercises: applyGoalAdjustments([
      ...PULL_COMPOUND,
      PULL_ISO[0], PULL_ISO[2], PULL_ISO[3],
    ], goal),
  };
}

function makePullB(goal: TrainingProfile['goal']): WorkoutDay {
  return {
    dayName: 'Pull B',
    splitLabel: 'Pull',
    exercises: applyGoalAdjustments([
      { name: 'Latsdrag smal', sets: 4, repsRange: '8-12', rest: 90 },
      { name: 'Enarms kabelrodd', sets: 3, repsRange: '10-12', rest: 90 },
      PULL_ISO[2], PULL_ISO[4],
    ], goal),
  };
}

function makeLegsA(goal: TrainingProfile['goal']): WorkoutDay {
  return {
    dayName: 'Legs A',
    splitLabel: 'Ben',
    exercises: applyGoalAdjustments([
      ...LEGS_COMPOUND,
      LEGS_ISO[0], LEGS_ISO[1], LEGS_ISO[3],
    ], goal),
  };
}

function makeLegsB(goal: TrainingProfile['goal']): WorkoutDay {
  return {
    dayName: 'Legs B',
    splitLabel: 'Ben',
    exercises: applyGoalAdjustments([
      { name: 'Frontknäböj', sets: 4, repsRange: '6-8', rest: 180 },
      { name: 'Sumo marklyft', sets: 3, repsRange: '6-10', rest: 180 },
      LEGS_ISO[0], LEGS_ISO[2], LEGS_ISO[3],
    ], goal),
  };
}

function makeUpperA(goal: TrainingProfile['goal']): WorkoutDay {
  return {
    dayName: 'Överkropp A',
    splitLabel: 'Överkropp',
    exercises: applyGoalAdjustments([...UPPER_PUSH, ...UPPER_PULL.slice(2)], goal),
  };
}

function makeUpperB(goal: TrainingProfile['goal']): WorkoutDay {
  return {
    dayName: 'Överkropp B',
    splitLabel: 'Överkropp',
    exercises: applyGoalAdjustments([
      ...UPPER_PULL,
      { name: 'Kabelflyes', sets: 3, repsRange: '12-15', rest: 60 },
      { name: 'Lateral raises', sets: 3, repsRange: '15-20', rest: 60 },
    ], goal),
  };
}

function makeLowerA(goal: TrainingProfile['goal']): WorkoutDay {
  return {
    dayName: 'Underkropp A',
    splitLabel: 'Underkropp',
    exercises: applyGoalAdjustments([
      LEGS_COMPOUND[0],
      LEGS_ISO[1], LEGS_ISO[0], LEGS_ISO[3],
    ], goal),
  };
}

function makeLowerB(goal: TrainingProfile['goal']): WorkoutDay {
  return {
    dayName: 'Underkropp B',
    splitLabel: 'Underkropp',
    exercises: applyGoalAdjustments([
      LEGS_COMPOUND[1],
      { name: 'Leg press', sets: 4, repsRange: '10-15', rest: 90 },
      LEGS_ISO[2], LEGS_ISO[3],
    ], goal),
  };
}

// ── Välj split baserat på profil ──────────────────────────────────────────────

function chooseSplit(profile: TrainingProfile): ProgramSplit {
  const { experienceLevel, trainingDaysPerWeek } = profile;
  if (experienceLevel === 'beginner' || trainingDaysPerWeek <= 3) return 'full_body';
  if (trainingDaysPerWeek === 4) return 'upper_lower';
  return 'ppl';
}

// ── Schemalägg dagar i veckan ─────────────────────────────────────────────────

const WEEK_DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

function assignDaysToWeek(trainingDays: WorkoutDay[], daysPerWeek: number): WorkoutDay[] {
  // Spread training evenly across the week with rest days
  const schedule: WorkoutDay[] = [];
  const restPattern: Record<number, number[]> = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
  };
  const trainOn = restPattern[daysPerWeek] ?? [0, 2, 4];

  WEEK_DAYS.forEach((dayName, idx) => {
    const trainIdx = trainOn.indexOf(idx);
    if (trainIdx >= 0 && trainIdx < trainingDays.length) {
      schedule.push({ ...trainingDays[trainIdx], dayName });
    }
  });

  return schedule;
}

// ── Huvud-exportfunktion ──────────────────────────────────────────────────────

export function generateProgram(profile: TrainingProfile): WorkoutProgram {
  const split = chooseSplit(profile);
  const { goal, trainingDaysPerWeek: days, experienceLevel } = profile;

  let trainingDays: WorkoutDay[] = [];
  let programName = '';

  if (split === 'full_body') {
    const templates: WorkoutDay[] = [
      { exercises: applyGoalAdjustments(FULL_BODY_A, goal), dayName: 'Helkropp A', splitLabel: 'Helkropp' },
      { exercises: applyGoalAdjustments(FULL_BODY_B, goal), dayName: 'Helkropp B', splitLabel: 'Helkropp' },
      { exercises: applyGoalAdjustments(FULL_BODY_C, goal), dayName: 'Helkropp C', splitLabel: 'Helkropp' },
    ];
    trainingDays = templates.slice(0, days);
    programName = 'Helkroppsträning 3×/vecka';
  } else if (split === 'upper_lower') {
    trainingDays = [makeUpperA(goal), makeLowerA(goal), makeUpperB(goal), makeLowerB(goal)].slice(0, days);
    programName = 'Upper/Lower 4×/vecka';
  } else {
    // PPL
    if (days <= 3) {
      trainingDays = [makePushA(goal), makePullA(goal), makeLegsA(goal)];
      programName = 'Push/Pull/Ben 3×/vecka';
    } else if (days <= 5) {
      trainingDays = [makePushA(goal), makePullA(goal), makeLegsA(goal), makePushB(goal), makePullB(goal)];
      programName = 'Push/Pull/Ben 5×/vecka';
    } else {
      trainingDays = [makePushA(goal), makePullA(goal), makeLegsA(goal), makePushB(goal), makePullB(goal), makeLegsB(goal)];
      programName = 'Push/Pull/Ben 6×/vecka';
    }
  }

  const schedule = assignDaysToWeek(trainingDays, days);

  return {
    id: nanoid(),
    name: programName,
    split,
    daysPerWeek: days,
    goal,
    experienceLevel,
    schedule,
    createdAt: Date.now(),
  };
}
