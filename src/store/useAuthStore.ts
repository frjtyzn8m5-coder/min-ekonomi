import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth';

import { auth } from '../lib/firebase';
import { loadTransactions, loadImports, loadBudgets, loadAssets, loadDebts } from '../lib/db';
import { useStore } from './useStore';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initAuth: () => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

async function loadUserData(uid: string) {
  const [txs, imports, budgets, assets, debts] = await Promise.all([
    loadTransactions(uid),
    loadImports(uid),
    loadBudgets(uid),
    loadAssets(uid),
    loadDebts(uid),
  ]);
  const store = useStore.getState();
  if (txs.length)     store.setFirebaseTransactions(txs);
  if (imports.length) store.setImportBatches(imports);
  if (budgets.length) store.setFirebaseBudgets(budgets);
  if (assets.length)  store.setFirebaseAssets(assets);
  if (debts.length)   store.setFirebaseDebts(debts);
}

const handleSignInError = (e: any, set: (s: Partial<AuthState>) => void) => {
  const msg =
    e.code === 'auth/popup-closed-by-user'     ? 'Inloggning avbröts.' :
    e.code === 'auth/popup-blocked'             ? 'Popup blockerades av webbläsaren.' :
    e.code === 'auth/account-exists-with-different-credential'
                                               ? 'Det finns redan ett konto med den e-postadressen.' :
    e.code === 'auth/cancelled-popup-request'  ? null : // silent – user opened multiple popups
    'Inloggning misslyckades. Försök igen.';
  if (msg) set({ error: msg });
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,
  error: null,

  initAuth: () => {
    onAuthStateChanged(auth, async (user) => {
      set({ user, loading: false });
      if (user) await loadUserData(user.uid);
    });
  },

  signInWithGoogle: async () => {
    set({ error: null });
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      handleSignInError(e, set);
      throw e;
    }
  },

  logout: async () => {
    await signOut(auth);
    const store = useStore.getState();
    store.setFirebaseTransactions([]);
    store.setFirebaseBudgets([]);
    store.setFirebaseAssets([]);
    store.setFirebaseDebts([]);
    store.setImportBatches([]);
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));
