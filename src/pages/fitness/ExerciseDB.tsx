import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ChevronLeft, ExternalLink, Star, Dumbbell, Filter,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import {
  EXERCISES, filterExercises, CATEGORY_LABELS, EQUIPMENT_LABELS,
  MUSCLE_LABELS, DIFFICULTY_LABELS,
} from '../../utils/exerciseUtils';
import type { Exercise, ExerciseCategory, ExerciseEquipment } from '../../types';
import MuscleMap from '../../components/fitness/MuscleMap';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: Array<ExerciseCategory | 'all'> = [
  'all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body',
];

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: 'text-emerald-600 bg-emerald-50',
  intermediate: 'text-amber-600 bg-amber-50',
  advanced: 'text-red-600 bg-red-50',
};

// ── Exercise Card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  isFav,
  onSelect,
  onToggleFav,
}: {
  exercise: Exercise;
  isFav: boolean;
  onSelect: (e: Exercise) => void;
  onToggleFav: (id: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      onClick={() => onSelect(exercise)}
      className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:border-gray-200 hover:shadow-sm transition-all active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
          <Dumbbell size={16} className="text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="font-semibold text-sm text-gray-900 leading-tight">
                {exercise.nameSv || exercise.name}
              </p>
              {exercise.nameSv && (
                <p className="text-[11px] text-gray-400">{exercise.name}</p>
              )}
            </div>
            <button
              onClick={(ev) => { ev.stopPropagation(); onToggleFav(exercise.id); }}
              className="flex-shrink-0 p-1"
            >
              <Star
                size={14}
                className={isFav ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
              />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {CATEGORY_LABELS[exercise.category]}
            </span>
            {exercise.equipment.slice(0, 2).map((eq) => (
              <span key={eq} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                {EQUIPMENT_LABELS[eq]}
              </span>
            ))}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLOR[exercise.difficulty]}`}>
              {DIFFICULTY_LABELS[exercise.difficulty]}
            </span>
            {exercise.isCompound && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                Flerled
              </span>
            )}
          </div>
          {exercise.primaryMuscles.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-1.5">
              Primär: {exercise.primaryMuscles.map(m => MUSCLE_LABELS[m] || m).slice(0, 2).join(', ')}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  exercise,
  isFav,
  onClose,
  onToggleFav,
}: {
  exercise: Exercise;
  isFav: boolean;
  onClose: () => void;
  onToggleFav: (id: string) => void;
}) {
  const handleYouTube = () => {
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.youtubeSearchQuery)}`,
      '_blank',
    );
  };

  const instructionsSv = exercise.instructionsSv || exercise.instructions;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className="absolute inset-0 bg-gray-50 overflow-auto z-10"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-gray-100 px-5 py-4 flex items-center gap-3 z-10">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <ChevronLeft size={16} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 truncate">
            {exercise.nameSv || exercise.name}
          </p>
          {exercise.nameSv && (
            <p className="text-[11px] text-gray-400 truncate">{exercise.name}</p>
          )}
        </div>
        <button onClick={() => onToggleFav(exercise.id)} className="p-1.5">
          <Star
            size={16}
            className={isFav ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
          />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Muscle Map */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Muskelaktivering</p>
          <MuscleMap mode="exercise" exerciseId={exercise.id} compact />
          <div className="mt-3 space-y-1.5">
            {exercise.primaryMuscles.length > 0 && (
              <div className="flex gap-2 items-start">
                <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">Primär</span>
                <span className="text-xs text-gray-600">
                  {exercise.primaryMuscles.map(m => MUSCLE_LABELS[m] || m).join(', ')}
                </span>
              </div>
            )}
            {exercise.secondaryMuscles.length > 0 && (
              <div className="flex gap-2 items-start">
                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">Sekundär</span>
                <span className="text-xs text-gray-600">
                  {exercise.secondaryMuscles.map(m => MUSCLE_LABELS[m] || m).join(', ')}
                </span>
              </div>
            )}
            {exercise.stabilizers.length > 0 && (
              <div className="flex gap-2 items-start">
                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">Stab.</span>
                <span className="text-xs text-gray-500">
                  {exercise.stabilizers.map(m => MUSCLE_LABELS[m] || m).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-2">
          {exercise.equipment.map(eq => (
            <span key={eq} className="text-xs px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
              {EQUIPMENT_LABELS[eq]}
            </span>
          ))}
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${DIFFICULTY_COLOR[exercise.difficulty]}`}>
            {DIFFICULTY_LABELS[exercise.difficulty]}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
            {exercise.isCompound ? 'Flerledsövning' : 'Isolationsövning'}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
            {exercise.defaultRepRange[0]}–{exercise.defaultRepRange[1]} reps
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">
            Vila {exercise.defaultRestSeconds}s
          </span>
        </div>

        {/* Instructions */}
        {instructionsSv.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">Instruktioner</p>
            <ol className="space-y-2">
              {instructionsSv.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* YouTube */}
        <button
          onClick={handleYouTube}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100 transition-colors"
        >
          <ExternalLink size={15} />
          Se teknikvideo på YouTube
        </button>
      </div>
    </motion.div>
  );
}

// ── Main ExerciseDB ───────────────────────────────────────────────────────────

export default function ExerciseDB() {
  const { setFitnessPage, userProfile, updateUserProfile } = useStore();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | 'all'>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<ExerciseEquipment[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [displayCount, setDisplayCount] = useState(30);

  const favorites: string[] = (userProfile as any)?.favoriteExerciseIds ?? [];

  const toggleFav = useCallback(
    (id: string) => {
      const updated = favorites.includes(id)
        ? favorites.filter((f) => f !== id)
        : [...favorites, id];
      updateUserProfile({ favoriteExerciseIds: updated } as any);
    },
    [favorites, updateUserProfile],
  );

  const filtered = useMemo(
    () =>
      filterExercises({
        query,
        category: activeCategory,
        equipment: selectedEquipment,
      }),
    [query, activeCategory, selectedEquipment],
  );

  const visible = filtered.slice(0, displayCount);

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => setFitnessPage('home')}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Övningsdatabas</h1>
        </div>
        <p className="text-xs text-gray-400 ml-11 mb-3">
          {EXERCISES.length} övningar · {filtered.length} visas
        </p>

        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Sök övning..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setDisplayCount(30); }}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-gray-50 text-sm placeholder-gray-400 border border-gray-100 focus:outline-none focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X size={14} className="text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter((v) => !v)}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors flex items-center gap-1.5 ${
              showFilter || selectedEquipment.length > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-gray-50 border-gray-100 text-gray-600'
            }`}
          >
            <Filter size={14} />
            Filter
            {selectedEquipment.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">
                {selectedEquipment.length}
              </span>
            )}
          </button>
        </div>

        {/* Equipment filter (expandable) */}
        <AnimatePresence>
          {showFilter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3">
                <p className="text-[11px] font-semibold text-gray-400 mb-2">Utrustning</p>
                <div className="flex flex-wrap gap-2">
                  {(['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell'] as ExerciseEquipment[]).map((eq) => {
                    const active = selectedEquipment.includes(eq);
                    return (
                      <button
                        key={eq}
                        onClick={() =>
                          setSelectedEquipment((prev) =>
                            active ? prev.filter((e) => e !== eq) : [...prev, eq],
                          )
                        }
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        {EQUIPMENT_LABELS[eq]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 mt-3 -mx-4 px-4 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setDisplayCount(30); }}
              className={`flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <AnimatePresence>
          {visible.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              isFav={favorites.includes(ex.id)}
              onSelect={setSelected}
              onToggleFav={toggleFav}
            />
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">Inga övningar hittades</p>
          </div>
        )}

        {filtered.length > displayCount && (
          <button
            onClick={() => setDisplayCount((n) => n + 30)}
            className="w-full py-3 rounded-2xl bg-white border border-gray-100 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Ladda fler... ({filtered.length - displayCount} kvar)
          </button>
        )}
      </div>

      {/* Detail panel (slide-in overlay) */}
      <AnimatePresence>
        {selected && (
          <DetailPanel
            exercise={selected}
            isFav={favorites.includes(selected.id)}
            onClose={() => setSelected(null)}
            onToggleFav={toggleFav}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
