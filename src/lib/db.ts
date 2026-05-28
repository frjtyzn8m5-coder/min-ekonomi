import {
  collection, doc, setDoc, getDoc, getDocs, deleteDoc, writeBatch, query, orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction, BudgetGoal, AssetSnapshot, DebtSnapshot, ImportBatch } from '../types';

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

// ── Own Accounts (for transfer detection) ────────────────────────────────────

export async function saveOwnAccounts(uid: string, accounts: string[]) {
  await setDoc(doc(db, 'users', uid, 'settings', 'ownAccounts'), { accounts });
}

export async function loadOwnAccounts(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'users', uid, 'settings', 'ownAccounts'));
  if (!snap.exists()) return [];
  return (snap.data().accounts as string[]) || [];
}
