// ── UserProfile types (Sprint 0) ─────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'prefer_not_to_say'
export type PrimaryGoal = 'lose_fat' | 'gain_muscle' | 'recomp' | 'maintain' | 'general_health'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'highly_active' | 'very_highly_active'
export type ActiveModule = 'economy' | 'fitness' | 'nutrition' | 'calendar'
export type Contraceptive = 'none' | 'combined_pill' | 'mini_pill' | 'hormonal_iud' | 'copper_iud' | 'implant' | 'injection' | 'other' | 'not_applicable'

export interface UserProfile {
  // Identitet
  uid: string
  displayName?: string
  email?: string

  // Aktiva moduler (väljs vid onboarding)
  activeModules: ActiveModule[]
  onboardingCompletedModules: ActiveModule[]

  // Grunddata
  gender: Gender
  birthDate?: string            // YYYY-MM-DD
  height?: number               // cm

  // Kroppsstatus – uppdateras från WeightLog
  currentWeight?: number        // kg
  currentBodyFat?: number       // % (Navy-metod eller manuell)
  leanBodyMass?: number         // kg (auto: currentWeight × (1 - bodyFat/100))

  // Aktivitetsnivå
  activityLevel: ActivityLevel
  trainingDaysPerWeek: number   // 0–7

  // Beräknade metabolismvärden (auto-beräknade, lagras i Firestore)
  bmr?: number                  // kcal/dag (Mifflin-St Jeor)
  estimatedTDEE?: number        // kcal/dag (BMR × aktivitetsmultiplikator)
  adaptiveTDEE?: number         // kcal/dag (beräknat från vikttrend + matlogg, kräver 14+ dagars data)
  tdeeLastUpdated?: number      // unix ms

  // Mål
  primaryGoal: PrimaryGoal
  targetWeight?: number         // kg
  targetBodyFat?: number        // %
  weeklyWeightChangeTarget?: number  // kg/vecka, negativ = förlora, positiv = öka
  goalDeadline?: string         // YYYY-MM-DD

  // Dagliga mål (auto-beräknade från mål + kroppsstatus)
  dailyCalorieTarget?: number
  proteinTargetG?: number
  fatTargetG?: number
  carbTargetG?: number

  // Träningsprofil
  experienceLevel: ExperienceLevel
  availableEquipment: string[]  // ['barbell', 'dumbbell', 'cable', 'bodyweight', 'bench', 'rack', 'machine']
  activeProgramId?: string      // referens till träningsprogram
  activeProgramStartDate?: string // YYYY-MM-DD
  currentProgramWeek?: number   // 1-baserat
  currentProgramDayIndex?: number // 0-baserat inom veckan
  injuries?: string             // fritext

  // Kost-preferenser
  dietaryPreferences: ('vegetarian' | 'vegan' | 'gluten_free' | 'lactose_free' | 'no_pork' | 'no_shellfish')[]
  cookingTimePreference: 'minimal' | 'moderate' | 'generous'  // <15min / 15-45min / 45min+
  mealVariationPreference: 'high' | 'medium' | 'low'
  batchCookingEnabled: boolean

  // Frukostpreferens (för måltidsplan)
  breakfastPreference: 'same_daily' | 'rotate_favorites' | 'full_variation'
  breakfastFavoriteRecipeIds?: string[]

  // Sömn och välmående
  sleepTargetHours: number      // standard: 8
  stepsTargetDaily: number      // standard: 8000

  // Menscykel (bara relevant om gender === 'female')
  cycleTrackingEnabled?: boolean
  averageCycleLength?: number   // dagar, standard: 28
  averagePeriodLength?: number  // dagar, standard: 5
  lastPeriodStartDate?: string  // YYYY-MM-DD
  contraceptive?: Contraceptive
  cycleIrregular?: boolean

  // Supplement-tracking
  activeSupplements?: string[]  // ['creatine', 'fish_oil', 'vitamin_d', 'multivitamin', 'caffeine']

  // Meta
  createdAt: number
  updatedAt: number
  appVersion: string            // '1.0.0'
}

// ── Exercise types (Sprint 2) ─────────────────────────────────────────────────

export type ExerciseCategory = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'full_body'

export type ExerciseEquipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'bench' | 'rack' | 'kettlebell' | 'resistance_band' | 'other'

export type AnatomicalMuscle =
  | 'pectoralis_major' | 'pectoralis_minor'
  | 'latissimus_dorsi' | 'rhomboids' | 'trapezius' | 'rear_deltoid'
  | 'anterior_deltoid' | 'medial_deltoid'
  | 'biceps_brachii' | 'brachialis' | 'brachioradialis'
  | 'triceps_brachii'
  | 'quadriceps' | 'hamstrings' | 'gluteus_maximus' | 'gluteus_medius' | 'gluteus_minimus'
  | 'gastrocnemius' | 'soleus'
  | 'rectus_abdominis' | 'obliques' | 'transverse_abdominis'
  | 'erector_spinae' | 'multifidus'
  | 'forearms' | 'rotator_cuff' | 'serratus_anterior' | 'core'

export interface Exercise {
  id: string
  name: string
  nameSv?: string
  category: ExerciseCategory
  equipment: ExerciseEquipment[]

  primaryMuscles: AnatomicalMuscle[]
  secondaryMuscles: AnatomicalMuscle[]
  stabilizers: AnatomicalMuscle[]

  instructions: string[]
  instructionsSv?: string[]

  gifUrl?: string
  imageUrls?: string[]

  difficulty: 'beginner' | 'intermediate' | 'advanced'
  isCompound: boolean
  type: 'strength' | 'cardio' | 'stretch' | 'plyometric'

  defaultRepRange: [number, number]
  defaultRPETarget: number
  defaultRestSeconds: number
  use1RM: boolean
  progressionType: 'compound_apre' | 'double_progression' | 'rep_range'

  youtubeSearchQuery: string
}

// ─────────────────────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer' | 'investment';

export type Category =
  | 'Lön' | 'CSN Bidrag' | 'CSN Lån' | 'Investeringsvinst' | 'Övrigt Inkomst'
  | 'Mat' | 'Restaurang' | 'Transport' | 'Boende' | 'Telefon' | 'Streaming'
  | 'Kläder' | 'Hälsa' | 'Aktiviteter' | 'Handel' | 'Resor' | 'Sparande'
  | 'Investering' | 'Övrigt Utgift' | 'Överföring';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: Category;
  account: string;
  type: TransactionType;
  isTransfer: boolean;
  tags?: string[];
  source: 'seb_csv' | 'seb_xlsx' | 'avanza' | 'klarna' | 'csn' | 'manual';
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'credit';
  balance: number;
  color: string;
}

export interface BudgetGoal {
  category: Category;
  limit: number;
}

export interface AssetSnapshot {
  month: string;
  cash: number;
  avanza: number;
  crypto: number;
  sparkonto: number;
  other: number;
}

export interface DebtSnapshot {
  month: string;
  csn: number;
  klarna: number;
  other: number;
}

export interface MonthData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  cashflow: number;
  byCategory: Record<string, number>;
}

export interface Reminder {
  id: string;
  title: string;
  emoji: string;
  dayOfMonth: number;
  time: string;
  active: boolean;
  lastSentMonth?: string;
}

export type Page = 'overview' | 'transactions' | 'analytics' | 'budget' | 'networth' | 'import' | 'reminders' | 'settings' | 'portfolio';

export type Module = 'home' | 'economy' | 'fitness' | 'calendar';

export type FitnessPage =
  | 'home'           // FitnessHome.tsx
  | 'weightlog'      // WeightLog.tsx
  | 'workoutlog'     // WorkoutLog.tsx
  | 'workoutprogram' // WorkoutProgram.tsx
  | 'exercises'      // ExerciseDB.tsx
  | 'foodlog'        // FoodLog.tsx
  | 'recipes'        // Recipes.tsx
  | 'pantry'         // Pantry.tsx
  | 'mealplan'       // MealPlan.tsx
  | 'development'    // Development.tsx – grafer och statistik
  | 'cyclehub'       // CycleHub.tsx – menscykel (bara om female)
  | 'goalcenter'     // GoalCenter.tsx
  | 'onboarding'     // Onboarding.tsx (legacy)
  | 'program'        // WorkoutProgram.tsx (legacy alias)
  | 'exercisedetail' // ExerciseDetail

export interface BodyMeasurements {
  waist?: number;
  hips?: number;
  chest?: number;
  armLeft?: number;
  armRight?: number;
  thighLeft?: number;
  thighRight?: number;
  neck?: number;
  calf?: number;
}

export interface BodyEntry {
  date: string;
  weight?: number;
  measurements?: BodyMeasurements;
  bodyFatPercent?: number;
  leanMass?: number;
  notes?: string;
  photoUrl?: string;
}

export interface FitnessProfile {
  gender: 'male' | 'female';
  height: number;
  age: number;
  targetWeight?: number;
  goal: 'lose_fat' | 'gain_muscle' | 'recomp' | 'maintain';
}

export interface FilterState {
  months: string[];
  categories: Category[];
  accounts: string[];
  type: 'all' | 'income' | 'expense';
  search: string;
  amountMin: number | null;
  amountMax: number | null;
  tags: string[];
  dateFrom: string | null;
  dateTo: string | null;
}

export interface Holding {
  isin: string;
  name: string;
  shares: number;
  avgBuyPrice: number;
  currency: string;
  account: string;
}

export interface TickerMapping {
  isin: string;
  ticker: string;
  name: string;
  manual?: boolean;
  category?: string;
  quoteType?: string;
  assetClass?: string;
}

export interface PriceData {
  ticker: string;
  price: number;
  currency: string;
  changePercent: number;
  fetchedAt: number;
  category?: string;
  quoteType?: string;
}

export interface PortfolioSnapshot {
  date: string;
  totalValueSEK: number;
  holdings: { isin: string; name: string; valueSEK: number; shares: number }[];
}

export interface ImportBatch {
  id: string;
  filename: string;
  uploadedAt: number;
  txCount: number;
  dateFrom: string;
  dateTo: string;
  account: string;
}

export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodId: string;
  foodName: string;
  amount: number; // gram
  nutrition: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber?: number;
  };
  source: 'livsmedelsverket' | 'openfoodfacts' | 'custom';
  timestamp: number;
}

export interface NutritionSettings {
  targetCalories: number;
  proteinTarget: number; // g
  carbTarget: number; // g
  fatTarget: number; // g
  goal: 'lose_fat' | 'gain_muscle' | 'maintain';
  bmrFormula: 'mifflin' | 'katch' | 'harris';
  activityLevel: number; // 1.2 | 1.375 | 1.55 | 1.725 | 1.9
}

export interface FoodItem {
  id: string;
  name: string;
  energy_kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  source: 'livsmedelsverket' | 'openfoodfacts' | 'custom';
  barcode?: string;
}

export interface RecipeIngredient {
  name: string;
  originalText: string; // e.g. "3 dl mjölk"
  amount: number; // grams (normalized)
  originalAmount: number;
  originalUnit: string;
  foodId?: string; // matched LV id
  pricePerKg?: number; // from price DB
  nutrition?: { kcal: number; protein: number; fat: number; carbs: number; fiber?: number };
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  prepTime?: number; // minutes
  ingredients: RecipeIngredient[];
  instructions: string[];
  tags: string[];
  nutritionPerServing: { kcal: number; protein: number; fat: number; carbs: number; fiber?: number };
  totalCostRaw?: number; // SEK, exact grams used
  totalCostReal?: number; // SEK, minimum purchasable units
  source?: string; // URL
  imageUrl?: string;
  createdAt: number;
}

export interface PantryItem {
  id: string;
  name: string;
  articleNumber?: string; // ICA article number
  barcode?: string; // EAN-13
  amount: number; // current stock (grams or units)
  unit: 'g' | 'st';
  unitWeightGrams?: number; // grams per "st" package
  pricePerUnit?: number; // SEK per piece/package
  pricePerKg?: number; // SEK/kg
  expiryDate?: string;
  category?: string;
  addedAt: number;
  source: 'receipt' | 'barcode' | 'manual';
  foodId?: string; // matched to LV database
}

export interface PriceEntry {
  name: string;
  articleNumber?: string;
  barcode?: string;
  pricePerUnit?: number; // SEK per piece/package
  pricePerKg?: number; // SEK per kg
  unitWeightGrams?: number; // grams per unit (if known)
  store: string;
  lastUpdated: string; // YYYY-MM-DD
}

// ── Workout / Exercise types (Fas 5) ─────────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;               // Swedish name
  nameEn?: string;            // English name
  category: string;           // 'Ben', 'Bröst', 'Rygg', 'Axlar', 'Biceps', 'Triceps', 'Core', 'Helkropp', 'Kondition'
  muscles: string[];          // Primary muscles
  musclesSecondary?: string[];
  equipment: string;          // 'Skivstång', 'Hantel', 'Kabel', 'Maskin', 'Kroppsvikt', 'Bänk', 'Smith', 'Övrigt'
  level: 'beginner' | 'intermediate' | 'advanced';
  mechanic: 'compound' | 'isolation' | 'cardio';
  youtubeSearch: string;      // Search query to open on YouTube
  instructions?: string[];
}

export interface WorkoutSet {
  id: string;
  weight?: number;   // kg (undefined for bodyweight)
  reps?: number;
  rpe?: number;      // 1–10
  time?: number;     // seconds (for timed sets)
  completed: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  date: string;              // YYYY-MM-DD
  startTime: number;         // ms timestamp
  endTime?: number;
  duration?: number;         // seconds
  exercises: LoggedExercise[];
  notes?: string;
  programDayName?: string;   // e.g. "Push A" if started from program
  totalVolume?: number;      // sum of weight × reps across all sets
}

// ── Calendar types (Fas 7) ───────────────────────────────────────────────────

export type CalendarSourceType = 'own' | 'ics' | 'google' | 'microsoft' | 'apple';

export interface CalendarSource {
  id: string;
  type: CalendarSourceType;
  name: string;
  color: string;        // hex color e.g. "#4285F4"
  enabled: boolean;
  // ICS-specific
  icsUrl?: string;
  lastFetched?: string; // ISO datetime
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;        // ISO datetime string (stored as string for Firestore)
  end: string;
  allDay: boolean;
  source: CalendarSourceType;
  sourceId: string;     // which CalendarSource this comes from
  color?: string;
  location?: string;
  description?: string;
  url?: string;
  uid?: string;         // iCal UID for deduplication
}

// ── Training Program types (Fas 6) ────────────────────────────────────────────

export type TrainingGoal = 'lose_fat' | 'gain_muscle' | 'recomp' | 'strength' | 'endurance';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type ProgramSplit = 'full_body' | 'upper_lower' | 'ppl';

export interface TrainingProfile {
  age: number;
  gender: 'male' | 'female';
  height: number;          // cm
  weight: number;          // kg
  bodyFat?: number;        // %
  goal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  trainingDaysPerWeek: number;
  availableEquipment: string[];
  cardioDaysPerWeek?: number;
  cardioType?: string;
  injuries?: string;
  preferBuilt: boolean;    // true = want a pre-built program
}

export interface ProgramSet {
  reps: string;   // e.g. "4-6" or "8-12"
  rir?: number;   // Reps In Reserve
}

export interface ProgramExercise {
  name: string;
  sets: number;
  repsRange: string;  // e.g. "4-6"
  rest: number;       // seconds
  note?: string;
}

export interface WorkoutDay {
  dayName: string;     // "Måndag", "Tisdag" etc. or "Push A", "Pull A" etc.
  splitLabel: string;  // "Push", "Pull", "Legs", "Överkropp", "Helkropp"
  exercises: ProgramExercise[];
}

export interface WorkoutProgram {
  id: string;
  name: string;
  split: ProgramSplit;
  daysPerWeek: number;
  goal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  schedule: WorkoutDay[];   // ordered list of training days in the week
  createdAt: number;
}

export interface ParsedReceiptItem {
  name: string;
  articleNumber: string;
  pris: number;        // effective price paid per unit/kg (after discount)
  regularPris?: number; // listed unit/kg price before discount (for price DB)
  amount: number;      // quantity bought
  unit: 'st' | 'kg';
  hasDiscount: boolean;
  selected: boolean;   // for UI selection
}
