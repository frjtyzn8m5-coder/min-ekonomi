import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { PantryItem, Recipe, PriceEntry } from '../types';

// ── Pantry ────────────────────────────────────────────────────────────────────

export async function loadPantry(uid: string): Promise<PantryItem[]> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'pantry'), orderBy('addedAt', 'desc')),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PantryItem));
}

export async function savePantryItem(uid: string, item: PantryItem): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'pantry', item.id), item);
}

export async function deletePantryItem(uid: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'pantry', itemId));
}

/** Adjust stock amount (+/-). Pass negative delta to consume. */
export async function adjustPantryStock(
  uid: string,
  item: PantryItem,
  delta: number,
): Promise<void> {
  const newAmount = Math.max(0, item.amount + delta);
  await setDoc(
    doc(db, 'users', uid, 'pantry', item.id),
    { ...item, amount: newAmount },
  );
}

/** Batch-upsert pantry items parsed from a receipt. */
export async function upsertPantryItems(uid: string, items: PantryItem[]): Promise<void> {
  const batch = writeBatch(db);
  for (const item of items) {
    batch.set(doc(db, 'users', uid, 'pantry', item.id), item, { merge: true });
  }
  await batch.commit();
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export async function loadRecipes(uid: string): Promise<Recipe[]> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'recipes'), orderBy('createdAt', 'desc')),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
}

export async function saveRecipe(uid: string, recipe: Recipe): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'recipes', recipe.id), recipe);
}

export async function deleteRecipe(uid: string, recipeId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'recipes', recipeId));
}

// ── Price DB ──────────────────────────────────────────────────────────────────
// Key: ICA article number (7 digits) OR "barcode_{ean}" for barcode-only items.

export async function loadPriceDB(uid: string): Promise<PriceEntry[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'priceDB'));
  return snap.docs.map(d => d.data() as PriceEntry);
}

export async function upsertPriceEntry(uid: string, entry: PriceEntry): Promise<void> {
  const key = entry.articleNumber ?? (entry.barcode ? `barcode_${entry.barcode}` : null);
  if (!key) throw new Error('PriceEntry must have articleNumber or barcode');
  await setDoc(doc(db, 'users', uid, 'priceDB', key), entry, { merge: true });
}

/** Batch-upsert price entries parsed from a receipt. */
export async function upsertPriceEntries(uid: string, entries: PriceEntry[]): Promise<void> {
  const batch = writeBatch(db);
  for (const entry of entries) {
    const key = entry.articleNumber ?? (entry.barcode ? `barcode_${entry.barcode}` : null);
    if (!key) continue;
    batch.set(doc(db, 'users', uid, 'priceDB', key), entry, { merge: true });
  }
  await batch.commit();
}
