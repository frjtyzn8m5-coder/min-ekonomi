// ── Calendar events persistence (Fas 8) ─────────────────────────────────────────
// Firestore: users/{uid}/calendarEvents/{id}
// Lagrar egna events, regelbundna påminnelser (med recurrence-regel) och
// importerade ICS-events (imported:true). Följer samma mönster som db.ts/fitnessDb.ts
// och respekterar demoläge (loaders returnerar []).

import {
  collection, doc, setDoc, getDocs, deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CalendarEvent } from '../types';
import { isDemoMode } from './demoData';

const eventsCol = (uid: string) => collection(db, 'users', uid, 'calendarEvents');
const eventDoc = (uid: string, id: string) => doc(db, 'users', uid, 'calendarEvents', id);

// Legacy-plats från tidigare version: users/{uid}/calendar/own/events
const legacyCol = (uid: string) => collection(db, 'users', uid, 'calendar', 'own', 'events');
const legacyDoc = (uid: string, id: string) => doc(db, 'users', uid, 'calendar', 'own', 'events', id);

export async function loadCalendarEvents(uid: string): Promise<CalendarEvent[]> {
  if (isDemoMode()) return [];
  const snap = await getDocs(eventsCol(uid));
  return snap.docs.map(d => d.data() as CalendarEvent);
}

// Läs gamla "egna events" så inget försvinner vid migrering till nya kollektionen.
export async function loadLegacyOwnEvents(uid: string): Promise<CalendarEvent[]> {
  if (isDemoMode()) return [];
  try {
    const snap = await getDocs(legacyCol(uid));
    return snap.docs.map(d => d.data() as CalendarEvent);
  } catch {
    return [];
  }
}

export async function saveCalendarEvent(uid: string, e: CalendarEvent): Promise<void> {
  if (isDemoMode()) return;
  const clean = JSON.parse(JSON.stringify(e)); // rensa undefined-fält
  await setDoc(eventDoc(uid, e.id), clean);
}

export async function saveCalendarEventsBatch(uid: string, events: CalendarEvent[]): Promise<void> {
  if (isDemoMode()) return;
  await Promise.all(events.map(e => saveCalendarEvent(uid, e)));
}

export async function deleteCalendarEvent(uid: string, id: string): Promise<void> {
  if (isDemoMode()) return;
  await deleteDoc(eventDoc(uid, id));
}

// Ta bort en migrerad legacy-kopia (anropas när ett gammalt event sparas om).
export async function deleteLegacyOwnEvent(uid: string, id: string): Promise<void> {
  if (isDemoMode()) return;
  try { await deleteDoc(legacyDoc(uid, id)); } catch { /* ignore */ }
}
