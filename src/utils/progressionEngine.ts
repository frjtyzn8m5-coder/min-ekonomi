import type { Exercise, WorkoutSet, CyclePhase, StagnationAlert } from '../types';

// ── 1RM formulas ──────────────────────────────────────────────────────────────

/**
 * Average of Epley, Brzycki, Lander and Marzagao formulas.
 * Returns null for reps outside 1–12 range.
 */
export function calculate1RM(weight: number, reps: number): number | null {
  if (reps < 1 || reps > 12) return null;
  if (reps === 1) return weight;

  const epley   = weight * (1 + reps / 30);
  const brzycki = weight * (36 / (37 - reps));
  const lander  = (100 * weight) / (101.3 - 2.67123 * reps);
  // Marzagao (2026) – most accurate across varied loads
  const marzagao = weight * (1 + Math.pow(reps - 1, 0.85) / (-2.55 + 4.58 * Math.log(weight)));

  return Math.round(((epley + brzycki + lander + marzagao) / 4) * 10) / 10;
}

// ── RPE table ─────────────────────────────────────────────────────────────────

// %1RM indexed by [reps][RPE]
const RPE_TABLE: Record<number, Record<number, number>> = {
  1:  { 6: 0.83, 7: 0.86, 8: 0.89, 9: 0.92, 10: 1.00 },
  3:  { 6: 0.76, 7: 0.79, 8: 0.82, 9: 0.86, 10: 0.90 },
  5:  { 6: 0.70, 7: 0.74, 8: 0.77, 9: 0.81, 10: 0.85 },
  8:  { 6: 0.63, 7: 0.67, 8: 0.71, 9: 0.75, 10: 0.80 },
  10: { 6: 0.59, 7: 0.63, 8: 0.67, 9: 0.71, 10: 0.75 },
  12: { 6: 0.55, 7: 0.59, 8: 0.63, 9: 0.67, 10: 0.71 },
};

/**
 * Recommend a working weight given estimated 1RM, target reps and target RPE.
 * Rounds to nearest 2.5 kg.
 */
export function weightFromRPETable(oneRM: number, reps: number, targetRPE: number): number {
  // Find closest rep key
  const repKeys = Object.keys(RPE_TABLE).map(Number).sort((a, b) => a - b);
  const closestReps = repKeys.reduce((prev, curr) =>
    Math.abs(curr - reps) < Math.abs(prev - reps) ? curr : prev
  );
  const pct = RPE_TABLE[closestReps]?.[targetRPE] ?? 0.70;
  return Math.round((oneRM * pct) / 2.5) * 2.5;
}

// ── Progression logic ─────────────────────────────────────────────────────────

export interface ProgressionInput {
  exercise: Exercise;
  previousSets: WorkoutSet[];
  targetReps: [number, number];
  targetRPE: number;
  currentPhase?: CyclePhase;
}

export interface ProgressionSuggestion {
  suggestedWeight: number;
  suggestedReps: number;
  suggestedRPE: number;
  rationale: string;
  changeType: 'increase_weight' | 'increase_reps' | 'maintain' | 'decrease' | 'deload';
  confidenceLevel: 'high' | 'medium' | 'low';
}

export function calculateProgression(input: ProgressionInput): ProgressionSuggestion {
  const { exercise, previousSets, targetReps, targetRPE, currentPhase } = input;
  const [minReps, maxReps] = targetReps;

  // Find heaviest working set from last session
  const lastWorkingSet = [...previousSets]
    .filter(s => s.setType === 'working' || s.setType === 'top_set')
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];

  if (!lastWorkingSet) {
    return {
      suggestedWeight: 20,
      suggestedReps: minReps,
      suggestedRPE: targetRPE,
      rationale: 'Ny övning – börja med 20 kg och bygg upp tekniken.',
      changeType: 'maintain',
      confidenceLevel: 'low',
    };
  }

  const { weight, reps, rpe } = lastWorkingSet;
  const rpeGap = (rpe ?? targetRPE) - targetRPE; // positive = harder than target

  let suggestion: ProgressionSuggestion;

  // ── COMPOUND: APRE logic ──────────────────────────────────────────────────
  if (exercise.isCompound) {
    if (reps >= maxReps + 2 && rpeGap <= -1) {
      suggestion = {
        suggestedWeight: weight + 5,
        suggestedReps: minReps,
        suggestedRPE: targetRPE,
        rationale: `Starkt! ${reps} reps @ RPE ${rpe ?? '–'}. Ökar med 5 kg.`,
        changeType: 'increase_weight',
        confidenceLevel: 'high',
      };
    } else if (reps >= maxReps + 1) {
      suggestion = {
        suggestedWeight: weight + 2.5,
        suggestedReps: minReps,
        suggestedRPE: targetRPE,
        rationale: `Du klarade ${reps} reps – över målet. Ökar med 2.5 kg.`,
        changeType: 'increase_weight',
        confidenceLevel: 'high',
      };
    } else if (reps >= minReps && reps <= maxReps && rpeGap <= -1) {
      suggestion = {
        suggestedWeight: weight + 2.5,
        suggestedReps: reps,
        suggestedRPE: targetRPE,
        rationale: `Mål-reps klart, RPE var låg. Ökar vikten försiktigt.`,
        changeType: 'increase_weight',
        confidenceLevel: 'medium',
      };
    } else if (reps >= minReps && reps <= maxReps && Math.abs(rpeGap) <= 0.5) {
      suggestion = {
        suggestedWeight: weight,
        suggestedReps: reps,
        suggestedRPE: targetRPE,
        rationale: `Perfekt session – behåll vikten och sikta på ${reps} reps igen.`,
        changeType: 'maintain',
        confidenceLevel: 'high',
      };
    } else if (reps >= minReps && rpeGap >= 1) {
      suggestion = {
        suggestedWeight: weight,
        suggestedReps: reps,
        suggestedRPE: targetRPE,
        rationale: `Reps klart men RPE var hög. Behåll vikten och jobba på kvaliteten.`,
        changeType: 'maintain',
        confidenceLevel: 'medium',
      };
    } else {
      // Didn't reach min reps
      suggestion = {
        suggestedWeight: Math.max(weight - 2.5, 20),
        suggestedReps: minReps,
        suggestedRPE: targetRPE,
        rationale: `Klarade ${reps}/${minReps} reps. Minskar lite för att bygga bättre bas.`,
        changeType: 'decrease',
        confidenceLevel: 'high',
      };
    }
  } else {
    // ── ISOLATION: Double progression (rep-range) ─────────────────────────
    if (reps >= maxReps) {
      const increment = weight < 20 ? 1.25 : 2.5;
      suggestion = {
        suggestedWeight: weight + increment,
        suggestedReps: minReps,
        suggestedRPE: targetRPE,
        rationale: `Nådde toppen av rep-zonen (${reps} reps). Ökar vikten med ${increment} kg.`,
        changeType: 'increase_weight',
        confidenceLevel: 'high',
      };
    } else {
      suggestion = {
        suggestedWeight: weight,
        suggestedReps: reps + 1,
        suggestedRPE: targetRPE,
        rationale: `Sikta på 1 extra rep idag (${reps} → ${reps + 1}).`,
        changeType: 'increase_reps',
        confidenceLevel: 'high',
      };
    }
  }

  // ── Cycle phase modifiers ─────────────────────────────────────────────────
  if (currentPhase === 'luteal') {
    suggestion.suggestedWeight = Math.round(suggestion.suggestedWeight * 0.9 / 2.5) * 2.5;
    suggestion.rationale += ' (Justerat för lutealfas – lite lugnare är smart.)';
    suggestion.confidenceLevel = 'medium';
  } else if (currentPhase === 'follicular' || currentPhase === 'ovulation') {
    if (suggestion.changeType === 'maintain') {
      suggestion.rationale += ' (Follikulärfas – prova att öka om det känns bra!)';
    }
  }

  return suggestion;
}

// ── Stagnation detection ──────────────────────────────────────────────────────

/**
 * Checks the last 3 sessions' sets for an exercise.
 * If estimated 1RM hasn't improved by >1% across all three, returns an alert.
 * history: array of sessions' set arrays (most recent last)
 */
export function detectStagnation(
  history: WorkoutSet[][],
  exerciseId: string,
  exerciseName: string,
): StagnationAlert | null {
  const last3 = history.slice(-3);
  if (last3.length < 3) return null;

  const oneRMs = last3.map(sets => {
    const bests = sets
      .filter(s => s.exerciseId === exerciseId && (s.setType === 'working' || s.setType === 'top_set'))
      .map(s => calculate1RM(s.weight, s.reps))
      .filter((v): v is number => v !== null);
    return bests.length ? Math.max(...bests) : 0;
  });

  const isStagnant = oneRMs.every(rm => rm <= oneRMs[0] * 1.01);
  if (!isStagnant) return null;

  return {
    exerciseId,
    exerciseName,
    suggestion: 'deload',
    message: `Du har inte ökat på 3 pass i rad. Prova ett deload-pass (60 % av vanlig vikt) eller ett annat rep-range.`,
  };
}

// ── Deload weight helper ──────────────────────────────────────────────────────

/** Round to nearest 2.5 kg increment */
export function roundToPlate(weight: number): number {
  return Math.round(weight / 2.5) * 2.5;
}

/** Suggest deload weight (60 % of normal) */
export function deloadWeight(normalWeight: number): number {
  return roundToPlate(normalWeight * 0.6);
}
