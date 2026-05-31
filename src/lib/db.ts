import {
  collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch, query, orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction, BudgetGoal, AssetSnapshot, DebtSnapshot, ImportBatch, Holding, TickerMapping, PriceData, PortfolioSnapshot, UserProfile } from '../types';

const userCol = (uid: string, col: string) => collection(db, 'users', uid, col);
const userDoc = (uid: string, col: string, id: string) => doc(db, 'users', uid, col, id);

// ── Transactions ────────────────────────────────────────────────────────────

export async function saveTxBatch(uid: string, txs: Transaction[], importId: string) {
  const batch = writeBatch(db);
  for (const tx of txs) {
    batch.set(userDoc(uid, 'transactions', tx.id), { ...tx, importId });
  }
  await batch.commit();
}

export async function loadTransactions(uid: string): Promise<Transaction[]> {
  const snap = await getDocs(query(userCol(uid, 'transactions'), orderBy('date', 'desc')));
  return snap.docs.map(d => d.data() as Transaction);
}

export async function deleteTransaction(uid: string, txId: string) {
  await deleteDoc(userDoc(uid, 'transactions', txId));
}

export async function deleteImportTxs(uid: string, importId: string) {
  const snap = await getDocs(userCol(uid, 'transactions'));
  const batch = writeBatch(db);
  snap.docs.filter(d => d.data().importId === importId).forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export async function updateTransactionDoc(uid: string, txId: string, changes: Partial<Transaction>) {
  await setDoc(userDoc(uid, 'transactions', txId), changes, { merge: true });
}

// ── Import batches ───────────────────────────────────────────────────────────

export async function saveImport(uid: string, imp: ImportBatch) {
  await setDoc(userDoc(uid, 'imports', imp.id), imp);
}

export async function loadImports(uid: string): Promise<ImportBatch[]> {
  const snap = await getDocs(query(userCol(uid, 'imports'), orderBy('uploadedAt', 'desc')));
  return snap.docs.map(d => d.data() as ImportBatch);
}

export async function deleteImport(uid: string, importId: string) {
  await deleteImportTxs(uid, importId);
  await deleteDoc(userDoc(uid, 'imports', importId));
}

// ── Budgets ──────────────────────────────────────────────────────────────────

export async function saveBudgets(uid: string, budgets: BudgetGoal[]) {
  const batch = writeBatch(db);
  for (const b of budgets) {
    batch.set(userDoc(uid, 'budgets', b.category), b);
  }
  await batch.commit();
}

export async function loadBudgets(uid: string): Promise<BudgetGoal[]> {
  const snap = await getDocs(userCol(uid, 'budgets'));
  return snap.docs.map(d => d.data() as BudgetGoal);
}

// ── Assets ───────────────────────────────────────────────────────────────────

export async function saveAsset(uid: string, snap: AssetSnapshot) {
  await setDoc(userDoc(uid, 'assets', snap.month), snap);
}

export async function loadAssets(uid: string): Promise<AssetSnapshot[]> {
  const snap = await getDocs(query(userCol(uid, 'assets'), orderBy('month')));
  return snap.docs.map(d => d.data() as AssetSnapshot);
}

// ── Debts ────────────────────────────────────────────────────────────────────

export async function saveDebt(uid: string, snap: DebtSnapshot) {
  await setDoc(userDoc(uid, 'debts', snap.month), snap);
}

export async function loadDebts(uid: string): Promise<DebtSnapshot[]> {
  const snap = await getDocs(query(userCol(uid, 'debts'), orderBy('month')));
  return snap.docs.map(d => d.data() as DebtSnapshot);
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export async function saveHoldings(uid: string, holdings: Holding[]) {
  await setDoc(doc(db, 'users', uid, 'portfolio', 'holdings'), { holdings, updatedAt: Date.now() });
}

export async function loadHoldings(uid: string): Promise<Holding[]> {
  const snap = await getDoc(doc(db, 'users', uid, 'portfolio', 'holdings'));
  return snap.exists() ? (snap.data().holdings as Holding[]) : [];
}

export async function saveTickerMappings(uid: string, mappings: TickerMapping[]) {
  await setDoc(doc(db, 'users', uid, 'portfolio', 'tickers'), { mappings });
}

export async function loadTickerMappings(uid: string): Promise<TickerMapping[]> {
  const snap = await getDoc(doc(db, 'users', uid, 'portfolio', 'tickers'));
  return snap.exists() ? (snap.data().mappings as TickerMapping[]) : [];
}

export async function savePriceCache(uid: string, prices: Record<string, PriceData>) {
  await setDoc(doc(db, 'users', uid, 'portfolio', 'priceCache'), { prices, savedAt: Date.now() });
}

export async function loadPriceCache(uid: string): Promise<Record<string, PriceData>> {
  const snap = await getDoc(doc(db, 'users', uid, 'portfolio', 'priceCache'));
  return snap.exists() ? (snap.data().prices as Record<string, PriceData>) : {};
}

export async function savePortfolioSnapshot(uid: string, snap: PortfolioSnapshot) {
  await setDoc(userDoc(uid, 'portfolioSnapshots', snap.date), snap);
}

export async function loadPortfolioSnapshots(uid: string): Promise<PortfolioSnapshot[]> {
  const snaps = await getDocs(query(userCol(uid, 'portfolioSnapshots'), orderBy('date')));
  return snaps.docs.map(d => d.data() as PortfolioSnapshot);
}

// ── Own Accounts (for transfer detection) ────────────────────────────────────

export async function saveOwnAccounts(uid: string, accounts: string[]) {
  await setDoc(doc(db, 'users', uid, 'settings', 'ownAccounts'), { accounts });
}

export async function loadOwnAccounts(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'users', uid, 'settings', 'ownAccounts'));
  if (!snap.exists()) return [];
  return (snap.data().accounts as string[]) || [];
}

// ── UserProfile ───────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'data'));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function saveUserProfile(uid: string, profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'profile', 'data'), profile);
}
