import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transaction, BudgetGoal, AssetSnapshot, DebtSnapshot, FilterState, Page, Category, Reminder } from '../types';
import { mergeTxs } from '../utils/parsers';

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
};

const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'moms', title: 'Momsdeklaration', emoji: '🧾', dayOfMonth: 26, time: '08:00', active: true },
  { id: 'hyra', title: 'Betala hyra', emoji: '🏠', dayOfMonth: 25, time: '08:00', active: true },
  { id: 'ekonomi', title: 'Ekonomigenomgång', emoji: '📊', dayOfMonth: -2, time: '08:00', active: true },
];

// Debounce timer for cloud sync
let syncTimer: ReturnType<typeof setTimeout> | null = null;

type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

interface AppState {
  transactions: Transaction[];
  budgets: BudgetGoal[];
  assets: AssetSnapshot[];
  debts: DebtSnapshot[];
  reminders: Reminder[];
  page: Page;
  filter: FilterState;
  pushSubscription: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;

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
  addReminder: (r: Reminder) => void;
  updateReminder: (id: string, changes: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  setPushSubscription: (sub: string | null) => void;
  syncToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;
}

function scheduleSyncToCloud(getState: () => AppState) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    getState().syncToCloud();
  }, 2000);
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      transactions: [],
      budgets: DEFAULT_BUDGETS,
      assets: [],
      debts: [],
      reminders: DEFAULT_REMINDERS,
      page: 'overview',
      filter: DEFAULT_FILTER,
      pushSubscription: null,
      syncStatus: 'idle' as SyncStatus,
      lastSyncedAt: null,

      addTransactions: (incoming) => {
        const merged = mergeTxs(get().transactions, incoming);
        set({ transactions: merged });
        scheduleSyncToCloud(get);
      },

      addManualTransaction: (tx) => {
        set(s => ({ transactions: mergeTxs(s.transactions, [tx]) }));
        scheduleSyncToCloud(get);
      },

      clearTransactions: () => {
        set({ transactions: [] });
        scheduleSyncToCloud(get);
      },

      updateBudget: (category, limit) => {
        set(s => ({
          budgets: s.budgets.some(b => b.category === category)
            ? s.budgets.map(b => b.category === category ? { ...b, limit } : b)
            : [...s.budgets, { category, limit }],
        }));
        scheduleSyncToCloud(get);
      },

      addAssetSnapshot: (snap) => {
        set(s => {
          const existing = s.assets.filter(a => a.month !== snap.month);
          return { assets: [...existing, snap].sort((a, b) => a.month.localeCompare(b.month)) };
        });
        scheduleSyncToCloud(get);
      },

      addDebtSnapshot: (snap) => {
        set(s => {
          const existing = s.debts.filter(d => d.month !== snap.month);
          return { debts: [...existing, snap].sort((a, b) => a.month.localeCompare(b.month)) };
        });
        scheduleSyncToCloud(get);
      },

      setPage: (page) => set({ page }),

      setFilter: (f) => set(s => ({ filter: { ...s.filter, ...f } })),

      resetFilter: () => set({ filter: DEFAULT_FILTER }),

      updateTransaction: (id, changes) => {
        set(s => ({ transactions: s.transactions.map(t => t.id === id ? { ...t, ...changes } : t) }));
        scheduleSyncToCloud(get);
      },

      deleteTransaction: (id) => {
        set(s => ({ transactions: s.transactions.filter(t => t.id !== id) }));
        scheduleSyncToCloud(get);
      },

      addReminder: (r) => set(s => ({ reminders: [...s.reminders, r] })),

      updateReminder: (id, changes) => set(s => ({
        reminders: s.reminders.map(r => r.id === id ? { ...r, ...changes } : r),
      })),

      deleteReminder: (id) => set(s => ({
        reminders: s.reminders.filter(r => r.id !== id),
      })),

      setPushSubscription: (sub) => set({ pushSubscription: sub }),

      syncToCloud: async () => {
        const state = get();
        set({ syncStatus: 'syncing' });
        try {
          await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactions: state.transactions,
              budgets: state.budgets,
              assets: state.assets,
              debts: state.debts,
              _savedAt: Date.now(),
            }),
          });
          set({ syncStatus: 'ok', lastSyncedAt: Date.now() });
        } catch {
          set({ syncStatus: 'error' });
        }
      },

      loadFromCloud: async () => {
        try {
          const res = await fetch('/api/data');
          if (!res.ok) return;
          const data = await res.json();
          if (!data) return;
          const state = get();
          if (data.transactions?.length) {
            const merged = mergeTxs(state.transactions, data.transactions);
            set({ transactions: merged });
          }
          if (data.budgets?.length) set({ budgets: data.budgets });
          if (data.assets?.length) set({ assets: data.assets });
          if (data.debts?.length) set({ debts: data.debts });
          set({ syncStatus: 'ok', lastSyncedAt: Date.now() });
        } catch {
          set({ syncStatus: 'error' });
        }
      },
    }),
    {
      name: 'ekonomi_v4',
      partialize: (s) => ({
        transactions: s.transactions,
        budgets: s.budgets,
        assets: s.assets,
        debts: s.debts,
        reminders: s.reminders,
        pushSubscription: s.pushSubscription,
      }),
    }
  )
);
