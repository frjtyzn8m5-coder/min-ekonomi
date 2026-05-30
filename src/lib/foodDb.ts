import { doc, setDoc, getDocs, collection, query, where, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { FoodEntry } from '../types';

// ─── Food Log ────────────────────────────────────────────────────────────────

export async function saveFoodEntry(uid: string, entry: FoodEntry): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'foodLog', entry.id),
    entry,
    { merge: true }
  );
}

export async function deleteFoodEntry(uid: string, entryId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'foodLog', entryId));
}

export async function loadFoodLog(uid: string, date: string): Promise<FoodEntry[]> {
  const q = query(
    collection(db, 'users', uid, 'foodLog'),
    where('date', '==', date),
    orderBy('timestamp', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FoodEntry);
}

export async function loadFoodLogRange(
  uid: string,
  dateFrom: string,
  dateTo: string
): Promise<FoodEntry[]> {
  const q = query(
    collection(db, 'users', uid, 'foodLog'),
    where('date', '>=', dateFrom),
    where('date', '<=', dateTo),
    orderBy('date', 'asc'),
    orderBy('timestamp', 'asc'),
    limit(1000)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FoodEntry);
}

// ─── Nutrition Settings ───────────────────────────────────────────────────────

export async function saveNutritionSettings(uid: string, settings: object): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'settings', 'nutrition'),
    settings,
    { merge: true }
  );
}
