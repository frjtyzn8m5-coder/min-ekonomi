import type { Exercise, ExerciseCategory, ExerciseEquipment, AnatomicalMuscle } from '../types';
import exercisesData from '../../data/exercises.json';

export const EXERCISES: Exercise[] = exercisesData as Exercise[];

// ── Search ────────────────────────────────────────────────────────────────────

export function searchExercises(query: string): Exercise[] {
  if (!query.trim()) return EXERCISES;
  const q = query.toLowerCase().trim();
  return EXERCISES.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      (e.nameSv && e.nameSv.toLowerCase().includes(q))
  );
}

// ── Filter ────────────────────────────────────────────────────────────────────

export function filterByCategory(category: ExerciseCategory | 'all'): Exercise[] {
  if (category === 'all') return EXERCISES;
  return EXERCISES.filter((e) => e.category === category);
}

export function filterByMuscle(muscle: AnatomicalMuscle): Exercise[] {
  return EXERCISES.filter(
    (e) =>
      e.primaryMuscles.includes(muscle) ||
      e.secondaryMuscles.includes(muscle) ||
      e.stabilizers.includes(muscle)
  );
}

export function filterByEquipment(equipment: ExerciseEquipment[]): Exercise[] {
  if (!equipment.length) return EXERCISES;
  return EXERCISES.filter((e) =>
    e.equipment.some((eq) => equipment.includes(eq))
  );
}

// ── Combined filter + search ───────────────────────────────────────────────────

export interface ExerciseFilters {
  query?: string;
  category?: ExerciseCategory | 'all';
  equipment?: ExerciseEquipment[];
  muscle?: AnatomicalMuscle;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  type?: 'strength' | 'cardio' | 'stretch' | 'plyometric';
}

export function filterExercises(filters: ExerciseFilters): Exercise[] {
  let result = EXERCISES;

  if (filters.query && filters.query.trim()) {
    const q = filters.query.toLowerCase().trim();
    result = result.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.nameSv && e.nameSv.toLowerCase().includes(q))
    );
  }

  if (filters.category && filters.category !== 'all') {
    result = result.filter((e) => e.category === filters.category);
  }

  if (filters.equipment && filters.equipment.length > 0) {
    result = result.filter((e) =>
      e.equipment.some((eq) => filters.equipment!.includes(eq))
    );
  }

  if (filters.muscle) {
    result = result.filter(
      (e) =>
        e.primaryMuscles.includes(filters.muscle!) ||
        e.secondaryMuscles.includes(filters.muscle!) ||
        e.stabilizers.includes(filters.muscle!)
    );
  }

  if (filters.difficulty) {
    result = result.filter((e) => e.difficulty === filters.difficulty);
  }

  if (filters.type) {
    result = result.filter((e) => e.type === filters.type);
  }

  return result;
}

// ── Lookup ────────────────────────────────────────────────────────────────────

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function getExercisesByIds(ids: string[]): Exercise[] {
  return ids.map((id) => EXERCISES.find((e) => e.id === id)).filter(Boolean) as Exercise[];
}

// ── Category labels (Swedish) ─────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<ExerciseCategory | 'all', string> = {
  all: 'Alla',
  chest: 'Bröst',
  back: 'Rygg',
  legs: 'Ben',
  shoulders: 'Axlar',
  arms: 'Armar',
  core: 'Mage',
  cardio: 'Cardio',
  full_body: 'Helkropp',
};

export const EQUIPMENT_LABELS: Record<ExerciseEquipment, string> = {
  barbell: 'Skivstång',
  dumbbell: 'Hantel',
  cable: 'Kabel',
  machine: 'Maskin',
  bodyweight: 'Kroppsvikt',
  bench: 'Bänk',
  rack: 'Rack',
  kettlebell: 'Kettlebell',
  resistance_band: 'Gummiband',
  other: 'Övrigt',
};

export const MUSCLE_LABELS: Record<AnatomicalMuscle, string> = {
  pectoralis_major: 'Bröstmuskeln',
  pectoralis_minor: 'Lilla bröstmuskeln',
  latissimus_dorsi: 'Latissimus Dorsi',
  rhomboids: 'Romboiderna',
  trapezius: 'Trapezius',
  rear_deltoid: 'Bakre Deltoideus',
  anterior_deltoid: 'Främre Deltoideus',
  medial_deltoid: 'Mediala Deltoideus',
  biceps_brachii: 'Biceps',
  brachialis: 'Brachialis',
  brachioradialis: 'Brachioradialis',
  triceps_brachii: 'Triceps',
  quadriceps: 'Quadriceps',
  hamstrings: 'Hamstrings',
  gluteus_maximus: 'Gluteus Maximus',
  gluteus_medius: 'Gluteus Medius',
  gluteus_minimus: 'Gluteus Minimus',
  gastrocnemius: 'Gastrocnemius',
  soleus: 'Soleus',
  rectus_abdominis: 'Rectus Abdominis',
  obliques: 'Obliques',
  transverse_abdominis: 'Transversus Abdominis',
  erector_spinae: 'Erector Spinae',
  multifidus: 'Multifidus',
  forearms: 'Underarmar',
  rotator_cuff: 'Rotatorkuffen',
  serratus_anterior: 'Serratus Anterior',
  core: 'Core',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Nybörjare',
  intermediate: 'Medel',
  advanced: 'Avancerad',
};
