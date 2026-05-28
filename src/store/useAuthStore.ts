import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, provider } from '../lib/firebase';
import { loadTransactions, loadImports, loadBudgets, loadAssets, loadDebts } from '../lib/db';
import { useStore } from './useStore';

interface AuthState {
  user: User | null;
  loading: boolean;
  initAuth: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,

  initAuth: () => {
    onAuthStateChanged(auth, async (user) => {
      set({ user, loading: false });
      if (user) {
        // Load all data from Firestore
        const [txs, imports, budgets, assets, debts] = await Promise.all([
          loadTransactions(user.uid),
          loadImports(user.uid),
          loadBudgets(user.uid),
          loadAssets(user.uid),
          loadDebts(user.uid),
        ]);
        const store = useStore.getState();
        if (txs.length)     store.setFirebaseTransactions(txs);
        if (imports.length) store.setImportBatches(imports);
        if (budgets.length) store.setFirebaseBudgets(budgets);
        if (assets.length)  store.setFirebaseAssets(assets);
        if (debts.length)   store.setFirebaseDebts(debts);
      }
    });
  },

  login: async () => {
    await signInWithPopup(auth, provider);
  },

  logout: async () => {
    await signOut(auth);
    set({ user: null });
  },
}));
