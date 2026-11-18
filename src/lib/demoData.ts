import type { UserProfile, Transaction } from '../types';

// Sample data for demo/preview mode (?demo=1). Lets the full app render without a
// real login — used for visual review and as a no-login preview.

export const demoProfile: UserProfile = {
  uid: 'demo-user',
  displayName: 'Benjamin Sköld',
  email: 'demo@vardagshub.app',
  activeModules: ['economy', 'fitness', 'nutrition', 'calendar'],
  onboardingCompletedModules: ['economy', 'fitness', 'nutrition'],
  gender: 'male',
  birthDate: '1998-04-12',
  height: 182,
  currentWeight: 84.2,
  currentBodyFat: 16,
  leanBodyMass: 70.7,
  activityLevel: 'moderately_active',
  trainingDaysPerWeek: 4,
  bmr: 1850,
  estimatedTDEE: 2870,
  primaryGoal: 'lose_fat',
  targetWeight: 82,
  weeklyWeightChangeTarget: -0.4,
  dailyCalorieTarget: 2100,
  proteinTargetG: 165,
  fatTargetG: 70,
  carbTargetG: 210,
  experienceLevel: 'intermediate',
  availableEquipment: ['barbell', 'dumbbell', 'cable', 'bench', 'rack'],
  activeProgramId: 'ppl-6x',
  dietaryPreferences: [],
  cookingTimePreference: 'moderate',
  mealVariationPreference: 'medium',
  batchCookingEnabled: false,
  breakfastPreference: 'rotate_favorites',
  sleepTargetHours: 8,
  stepsTargetDaily: 9000,
  createdAt: 0,
  updatedAt: 0,
  appVersion: '1.0.0',
};

const now = new Date();
const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const d = (day: number) => `${ym}-${String(day).padStart(2, '0')}`;

// Expenses are stored as negative amounts (the app's sign convention).
export const demoTransactions: Transaction[] = [
  { id: 't1', date: d(25), description: 'Lön', amount: 42400, category: 'Lön', account: 'SEB', type: 'income', isTransfer: false, source: 'manual' },
  { id: 't2', date: d(25), description: 'Hyra', amount: -9200, category: 'Boende', account: 'SEB', type: 'expense', isTransfer: false, source: 'manual' },
  { id: 't3', date: d(17), description: 'ICA Maxi', amount: -1340, category: 'Mat', account: 'SEB', type: 'expense', isTransfer: false, source: 'manual' },
  { id: 't4', date: d(16), description: 'SL Månadskort', amount: -970, category: 'Transport', account: 'SEB', type: 'expense', isTransfer: false, source: 'manual' },
  { id: 't5', date: d(14), description: 'Restaurang Lily', amount: -620, category: 'Restaurang', account: 'SEB', type: 'expense', isTransfer: false, source: 'manual' },
  { id: 't6', date: d(10), description: 'Spotify + Netflix', amount: -338, category: 'Streaming', account: 'SEB', type: 'expense', isTransfer: false, source: 'manual' },
  { id: 't7', date: d(8), description: 'Lidl', amount: -890, category: 'Mat', account: 'SEB', type: 'expense', isTransfer: false, source: 'manual' },
  { id: 't8', date: d(5), description: 'Gymkort', amount: -399, category: 'Hälsa', account: 'SEB', type: 'expense', isTransfer: false, source: 'manual' },
  { id: 't9', date: d(3), description: 'H&M', amount: -760, category: 'Kläder', account: 'SEB', type: 'expense', isTransfer: false, source: 'manual' },
];

export function isDemoMode(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
}
