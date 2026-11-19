import type { FitnessProfile, NutritionSettings, FoodEntry } from '../types';
import { mifflinBMR, katchBMR, computeAdaptiveTDEE, computeMacroTargets } from './nutritionEngine';

// ─── BMR Formulas ─────────────────────────────────────────────────────────────
// Mifflin + Katch delegeras till nutritionEngine (EN implementation). Harris-Benedict
// finns bara här eftersom motorn medvetet bara modellerar Mifflin/Katch.

interface BMRInput {
  gender: 'male' | 'female';
  weight: number; // kg
  height: number; // cm
  age: number;
  bodyFatPercent?: number; // for Katch-McArdle
}

export function calcBMR(input: BMRInput, formula: NutritionSettings['bmrFormula']): number {
  const { gender, weight, height, age, bodyFatPercent } = input;

  if (formula === 'katch' && bodyFatPercent != null) {
    // Katch-McArdle: needs lean body mass
    return katchBMR(weight * (1 - bodyFatPercent / 100));
  }

  if (formula === 'harris') {
    // Harris-Benedict (revised)
    return gender === 'male'
      ? 13.397 * weight + 4.799 * height - 5.677 * age + 88.362
      : 9.247 * weight + 3.098 * height - 4.330 * age + 447.593;
  }

  // Mifflin-St Jeor (default)
  return mifflinBMR(gender, weight, height, age);
}

export function calcTDEE(bmr: number, activityLevel: number): number {
  return Math.round(bmr * activityLevel);
}

// ─── Adaptive TDEE ────────────────────────────────────────────────────────────
// Rolling average intake + weight change → true TDEE. Formula lives in the engine.

interface WeeklyData {
  avgCalories: number; // avg daily kcal over period
  weightChangePer7Days: number; // kg change per 7 days (positive = gain)
}

export function calcAdaptiveTDEE(data: WeeklyData): number {
  return computeAdaptiveTDEE(data.avgCalories, data.weightChangePer7Days);
}

// ─── Macro Targets ────────────────────────────────────────────────────────────

interface MacroTargets {
  calories: number;
  protein: number; // g
  carbs: number;   // g
  fat: number;     // g
}

const GOAL_MAP: Record<NutritionSettings['goal'], 'lose_fat' | 'gain_muscle' | 'maintain'> = {
  lose_fat: 'lose_fat',
  gain_muscle: 'gain_muscle',
  maintain: 'maintain',
};

export function calcMacroTargets(
  tdee: number,
  goal: NutritionSettings['goal'],
  weightKg: number
): MacroTargets {
  const r = computeMacroTargets({ tdee, weightKg, goal: GOAL_MAP[goal] });
  return { calories: r.calorieTarget, protein: r.proteinG, carbs: r.carbG, fat: r.fatG };
}

// ─── Daily Nutrition Summary ──────────────────────────────────────────────────

export interface DayNutrition {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

export function sumDayNutrition(entries: FoodEntry[]): DayNutrition {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.nutrition.kcal,
      protein: acc.protein + e.nutrition.protein,
      fat: acc.fat + e.nutrition.fat,
      carbs: acc.carbs + e.nutrition.carbs,
      fiber: acc.fiber + (e.nutrition.fiber ?? 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
  );
}

// ─── TDEE from Profile ────────────────────────────────────────────────────────

export function tdeeFromProfile(
  profile: FitnessProfile,
  settings: NutritionSettings,
  currentWeight?: number,
  bodyFatPercent?: number
): number {
  const weight = currentWeight ?? 75;
  const bmr = calcBMR(
    { gender: profile.gender, weight, height: profile.height, age: profile.age, bodyFatPercent },
    settings.bmrFormula
  );
  return calcTDEE(bmr, settings.activityLevel);
}
