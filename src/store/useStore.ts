import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transaction, BudgetGoal, AssetSnapshot, DebtSnapshot, FilterState, Page, Category, Reminder, ImportBatch, Holding, TickerMapping, PriceData, PortfolioSnapshot } from '../types';

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

interface AppState {
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
  page: Page;
  filter: FilterState;
  pushSubscription: string | null;

  // Firebase setters (called after loading from Firestore)
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

  // Local actions
  addTransactions: (txs: Transaction[]) => void;
  addManualTransaction: (tx: Transaction) => void;
  clearTransactions: () => void;
  updateBudget: (category: Category, limit: number) => void;
  addAssetSnapshot: (s: AssetSnapshot) => void;
  addDebtSnapshot: (s: DebtSnapshot) => void;
  setPage: (p: Page) => void;
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
      page: 'overview',
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

      setPage: (page) => set({ page }),
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
      name: 'ekonomi_v4',
      partialize: (s) => ({
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
      }),
    }
  )
);
