import type { FitnessProfile, NutritionSettings, FoodEntry } from '../types';

// ─── BMR Formulas ─────────────────────────────────────────────────────────────

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
    const lbm = weight * (1 - bodyFatPercent / 100);
    return 370 + 21.6 * lbm;
  }

  if (formula === 'harris') {
    // Harris-Benedict (revised)
    return gender === 'male'
      ? 13.397 * weight + 4.799 * height - 5.677 * age + 88.362
      : 9.247 * weight + 3.098 * height - 4.330 * age + 447.593;
  }

  // Mifflin-St Jeor (default)
  return gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
}

export function calcTDEE(bmr: number, activityLevel: number): number {
  return Math.round(bmr * activityLevel);
}

// ─── Adaptive TDEE ────────────────────────────────────────────────────────────
// Uses rolling 4-week average of actual intake + weight change to estimate true TDEE.
// TDEE_adaptive = avgCalories - (weightChangePer7Days * 7700 / 7)
// 7700 kcal ≈ 1 kg body fat

interface WeeklyData {
  avgCalories: number; // avg daily kcal over period
  weightChangePer7Days: number; // kg change per 7 days (positive = gain)
}

export function calcAdaptiveTDEE(data: WeeklyData): number {
  const caloriesFromFat = data.weightChangePer7Days * 7700 / 7;
  return Math.round(data.avgCalories - caloriesFromFat);
}

// ─── Macro Targets ────────────────────────────────────────────────────────────

interface MacroTargets {
  calories: number;
  protein: number; // g
  carbs: number;   // g
  fat: number;     // g
}

export function calcMacroTargets(
  tdee: number,
  goal: NutritionSettings['goal'],
  weightKg: number
): MacroTargets {
  let calories: number;

  switch (goal) {
    case 'lose_fat':
      calories = Math.round(tdee * 0.8); // 20% deficit
      break;
    case 'gain_muscle':
      calories = Math.round(tdee * 1.1); // 10% surplus
      break;
    default:
      calories = tdee;
  }

  // Protein: 2.0g/kg body weight
  const protein = Math.round(weightKg * 2.0);
  // Fat: 25% of calories
  const fat = Math.round((calories * 0.25) / 9);
  // Carbs: remainder
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, carbs: Math.max(0, carbs), fat };
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
