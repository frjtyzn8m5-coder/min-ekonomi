import Dexie, { type Table } from 'dexie';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingWrite {
  id?: number;           // auto-increment
  collection: string;    // Firestore collection path, e.g. "users/uid/fitness/bodyLog"
  docId: string;         // Firestore document ID
  data: object;          // payload to write
  status: 'pending' | 'synced' | 'failed';
  timestamp: number;     // unix ms
  retries: number;
}

export interface WeightEntry {
  date: string;          // YYYY-MM-DD (primary key)
  weight?: number;       // kg
  measurements?: {
    waist?: number;
    hips?: number;
    chest?: number;
    armLeft?: number;
    armRight?: number;
    thighLeft?: number;
    thighRight?: number;
    neck?: number;
    calf?: number;
  };
  bodyFatPercent?: number;
  leanMass?: number;
  notes?: string;
  photoUrl?: string;
}

export interface FoodEntry {
  id: string;            // uuid
  date: string;          // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodId: string;
  foodName: string;
  amount: number;        // gram
  nutrition: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber?: number;
  };
  source: 'livsmedelsverket' | 'openfoodfacts' | 'custom';
  timestamp: number;
}

export interface WorkoutSession {
  id: string;            // uuid
  date: string;          // YYYY-MM-DD
  name: string;
  startTime: number;
  endTime?: number;
  sets: WorkoutSet[];
  notes?: string;
  sessionRPE?: number;
  mood?: number;
  synced: boolean;
}

export interface WorkoutSet {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;
  setType: 'warmup' | 'working' | 'dropset' | 'failure';
  estimated1RM?: number;
}

// ─── Database ─────────────────────────────────────────────────────────────────

class VardagshubDB extends Dexie {
  pendingWrites!: Table<PendingWrite>;
  weightLog!: Table<WeightEntry>;
  foodLog!: Table<FoodEntry>;
  workoutLog!: Table<WorkoutSession>;

  constructor() {
    super('vardagshub');

    this.version(1).stores({
      pendingWrites: '++id, collection, docId, status, timestamp',
      weightLog:     'date',
      foodLog:       'id, date, mealType, timestamp',
      workoutLog:    'id, date, synced',
    });
  }
}

export const localDb = new VardagshubDB();
