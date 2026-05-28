import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { loadTransactions, loadImports, loadBudgets, loadAssets, loadDebts } from '../lib/db';
import { useStore } from './useStore';

// Internally we append this domain so Firebase is happy with "email" format
const DOMAIN = '@min-ekonomi.app';
const toEmail = (username: string) => username.toLowerCase().trim() + DOMAIN;

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initAuth: () => void;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
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

  login: async (username, password) => {
    set({ error: null });
    try {
      await signInWithEmailAndPassword(auth, toEmail(username), password);
    } catch (e: any) {
      const msg =
        e.code === 'auth/invalid-credential' ? 'Fel användarnamn eller lösenord.' :
        e.code === 'auth/user-not-found'      ? 'Användaren finns inte.' :
        e.code === 'auth/wrong-password'      ? 'Fel lösenord.' :
        e.code === 'auth/too-many-requests'   ? 'För många försök. Vänta en stund.' :
        'Inloggning misslyckades.';
      set({ error: msg });
      throw e;
    }
  },

  register: async (username, password) => {
    set({ error: null });
    try {
      await createUserWithEmailAndPassword(auth, toEmail(username), password);
    } catch (e: any) {
      const msg =
        e.code === 'auth/email-already-in-use' ? 'Användarnamnet är redan taget.' :
        e.code === 'auth/weak-password'         ? 'Lösenordet måste vara minst 6 tecken.' :
        e.code === 'auth/invalid-email'         ? 'Ogiltigt användarnamn.' :
        'Registrering misslyckades.';
      set({ error: msg });
      throw e;
    }
  },

  logout: async () => {
    await signOut(auth);
    // Clear local data on logout
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
