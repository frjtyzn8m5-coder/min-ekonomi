/**
 * syncQueue.ts – Offline-first sync queue
 *
 * Flöde:
 *  1. Anropa addToQueue(path, docId, data) – sparas lokalt + läggs i pendingWrites
 *  2. Om online: skrivs direkt till Firestore
 *  3. Om offline: Background Sync registreras (eller iOS-fallback vid nästa app-start)
 *  4. processPendingQueue() körs vid reconnect och rensar kön
 */

import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { localDb } from './localDb';

// ─── Core queue logic ─────────────────────────────────────────────────────────

/**
 * Skriver data till Firestore om online, annars köar det lokalt.
 * @param collectionPath  Full Firestore-sökväg, t.ex. "users/uid/fitness/bodyLog"
 * @param docId           Dokument-ID
 * @param data            Data att skriva
 */
export async function addToQueue(
  collectionPath: string,
  docId: string,
  data: object
): Promise<void> {
  // Spara lokalt direkt (optimistic)
  await localDb.pendingWrites.add({
    collection: collectionPath,
    docId,
    data,
    status: 'pending',
    timestamp: Date.now(),
    retries: 0,
  });

  if (navigator.onLine) {
    await processPendingQueue();
  } else {
    // Registrera Background Sync om tillgängligt (Chrome/Android)
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await (reg as any).sync.register('firestore-sync');
      } catch {
        // Background Sync ej tillgänglig – iOS-fallback hanteras vid nästa app-start
      }
    }
  }
}

/**
 * Processar alla pending writes och skickar dem till Firestore.
 * Körs vid reconnect och vid app-start (iOS-fallback).
 */
export async function processPendingQueue(): Promise<void> {
  const pending = await localDb.pendingWrites
    .where('status')
    .equals('pending')
    .sortBy('timestamp');

  if (pending.length === 0) return;

  for (const item of pending) {
    try {
      // collection lagrar hela dokumentsökvägen utom sista segmentet,
      // t.ex. "users/uid/fitness/bodyLog" + docId "2026-05-30"
      const docRef = doc(db, `${item.collection}/${item.docId}`);
      await setDoc(docRef, item.data, { merge: true });

      await localDb.pendingWrites.update(item.id!, { status: 'synced' });
    } catch (err) {
      const retries = (item.retries ?? 0) + 1;
      await localDb.pendingWrites.update(item.id!, {
        retries,
        status: retries >= 5 ? 'failed' : 'pending',
      });
      console.warn('[syncQueue] Kunde inte skriva till Firestore:', err);
    }
  }

  // Rensa synkade poster äldre än 7 dagar
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await localDb.pendingWrites
    .where('status')
    .equals('synced')
    .and(item => item.timestamp < cutoff)
    .delete();
}

/**
 * Antal väntande skrivningar (för UI-indikator).
 */
export async function getPendingCount(): Promise<number> {
  return localDb.pendingWrites.where('status').equals('pending').count();
}

// ─── Online/offline listeners ─────────────────────────────────────────────────

let listenersRegistered = false;

/**
 * Starta upp listeners. Anropas en gång från main.tsx.
 * - Online-event: kör processPendingQueue
 * - iOS-fallback: kör processPendingQueue direkt vid start om det finns pending
 */
export function initSyncQueue(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  // Reconnect-listener
  window.addEventListener('online', () => {
    console.log('[syncQueue] Online – synkar...');
    processPendingQueue().catch(console.error);
  });

  // iOS-fallback: kör direkt vid app-start om online och det finns pending
  if (navigator.onLine) {
    localDb.pendingWrites
      .where('status')
      .equals('pending')
      .count()
      .then(count => {
        if (count > 0) {
          console.log(`[syncQueue] Hittade ${count} väntande – synkar...`);
          processPendingQueue().catch(console.error);
        }
      });
  }
}
