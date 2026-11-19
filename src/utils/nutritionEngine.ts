// ─── Mål-driven kost-/näringsmotor ──────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH för all metabolisk aritmetik i appen:
//   kropp + aktivitet + mål  →  BMR  →  TDEE  →  dagliga kalori-/makromål.
//
// Tidigare låg samma matte duplicerad i både `utils/calculations.ts` (Sprint 0)
// och `utils/tdee.ts` (näringsinställningar). Båda delegerar nu hit, så det finns
// EN implementation av varje formel. Lägg ALL ny BMR/TDEE/makro-logik här.
//
// Designprinciper:
//   • Rena, deterministiska funktioner — ingen Date.now() i kärnan. Den som
//     anropar skickar in `now` (unix ms) där ålder behövs. Lätt att enhetstesta.
//   • Inga sido­effekter, ingen I/O, inga `any` som bryter tsc.
//   • Vetenskapen är kommenterad vid varje formel.

import type { UserProfile, ActivityLevel, Gender, PrimaryGoal } from '../types';

// ─── Konstanter ─────────────────────────────────────────────────────────────────

/** ~7700 kcal ≈ energin i 1 kg kroppsvikt (fett). Används för deficit↔viktförändring. */
export const KCAL_PER_KG = 7700;

/** Absolut lägsta kalorimål vi någonsin rekommenderar (säkerhet). */
const MIN_CALORIE_FLOOR_MALE = 1500;
const MIN_CALORIE_FLOOR_FEMALE = 1200;

/**
 * Aktivitetsmultiplikatorer (klassiska Harris/Mifflin-faktorer).
 * TDEE = BMR × faktor.
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,          // lite/ingen träning, stillasittande arbete
  lightly_active: 1.375,   // lätt träning 1–3 dagar/vecka
  moderately_active: 1.55, // måttlig träning 3–5 dagar/vecka
  highly_active: 1.725,    // hård träning 6–7 dagar/vecka
  very_highly_active: 1.9, // mycket hård träning + fysiskt arbete
};

/** Förväntat antal träningsdagar som "ingår" i varje aktivitetsnivå (för nudge). */
const EXPECTED_TRAINING_DAYS: Record<ActivityLevel, number> = {
  sedentary: 0,
  lightly_active: 2,
  moderately_active: 4,
  highly_active: 6,
  very_highly_active: 7,
};

/** Protein (g per kg kroppsvikt) per mål. Höjs i deficit för att skydda muskler. */
const PROTEIN_PER_KG: Record<PrimaryGoal, number> = {
  lose_fat: 2.2,      // högt — bevara muskelmassa under deficit
  gain_muscle: 2.0,   // rikligt för muskelproteinsyntes
  recomp: 2.2,        // kropps­rekomposition kräver högt protein
  maintain: 1.8,      // underhåll
  general_health: 1.6, // allmän hälsa (nedre gränsen för aktiva personer)
};

/** Förvald veckovis viktförändring (kg/vecka) per mål när användaren inte satt ett. */
const DEFAULT_WEEKLY_CHANGE: Record<PrimaryGoal, number> = {
  lose_fat: -0.5,     // ~0,5 kg/vecka = hållbart fetttapp
  gain_muscle: 0.25,  // lean bulk — minimerar fettökning
  recomp: -0.2,       // svagt underskott, bygg samtidigt
  maintain: 0,
  general_health: 0,
};

// ─── Små hjälpare ────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
function round(n: number): number {
  return Math.round(n);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Deterministisk ålder i hela år. `now` skickas in (ingen Date.now i kärnan). */
export function getAgeYears(birthDate: string, now: number): number {
  const today = new Date(now);
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Fettfri massa (kg): explicit fält → annars vikt × (1 − bf%). */
function resolveLeanMass(p: Pick<UserProfile, 'leanBodyMass' | 'currentWeight' | 'currentBodyFat'>): number | null {
  if (p.leanBodyMass && p.leanBodyMass > 0) return p.leanBodyMass;
  if (p.currentWeight && p.currentBodyFat != null && p.currentBodyFat > 0) {
    return p.currentWeight * (1 - p.currentBodyFat / 100);
  }
  return null;
}

// ─── BMR (basalmetabolism) ────────────────────────────────────────────────────────

/**
 * Mifflin–St Jeor (1990) — den mest träffsäkra generella BMR-formeln.
 *   man:   10·vikt + 6.25·längd − 5·ålder + 5
 *   kvinna:10·vikt + 6.25·längd − 5·ålder − 161
 * För 'prefer_not_to_say' används medelvärdet av köns-offseten (−78).
 */
export function mifflinBMR(gender: Gender, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const offset = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
  return base + offset;
}

/**
 * Katch–McArdle — använder fettfri massa (LBM) i stället för total vikt och är
 * mer exakt när kroppsfett är känt (särskilt för vältränade/feta):
 *   BMR = 370 + 21.6 · LBM(kg)
 */
export function katchBMR(leanBodyMassKg: number): number {
  return 370 + 21.6 * leanBodyMassKg;
}

export interface BMRResult {
  bmr: number;
  formula: 'mifflin' | 'katch';
}

/**
 * Beräkna BMR från en profil. Väljer Katch–McArdle när kroppsfett/LBM är känt
 * (mer exakt), annars Mifflin–St Jeor. Returnerar null om underlag saknas.
 */
export function computeBMR(
  p: Pick<UserProfile, 'gender' | 'height' | 'currentWeight' | 'currentBodyFat' | 'leanBodyMass' | 'birthDate'>,
  now: number,
): BMRResult | null {
  const lbm = resolveLeanMass(p);
  if (lbm != null) {
    return { bmr: round(katchBMR(lbm)), formula: 'katch' };
  }
  if (p.currentWeight && p.height && p.birthDate) {
    const age = getAgeYears(p.birthDate, now);
    return { bmr: round(mifflinBMR(p.gender, p.currentWeight, p.height, age)), formula: 'mifflin' };
  }
  return null;
}

// ─── TDEE (totalt dagligt energibehov) ─────────────────────────────────────────────

/**
 * Aktivitetsfaktor justerad ("nudgad") av faktiskt antal träningsdagar:
 * basfaktorn för nivån, plus ±0,025 per träningsdag över/under det som nivån
 * normalt förutsätter. Clampas till [1.2, 2.0]. Utan träningsdata → basfaktorn.
 */
export function activityFactor(level: ActivityLevel, trainingDaysPerWeek?: number): number {
  const base = ACTIVITY_MULTIPLIERS[level] ?? ACTIVITY_MULTIPLIERS.lightly_active;
  if (trainingDaysPerWeek == null) return base;
  const expected = EXPECTED_TRAINING_DAYS[level] ?? 3;
  return clamp(base + (trainingDaysPerWeek - expected) * 0.025, 1.2, 2.0);
}

export interface TDEEResult {
  tdee: number;
  source: 'adaptive' | 'estimated';
  bmr: number;
  bmrFormula: 'mifflin' | 'katch';
}

/**
 * TDEE för en profil. Föredrar adaptiv TDEE (uträknad från vikttrend + matlogg,
 * kräver 14+ dagars data) när den finns och är rimlig — den speglar den faktiska
 * ämnesomsättningen bättre än en formel. Annars BMR × aktivitetsfaktor.
 */
export function computeTDEE(p: UserProfile, now: number): TDEEResult | null {
  const bmrR = computeBMR(p, now);
  if (!bmrR) {
    // Ingen BMR men adaptiv TDEE finns → använd den ändå.
    if (p.adaptiveTDEE && p.adaptiveTDEE > 0) {
      return { tdee: round(p.adaptiveTDEE), source: 'adaptive', bmr: 0, bmrFormula: 'mifflin' };
    }
    return null;
  }
  if (p.adaptiveTDEE && p.adaptiveTDEE > 0) {
    return { tdee: round(p.adaptiveTDEE), source: 'adaptive', bmr: bmrR.bmr, bmrFormula: bmrR.formula };
  }
  const estimated = round(bmrR.bmr * activityFactor(p.activityLevel, p.trainingDaysPerWeek));
  return { tdee: estimated, source: 'estimated', bmr: bmrR.bmr, bmrFormula: bmrR.formula };
}

/**
 * Adaptiv TDEE från rullande data:
 *   TDEE = snittintag(kcal/dag) − viktförändring(kg/vecka) × 7700 / 7
 * Positiv viktförändring ⇒ överskott ⇒ sänker uppskattad TDEE.
 */
export function computeAdaptiveTDEE(avgDailyCalories: number, weightChangePerWeekKg: number): number {
  return round(avgDailyCalories - (weightChangePerWeekKg * KCAL_PER_KG) / 7);
}

// ─── Kalori- + makromål ────────────────────────────────────────────────────────────

export interface MacroTargetResult {
  calorieTarget: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  /** kcal/dag över (−) eller under (+) underhåll som faktiskt tillämpas (efter cap). */
  dailyDeltaKcal: number;
  proteinPerKg: number;
}

export interface MacroTargetInput {
  tdee: number;
  weightKg: number;
  goal: PrimaryGoal;
  /** kg/vecka, negativ = ned, positiv = upp. Styr deficit/surplus när satt. */
  weeklyWeightChangeTarget?: number;
  gender?: Gender;
}

/**
 * Kärnan i måluträkningen (ren, återanvänd av både profil-API:t och legacy-adaptrar).
 *
 * Kalorier:
 *   • Om ett veckomål är satt: delta = veckomål(kg) × 7700 / 7  (kcal/dag).
 *   • Annars förval per mål (lose_fat −0,5 kg/v, gain_muscle +0,25, recomp −0,2…).
 *   • Deficit cappas till 20 % av TDEE, surplus till 15 % — hållbart och säkert.
 *   • Golv: 1500 kcal (man) / 1200 kcal (kvinna).
 * Protein: g/kg per mål (högre i deficit). Fett: golv 0,8 g/kg, annars 25 % av kcal.
 * Kolhydrater: resterande energi.
 */
export function computeMacroTargets(input: MacroTargetInput): MacroTargetResult {
  const { tdee, weightKg, goal, weeklyWeightChangeTarget, gender } = input;

  // 1) Kaloridelta från veckomål eller målförval.
  let delta: number;
  if (weeklyWeightChangeTarget != null && weeklyWeightChangeTarget !== 0) {
    delta = (weeklyWeightChangeTarget * KCAL_PER_KG) / 7;
  } else {
    delta = (DEFAULT_WEEKLY_CHANGE[goal] * KCAL_PER_KG) / 7;
  }
  // 2) Cappa deficit/surplus till säkra andelar av TDEE.
  const maxDeficit = tdee * 0.20;
  const maxSurplus = tdee * 0.15;
  delta = clamp(delta, -maxDeficit, maxSurplus);

  // 3) Kalorimål med säkerhetsgolv.
  const floor = gender === 'female' ? MIN_CALORIE_FLOOR_FEMALE : MIN_CALORIE_FLOOR_MALE;
  const calorieTarget = Math.max(floor, round(tdee + delta));
  const dailyDeltaKcal = calorieTarget - tdee;

  // 4) Protein: per mål, aldrig under 2,0 g/kg i ett faktiskt underskott.
  let proteinPerKg = PROTEIN_PER_KG[goal];
  if (dailyDeltaKcal < 0) proteinPerKg = Math.max(proteinPerKg, 2.0);
  const proteinG = round(weightKg * proteinPerKg);

  // 5) Fett: golv 0,8 g/kg (hormonell hälsa), annars 25 % av kalorierna.
  const fatFloor = round(weightKg * 0.8);
  const fatFromPct = round((calorieTarget * 0.25) / 9);
  const fatG = Math.max(fatFloor, fatFromPct);

  // 6) Kolhydrater: resten av energin (aldrig negativt).
  const remainingKcal = calorieTarget - proteinG * 4 - fatG * 9;
  const carbG = Math.max(0, round(remainingKcal / 4));

  return { calorieTarget, proteinG, fatG, carbG, dailyDeltaKcal, proteinPerKg };
}

// ─── Mål-driven profil-API (det UI:t använder) ─────────────────────────────────────

export interface NutritionTargets {
  bmr: number;
  bmrFormula: 'mifflin' | 'katch';
  tdee: number;
  tdeeSource: 'adaptive' | 'estimated';
  maintenanceKcal: number;
  calorieTarget: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  proteinPerKg: number;
  /** kcal/dag jämfört med underhåll (negativt = underskott). */
  dailyDeltaKcal: number;
  /** Förväntad viktförändring (kg/vecka) som målet faktiskt ger. */
  weeklyChangeKg: number;
  /** Kort svensk förklaring av uträkningen (för UI). */
  rationale: string;
}

/** Procentuell fördelning av kalorier mellan makron (för ring/staplar). */
export function macroCaloriePercents(t: Pick<NutritionTargets, 'proteinG' | 'fatG' | 'carbG'>): {
  protein: number; fat: number; carb: number;
} {
  const pKcal = t.proteinG * 4;
  const fKcal = t.fatG * 9;
  const cKcal = t.carbG * 4;
  const total = pKcal + fKcal + cKcal;
  if (total <= 0) return { protein: 0, fat: 0, carb: 0 };
  return {
    protein: Math.round((pKcal / total) * 100),
    fat: Math.round((fKcal / total) * 100),
    carb: Math.round((cKcal / total) * 100),
  };
}

const GOAL_LABEL: Record<PrimaryGoal, string> = {
  lose_fat: 'minska fett',
  gain_muscle: 'bygga muskler',
  recomp: 'kroppsrekomposition',
  maintain: 'bibehålla vikt',
  general_health: 'allmän hälsa',
};

function buildRationale(
  goal: PrimaryGoal,
  bmrSource: 'mifflin' | 'katch',
  tdeeSource: 'adaptive' | 'estimated',
  dailyDeltaKcal: number,
  weeklyChangeKg: number,
  proteinPerKg: number,
): string {
  const parts: string[] = [];
  parts.push(`Mål: ${GOAL_LABEL[goal]}.`);

  const tdeeTxt = tdeeSource === 'adaptive'
    ? 'Baserat på din adaptiva TDEE (uträknad från vikttrend och matlogg).'
    : `Baserat på uppskattad TDEE (${bmrSource === 'katch' ? 'Katch–McArdle med fettfri massa' : 'Mifflin–St Jeor'}).`;
  parts.push(tdeeTxt);

  if (dailyDeltaKcal < -5) {
    parts.push(`Ett underskott på ${Math.abs(dailyDeltaKcal)} kcal/dag ger ca ${Math.abs(weeklyChangeKg).toLocaleString('sv-SE')} kg/vecka.`);
  } else if (dailyDeltaKcal > 5) {
    parts.push(`Ett överskott på ${dailyDeltaKcal} kcal/dag ger ca ${weeklyChangeKg.toLocaleString('sv-SE')} kg/vecka.`);
  } else {
    parts.push('Kalorierna läggs på underhållsnivå.');
  }

  parts.push(`Protein ${proteinPerKg.toLocaleString('sv-SE')} g/kg skyddar muskelmassan; fettgolv för hormonell hälsa, resten kolhydrater.`);
  return parts.join(' ');
}

/**
 * Hela den mål-drivna uträkningen för en profil: BMR → TDEE → kalori-/makromål
 * med en svensk förklaring. Returnerar null om det saknas underlag (vikt + BMR).
 * Detta är funktionen UI och store ska anropa.
 */
export function computeTargets(p: UserProfile, now: number): NutritionTargets | null {
  const t = computeTDEE(p, now);
  if (!t) return null;

  const weightKg = p.currentWeight ?? p.leanBodyMass ?? 0;
  if (weightKg <= 0) return null;

  const m = computeMacroTargets({
    tdee: t.tdee,
    weightKg,
    goal: p.primaryGoal,
    weeklyWeightChangeTarget: p.weeklyWeightChangeTarget,
    gender: p.gender,
  });

  const weeklyChangeKg = round1((m.dailyDeltaKcal * 7) / KCAL_PER_KG);

  return {
    bmr: t.bmr,
    bmrFormula: t.bmrFormula,
    tdee: t.tdee,
    tdeeSource: t.source,
    maintenanceKcal: t.tdee,
    calorieTarget: m.calorieTarget,
    proteinG: m.proteinG,
    fatG: m.fatG,
    carbG: m.carbG,
    proteinPerKg: m.proteinPerKg,
    dailyDeltaKcal: m.dailyDeltaKcal,
    weeklyChangeKg,
    rationale: buildRationale(p.primaryGoal, t.bmrFormula, t.source, m.dailyDeltaKcal, weeklyChangeKg, m.proteinPerKg),
  };
}
