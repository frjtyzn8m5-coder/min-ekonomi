import {
  collection, doc, setDoc, getDocs, query, orderBy, limit, where
} from 'firebase/firestore';
import { db } from './firebase';
import type { BodyEntry, WorkoutSession, WorkoutProgram } from '../types';

const bodyLogCol = (uid: string) => collection(db, 'users', uid, 'bodyLog');
const bodyLogDoc = (uid: string, date: string) => doc(db, 'users', uid, 'bodyLog', date);

// ── Body log ──────────────────────────────────────────────────────────────────

export async function saveBodyEntry(uid: string, entry: BodyEntry): Promise<void> {
  await setDoc(bodyLogDoc(uid, entry.date), entry, { merge: true });
}

export async function loadBodyLog(uid: string, limitDays = 365): Promise<BodyEntry[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - limitDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const q = query(
    bodyLogCol(uid),
    where('date', '>=', cutoffStr),
    orderBy('date', 'asc'),
    limit(500),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as BodyEntry);
}

export async function loadAllBodyLog(uid: string): Promise<BodyEntry[]> {
  const q = query(bodyLogCol(uid), orderBy('date', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as BodyEntry);
}

// ── Fitness settings ──────────────────────────────────────────────────────────

export async function saveFitnessSettings(uid: string, settings: object): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'settings', 'fitness'), settings, { merge: true });
}

// ── Workout program ─────────────────────────────────────────────────────────
// Samma dokument som WorkoutProgram-sidan läser/skriver:
//   users/{uid}/fitness/workoutProgram
const workoutProgramDoc = (uid: string) => doc(db, 'users', uid, 'fitness', 'workoutProgram');

export async function saveWorkoutProgram(uid: string, program: WorkoutProgram): Promise<void> {
  // Rensa undefined-fält (t.ex. valfria övnings-anteckningar) innan skrivning.
  const clean = JSON.parse(JSON.stringify(program));
  await setDoc(workoutProgramDoc(uid), clean);
}

// ── Workout sessions ──────────────────────────────────────────────────────────

const workoutCol = (uid: string) => collection(db, 'users', uid, 'workoutSessions');
const workoutDoc = (uid: string, id: string) => doc(db, 'users', uid, 'workoutSessions', id);

export async function saveWorkoutSession(uid: string, session: WorkoutSession): Promise<void> {
  const clean = JSON.parse(JSON.stringify(session));
  await setDoc(workoutDoc(uid, session.id), clean);
}

export async function loadWorkoutSessions(uid: string, limitCount = 100): Promise<WorkoutSession[]> {
  const q = query(workoutCol(uid), orderBy('startTime', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as WorkoutSession);
}
