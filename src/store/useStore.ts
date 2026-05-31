import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transaction, BudgetGoal, AssetSnapshot, DebtSnapshot, FilterState, Page, Module, FitnessPage, FitnessProfile, Category, Reminder, ImportBatch, Holding, TickerMapping, PriceData, PortfolioSnapshot, NutritionSettings, UserProfile } from '../types';
import { saveUserProfile } from '../lib/db';
import { calculateBMR, calculateTDEE, calculateMacroTargets, getAgeFromBirthDate } from '../utils/calculations';

const DEFAULT_BUDGETS: BudgetGoal[] = [
  { category: 'Mat', limit: 2000 },
  { category: 'Boende', limit: 5200 },
  { category: 'Transport', limit: 600 },
  { category: 'Telefon', limit: 130 },
  { category: 'Restaurang', limit: 500 },
  { category: 'Kläder', limit: 600 },
  { category: 'Hälsa', limit: 300 },
  { category: 'Aktiviteter', limit: 500 },
  { category: 'Handel', limit: 400 },
  { category: 'Streaming', limit: 200 },
  { category: 'Övrigt Utgift', limit: 500 },
];

const DEFAULT_FILTER: FilterState = {
  months: [],
  categories: [],
  accounts: [],
  type: 'all',
  search: '',
  amountMin: null,
  amountMax: null,
  tags: [],
  dateFrom: null,
  dateTo: null,
};

const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'moms', title: 'Momsdeklaration', emoji: '🧾', dayOfMonth: 26, time: '08:00', active: true },
  { id: 'hyra', title: 'Betala hyra', emoji: '🏠', dayOfMonth: 25, time: '08:00', active: true },
  { id: 'ekonomi', title: 'Ekonomigenomgång', emoji: '📊', dayOfMonth: -2, time: '08:00', active: true },
];

const DEFAULT_FITNESS_PROFILE: FitnessProfile = {
  gender: 'male',
  height: 180,
  age: 25,
  goal: 'maintain',
};

const DEFAULT_NUTRITION_SETTINGS: NutritionSettings = {
  targetCalories: 2000,
  proteinTarget: 150,
  carbTarget: 200,
  fatTarget: 65,
  goal: 'maintain',
  bmrFormula: 'mifflin',
  activityLevel: 1.55,
};

interface AppState {
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;
  updateUserProfile: (partial: Partial<UserProfile>) => Promise<void>;

  transactions: Transaction[];
  budgets: BudgetGoal[];
  assets: AssetSnapshot[];
  debts: DebtSnapshot[];
  reminders: Reminder[];
  importBatches: ImportBatch[];
  ownAccounts: string[];
  holdings: Holding[];
  tickerMappings: TickerMapping[];
  priceCache: Record<string, PriceData>;
  portfolioSnapshots: PortfolioSnapshot[];
  assetClasses: string[];
  module: Module;
  page: Page;
  fitnessPage: FitnessPage;
  fitnessProfile: FitnessProfile;
  nutritionSettings: NutritionSettings;
  filter: FilterState;
  pushSubscription: string | null;

  setFirebaseTransactions: (txs: Transaction[]) => void;
  setFirebaseBudgets: (b: BudgetGoal[]) => void;
  setFirebaseAssets: (a: AssetSnapshot[]) => void;
  setFirebaseDebts: (d: DebtSnapshot[]) => void;
  setImportBatches: (imp: ImportBatch[]) => void;
  setOwnAccounts: (accounts: string[]) => void;
  addOwnAccount: (account: string) => void;
  removeOwnAccount: (account: string) => void;
  setHoldings: (h: Holding[]) => void;
  setTickerMappings: (m: TickerMapping[]) => void;
  upsertTickerMapping: (m: TickerMapping) => void;
  setPriceCache: (p: Record<string, PriceData>) => void;
  setPortfolioSnapshots: (s: PortfolioSnapshot[]) => void;
  addPortfolioSnapshot: (s: PortfolioSnapshot) => void;
  setAssetClasses: (classes: string[]) => void;

  addTransactions: (txs: Transaction[]) => void;
  addManualTransaction: (tx: Transaction) => void;
  clearTransactions: () => void;
  updateBudget: (category: Category, limit: number) => void;
  addAssetSnapshot: (s: AssetSnapshot) => void;
  addDebtSnapshot: (s: DebtSnapshot) => void;
  setModule: (m: Module) => void;
  setPage: (p: Page) => void;
  setFitnessPage: (p: FitnessPage) => void;
  pendingWorkout: { exercises: { name: string }[]; dayName: string } | null;
  setPendingWorkout: (w: { exercises: { name: string }[]; dayName: string } | null) => void;
  setFitnessProfile: (p: Partial<FitnessProfile>) => void;
  setNutritionSettings: (s: Partial<NutritionSettings>) => void;
  setFilter: (f: Partial<FilterState>) => void;
  resetFilter: () => void;
  updateTransaction: (id: string, changes: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addImportBatch: (imp: ImportBatch, txs: Transaction[]) => void;
  removeImportBatch: (importId: string) => void;
  addReminder: (r: Reminder) => void;
  updateReminder: (id: string, changes: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  setPushSubscription: (sub: string | null) => void;
}

function mergeTxsLocal(existing: Transaction[], incoming: Transaction[]): Transaction[] {
  const map = new Map(existing.map(t => [t.id, t]));
  for (const tx of incoming) map.set(tx.id, tx);
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      userProfile: null,

      setUserProfile: (profile) => set({ userProfile: profile }),

      updateUserProfile: async (partial) => {
        const current = useStore.getState().userProfile;
        if (!current) return;
        const updated: UserProfile = { ...current, ...partial, updatedAt: Date.now() };

        // Auto-beräkna BMR/TDEE om relevanta fält ändrats
        if (updated.height && updated.currentWeight && updated.birthDate && updated.gender) {
          const age = getAgeFromBirthDate(updated.birthDate);
          updated.bmr = Math.round(calculateBMR(updated.currentWeight, updated.height, age, updated.gender));
          updated.estimatedTDEE = calculateTDEE(updated.bmr, updated.activityLevel);
        }

        // Auto-beräkna leanBodyMass
        if (updated.currentWeight && updated.currentBodyFat !== undefined) {
          updated.leanBodyMass = Math.round(updated.currentWeight * (1 - updated.currentBodyFat / 100) * 10) / 10;
        }

        // Auto-beräkna makromål
        if (updated.estimatedTDEE && updated.currentWeight) {
          const macros = calculateMacroTargets(
            updated.estimatedTDEE,
            updated.currentWeight,
            updated.primaryGoal,
            updated.weeklyWeightChangeTarget,
          );
          Object.assign(updated, macros);
        }

        set({ userProfile: updated });
        await saveUserProfile(updated.uid, updated);
      },

      transactions: [],
      budgets: DEFAULT_BUDGETS,
      assets: [],
      debts: [],
      reminders: DEFAULT_REMINDERS,
      importBatches: [],
      ownAccounts: [],
      holdings: [],
      tickerMappings: [],
      priceCache: {},
      portfolioSnapshots: [],
      assetClasses: ['Aktier', 'Räntebärande', 'Råvaror', 'Fastigheter', 'Övrigt'],
      module: 'home',
      page: 'overview',
      fitnessPage: 'home',
      pendingWorkout: null,
      fitnessProfile: DEFAULT_FITNESS_PROFILE,
      nutritionSettings: DEFAULT_NUTRITION_SETTINGS,
      filter: DEFAULT_FILTER,
      pushSubscription: null,

      setFirebaseTransactions: (txs) => set({ transactions: txs }),
      setFirebaseBudgets: (budgets) => set({ budgets }),
      setFirebaseAssets: (assets) => set({ assets }),
      setFirebaseDebts: (debts) => set({ debts }),
      setImportBatches: (importBatches) => set({ importBatches }),
      setOwnAccounts: (ownAccounts) => set({ ownAccounts }),
      addOwnAccount: (account) => set(s => ({ ownAccounts: [...new Set([...s.ownAccounts, account.trim()])] })),
      removeOwnAccount: (account) => set(s => ({ ownAccounts: s.ownAccounts.filter(a => a !== account) })),

      setHoldings: (holdings) => set({ holdings }),
      setTickerMappings: (tickerMappings) => set({ tickerMappings }),
      upsertTickerMapping: (m) => set(s => {
        const existing = s.tickerMappings.filter(x => x.isin !== m.isin);
        return { tickerMappings: [...existing, m] };
      }),
      setPriceCache: (priceCache) => set({ priceCache }),
      setPortfolioSnapshots: (portfolioSnapshots) => set({ portfolioSnapshots }),
      setAssetClasses: (assetClasses) => set({ assetClasses }),
      addPortfolioSnapshot: (snap) => set(s => {
        const existing = s.portfolioSnapshots.filter(x => x.date !== snap.date);
        return { portfolioSnapshots: [...existing, snap].sort((a, b) => a.date.localeCompare(b.date)) };
      }),

      addTransactions: (incoming) =>
        set(s => ({ transactions: mergeTxsLocal(s.transactions, incoming) })),

      addManualTransaction: (tx) =>
        set(s => ({ transactions: mergeTxsLocal(s.transactions, [tx]) })),

      clearTransactions: () => set({ transactions: [], importBatches: [] }),

      updateBudget: (category, limit) =>
        set(s => ({
          budgets: s.budgets.some(b => b.category === category)
            ? s.budgets.map(b => b.category === category ? { ...b, limit } : b)
            : [...s.budgets, { category, limit }],
        })),

      addAssetSnapshot: (snap) =>
        set(s => {
          const existing = s.assets.filter(a => a.month !== snap.month);
          return { assets: [...existing, snap].sort((a, b) => a.month.localeCompare(b.month)) };
        }),

      addDebtSnapshot: (snap) =>
        set(s => {
          const existing = s.debts.filter(d => d.month !== snap.month);
          return { debts: [...existing, snap].sort((a, b) => a.month.localeCompare(b.month)) };
        }),

      setModule: (module) => set({ module }),
      setPage: (page) => set({ page }),
      setFitnessPage: (fitnessPage) => set({ fitnessPage }),
      setPendingWorkout: (pendingWorkout) => set({ pendingWorkout }),
      setFitnessProfile: (p) => set(s => ({ fitnessProfile: { ...s.fitnessProfile, ...p } })),
      setNutritionSettings: (s2) => set(s => ({ nutritionSettings: { ...s.nutritionSettings, ...s2 } })),
      setFilter: (f) => set(s => ({ filter: { ...s.filter, ...f } })),
      resetFilter: () => set({ filter: DEFAULT_FILTER }),

      updateTransaction: (id, changes) =>
        set(s => ({ transactions: s.transactions.map(t => t.id === id ? { ...t, ...changes } : t) })),

      deleteTransaction: (id) =>
        set(s => ({ transactions: s.transactions.filter(t => t.id !== id) })),

      addImportBatch: (imp, txs) =>
        set(s => ({
          importBatches: [imp, ...s.importBatches],
          transactions: mergeTxsLocal(s.transactions, txs),
        })),

      removeImportBatch: (importId) =>
        set(s => ({
          importBatches: s.importBatches.filter(i => i.id !== importId),
          transactions: s.transactions.filter(t => (t as any).importId !== importId),
        })),

      addReminder: (r) => set(s => ({ reminders: [...s.reminders, r] })),
      updateReminder: (id, changes) =>
        set(s => ({ reminders: s.reminders.map(r => r.id === id ? { ...r, ...changes } : r) })),
      deleteReminder: (id) =>
        set(s => ({ reminders: s.reminders.filter(r => r.id !== id) })),
      setPushSubscription: (sub) => set({ pushSubscription: sub }),
    }),
    {
      name: 'ekonomi_v5',
      partialize: (s) => ({
        userProfile: s.userProfile,
        transactions: s.transactions,
        budgets: s.budgets,
        assets: s.assets,
        debts: s.debts,
        reminders: s.reminders,
        importBatches: s.importBatches,
        ownAccounts: s.ownAccounts,
        holdings: s.holdings,
        tickerMappings: s.tickerMappings,
        portfolioSnapshots: s.portfolioSnapshots,
        assetClasses: s.assetClasses,
        pushSubscription: s.pushSubscription,
        fitnessProfile: s.fitnessProfile,
        nutritionSettings: s.nutritionSettings,
      }),
    }
  )
);
