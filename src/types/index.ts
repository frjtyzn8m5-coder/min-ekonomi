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

export type FitnessPage = 'home' | 'weightlog' | 'foodlog' | 'workoutlog' | 'exercises' | 'recipes' | 'pantry' | 'mealplan';

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

export interface ParsedReceiptItem {
  name: string;
  articleNumber: string;
  pris: number; // original price per unit or per kg
  amount: number; // quantity bought
  unit: 'st' | 'kg';
  hasDiscount: boolean;
  selected: boolean; // for UI selection
}
