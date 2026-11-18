// ── Menscykel – rik dagslogg (flöde, symtom, humör, BBT …) ───────────────────
// Firestore: users/{uid}/cycleLogs/{date}
// Ett dokument per dygn (id === date). Följer samma mönster som foodDb/calendarDb
// och respekterar demoläge (loaders returnerar [], skrivningar no-op).

import {
  collection, doc, setDoc, getDocs, deleteDoc, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CycleLog } from '../types';
import { isDemoMode } from './demoData';

const logsCol = (uid: string) => collection(db, 'users', uid, 'cycleLogs');
const logDoc = (uid: string, id: string) => doc(db, 'users', uid, 'cycleLogs', id);

export async function loadCycleLogs(uid: string): Promise<CycleLog[]> {
  if (isDemoMode()) return [];
  const q = query(logsCol(uid), orderBy('date', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as CycleLog);
}

export async function saveCycleLog(uid: string, log: CycleLog): Promise<void> {
  if (isDemoMode()) return;
  // Rensa undefined-fält (valfria flöde/symtom/BBT) innan skrivning.
  const clean = JSON.parse(JSON.stringify(log));
  await setDoc(logDoc(uid, log.id), clean);
}

export async function deleteCycleLog(uid: string, id: string): Promise<void> {
  if (isDemoMode()) return;
  await deleteDoc(logDoc(uid, id));
}
