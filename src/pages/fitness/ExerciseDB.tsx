import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ChevronLeft, ExternalLink, Star, Filter, Plus,
} from 'lucide-react';
import { IDumbbell } from '../../components/ui/Icons';
import PageBanner from '../../components/ui/PageBanner';
import { useStore } from '../../store/useStore';
import {
  EXERCISES, filterExercises, getExerciseById, CATEGORY_LABELS, EQUIPMENT_LABELS,
  MUSCLE_LABELS, DIFFICULTY_LABELS,
} from '../../utils/exerciseUtils';
import type { Exercise, ExerciseCategory, ExerciseEquipment } from '../../types';
import MuscleMap from '../../components/fitness/MuscleMap';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: Array<ExerciseCategory | 'all'> = [
  'all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body',
];

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: 'text-cyan bg-[rgba(95,224,208,.12)]',
  intermediate: 'text-gold bg-[rgba(233,193,120,.12)]',
  advanced: 'text-coral bg-[rgba(255,143,122,.12)]',
};

// ── Exercise image with graceful fallback ───────────────────────────────────────

function ExerciseImage({
  src,
  alt,
  className,
  rounded = 'rounded-xl',
}: {
  src?: string;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-soft ${rounded} ${className ?? ''}`}>
        <IDumbbell size={28} className="text-faint opacity-40" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-soft ${rounded} ${className ?? ''}`}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-soft" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: '#fff' }}
      />
    </div>
  );
}

// ── Exercise Card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  isFav,
  onSelect,
  onToggleFav,
  addMode,
}: {
  exercise: Exercise;
  isFav: boolean;
  onSelect: (e: Exercise) => void;
  onToggleFav: (id: string) => void;
  addMode?: boolean;
}) {
  const thumb = exercise.imageUrls?.[0];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      onClick={() => onSelect(exercise)}
      className="vh-card group cursor-pointer overflow-hidden transition-all hover:border-[rgba(233,193,120,.35)] active:scale-[0.99] flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative">
        <ExerciseImage
          src={thumb}
          alt={exercise.nameSv || exercise.name}
          rounded=""
          className="w-full aspect-[4/3]"
        />
        {/* Favorite */}
        <button
          onClick={(ev) => { ev.stopPropagation(); onToggleFav(exercise.id); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/45 backdrop-blur flex items-center justify-center"
        >
          <Star size={15} className={isFav ? 'text-gold fill-[#e9c178]' : 'text-white/80'} />
        </button>
        {/* Difficulty badge */}
        <span className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-medium backdrop-blur ${DIFFICULTY_COLOR[exercise.difficulty]}`}>
          {DIFFICULTY_LABELS[exercise.difficulty]}
        </span>
        {addMode && (
          <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-[#2a1d08]"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
            <Plus size={16} />
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex-1 flex flex-col">
        <p className="font-semibold text-sm text-ink leading-tight line-clamp-2">
          {exercise.nameSv || exercise.name}
        </p>
        {exercise.nameSv && exercise.nameSv !== exercise.name && (
          <p className="text-[11px] text-faint truncate mt-0.5">{exercise.name}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-soft text-mut">
            {CATEGORY_LABELS[exercise.category]}
          </span>
          {exercise.equipment.slice(0, 1).map((eq) => (
            <span key={eq} className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(155,140,255,.12)] text-violet">
              {EQUIPMENT_LABELS[eq]}
            </span>
          ))}
          {exercise.isCompound && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(95,224,208,.12)] text-cyan">
              Flerled
            </span>
          )}
        </div>
        {exercise.primaryMuscles.length > 0 && (
          <p className="text-[11px] text-faint mt-auto pt-2">
            {exercise.primaryMuscles.map(m => MUSCLE_LABELS[m] || m).slice(0, 2).join(', ')}
          </p>
        )}
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
  onAddToSession,
  addLabel,
  standalone = true,
}: {
  exercise: Exercise;
  isFav: boolean;
  onClose: () => void;
  onToggleFav: (id: string) => void;
  onAddToSession?: (e: Exercise) => void;
  addLabel?: string;
  standalone?: boolean;
}) {
  const handleYouTube = () => {
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.youtubeSearchQuery)}`,
      '_blank',
    );
  };

  const instructionsSv = exercise.instructionsSv || exercise.instructions;
  const images = exercise.imageUrls ?? [];
  const twoUp = images.length >= 2;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className={`${standalone ? 'fixed' : 'absolute'} inset-0 bg-bg overflow-auto z-50`}
    >
      {/* Header */}
      <div className="sticky top-0 bg-panel/90 backdrop-blur border-b border-line px-5 py-4 flex items-center gap-3 z-10">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-soft flex items-center justify-center flex-shrink-0"
        >
          <ChevronLeft size={16} className="text-mut" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-ink truncate">
            {exercise.nameSv || exercise.name}
          </p>
          {exercise.nameSv && exercise.nameSv !== exercise.name && (
            <p className="text-[11px] text-faint truncate">{exercise.name}</p>
          )}
        </div>
        <button onClick={() => onToggleFav(exercise.id)} className="p-1.5 flex-shrink-0">
          <Star size={16} className={isFav ? 'text-gold fill-[#e9c178]' : 'text-faint'} />
        </button>
      </div>

      <div className="max-w-[1600px] mx-auto p-5 sm:px-6 lg:px-10">
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 items-start">
        <div className="space-y-5">
        {/* Hero photo(s) */}
        <div className={`grid gap-3 ${twoUp ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {(images.length ? images.slice(0, 2) : [undefined]).map((img, i) => (
            <div key={i} className="relative">
              <ExerciseImage
                src={img}
                alt={`${exercise.nameSv || exercise.name} ${i === 0 ? 'start' : 'slut'}`}
                className="w-full aspect-[4/3]"
                rounded="rounded-2xl"
              />
              {twoUp && (
                <span className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/55 text-white/90 backdrop-blur">
                  {i === 0 ? 'Start' : 'Slut'}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Title block */}
        <div>
          <h2 className="font-display text-xl text-ink leading-tight">{exercise.nameSv || exercise.name}</h2>
          {exercise.nameSv && exercise.nameSv !== exercise.name && (
            <p className="text-sm text-faint mt-0.5">{exercise.name}</p>
          )}
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-soft text-mut">
            {CATEGORY_LABELS[exercise.category]}
          </span>
          {exercise.equipment.map(eq => (
            <span key={eq} className="text-xs px-3 py-1 rounded-full bg-[rgba(155,140,255,.12)] text-violet font-medium">
              {EQUIPMENT_LABELS[eq]}
            </span>
          ))}
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${DIFFICULTY_COLOR[exercise.difficulty]}`}>
            {DIFFICULTY_LABELS[exercise.difficulty]}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-soft text-mut">
            {exercise.isCompound ? 'Flerledsövning' : 'Isolationsövning'}
          </span>
          {exercise.defaultRepRange[1] > 0 && (
            <span className="text-xs px-3 py-1 rounded-full bg-soft text-mut tnum">
              {exercise.defaultRepRange[0]}–{exercise.defaultRepRange[1]} reps
            </span>
          )}
          {exercise.defaultRestSeconds > 0 && (
            <span className="text-xs px-3 py-1 rounded-full bg-soft text-mut tnum">
              Vila {exercise.defaultRestSeconds}s
            </span>
          )}
        </div>

        {/* Add to session (embedded mode) */}
        {onAddToSession && (
          <button
            onClick={() => onAddToSession(exercise)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[#2a1d08] font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
          >
            <Plus size={16} />
            {addLabel || 'Lägg till'}
          </button>
        )}

        </div>
        <div className="space-y-5">
        {/* Muscle Map */}
        <div className="vh-card p-4">
          <p className="text-xs font-semibold text-mut mb-3">Muskelaktivering</p>
          <MuscleMap mode="exercise" exerciseId={exercise.id} />
          <div className="mt-4 space-y-1.5">
            {exercise.primaryMuscles.length > 0 && (
              <div className="flex gap-2 items-start">
                <span className="text-[10px] font-medium text-gold bg-[rgba(233,193,120,.12)] px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">Primär</span>
                <span className="text-xs text-mut">
                  {exercise.primaryMuscles.map(m => MUSCLE_LABELS[m] || m).join(', ')}
                </span>
              </div>
            )}
            {exercise.secondaryMuscles.length > 0 && (
              <div className="flex gap-2 items-start">
                <span className="text-[10px] font-medium text-cyan bg-[rgba(95,224,208,.12)] px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">Sekundär</span>
                <span className="text-xs text-mut">
                  {exercise.secondaryMuscles.map(m => MUSCLE_LABELS[m] || m).join(', ')}
                </span>
              </div>
            )}
            {exercise.stabilizers.length > 0 && (
              <div className="flex gap-2 items-start">
                <span className="text-[10px] font-medium text-violet bg-[rgba(155,140,255,.12)] px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">Stab.</span>
                <span className="text-xs text-faint">
                  {exercise.stabilizers.map(m => MUSCLE_LABELS[m] || m).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        {instructionsSv.length > 0 && (
          <div className="vh-card p-4">
            <p className="text-xs font-semibold text-mut mb-3">Instruktioner</p>
            <ol className="space-y-2.5">
              {instructionsSv.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-ink leading-relaxed">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(233,193,120,.15)] text-gold text-[11px] font-bold flex items-center justify-center mt-0.5 tnum">
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
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[rgba(255,143,122,.12)] text-coral font-semibold text-sm hover:bg-[rgba(255,143,122,.18)] transition-colors"
        >
          <ExternalLink size={15} />
          Se teknikvideo på YouTube
        </button>
        </div>
       </div>
      </div>
    </motion.div>
  );
}

// ── Main ExerciseDB ───────────────────────────────────────────────────────────

interface ExerciseDBProps {
  // Embedded mode (used by WorkoutLog)
  standalone?: boolean;
  onBack?: () => void;
  onAddToSession?: (exercise: Exercise) => void;
  addLabel?: string;
}

export default function ExerciseDB({ standalone = true, onBack, onAddToSession, addLabel = 'Lägg till' }: ExerciseDBProps) {
  const { setFitnessPage, userProfile, updateUserProfile, selectedExerciseId, setSelectedExerciseId } = useStore();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | 'all'>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<ExerciseEquipment[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [displayCount, setDisplayCount] = useState(36);

  const favorites: string[] = (userProfile as any)?.favoriteExerciseIds ?? [];

  // Deep-link: open a specific exercise (e.g. from a training program).
  useEffect(() => {
    if (selectedExerciseId) {
      const ex = getExerciseById(selectedExerciseId);
      if (ex) setSelected(ex);
      setSelectedExerciseId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExerciseId]);

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
    <div className={`relative flex flex-col bg-bg text-ink ${standalone ? 'min-h-full' : 'h-full overflow-hidden'}`}>
      {standalone && (
        <PageBanner
          img="/img/f-run3.jpg"
          eyebrow="Bibliotek"
          title="Övningsdatabas"
          subtitle="Hundratals övningar med bilder, muskelkarta, teknik och videor."
          onBack={() => onBack ? onBack() : setFitnessPage('home')}
        />
      )}
      {/* Header */}
      <div className={`bg-panel border-b border-line px-4 sm:px-6 lg:px-10 pt-4 pb-3 ${standalone ? 'sticky top-0 z-20' : 'flex-shrink-0'}`}>
        <div className="max-w-[1600px] mx-auto w-full">
          {!standalone && (
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => onBack ? onBack() : setFitnessPage('home')}
                className="w-8 h-8 rounded-full bg-soft flex items-center justify-center"
              >
                <ChevronLeft size={16} className="text-mut" />
              </button>
              <h1 className="font-display text-lg text-ink">Övningsdatabas</h1>
            </div>
          )}
          <p className={`text-xs text-faint mb-3 tnum ${standalone ? '' : 'ml-11'}`}>
            {EXERCISES.length} övningar · {filtered.length} visas
          </p>

          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                type="text"
                placeholder="Sök övning..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setDisplayCount(36); }}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-soft text-ink text-sm placeholder-faint border border-line focus:outline-none focus:border-[rgba(233,193,120,.5)] focus:ring-1 focus:ring-[rgba(233,193,120,.3)]"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X size={14} className="text-faint" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilter((v) => !v)}
              className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors flex items-center gap-1.5 ${
                showFilter || selectedEquipment.length > 0
                  ? 'border-[rgba(233,193,120,.3)] text-gold'
                  : 'bg-soft border-line text-mut'
              }`}
              style={showFilter || selectedEquipment.length > 0 ? { background: 'rgba(233,193,120,.12)' } : undefined}
            >
              <Filter size={14} />
              Filter
              {selectedEquipment.length > 0 && (
                <span className="w-4 h-4 rounded-full text-[#2a1d08] text-[9px] flex items-center justify-center font-bold tnum"
                  style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
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
                  <p className="text-[11px] font-semibold text-faint mb-2">Utrustning</p>
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
                              ? 'text-[#2a1d08] border-transparent font-semibold'
                              : 'bg-card text-mut border-line hover:border-[rgba(233,193,120,.4)]'
                          }`}
                          style={active ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
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
                onClick={() => { setActiveCategory(cat); setDisplayCount(36); }}
                className={`flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full font-medium transition-colors ${
                  activeCategory === cat ? 'text-[#2a1d08]' : 'bg-soft text-mut hover:bg-card'
                }`}
                style={activeCategory === cat ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className={`flex-1 p-4 sm:px-6 lg:px-10 ${standalone ? '' : 'overflow-auto'}`}>
        <div className="max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            <AnimatePresence>
              {visible.map((ex) => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  isFav={favorites.includes(ex.id)}
                  onSelect={onAddToSession ? onAddToSession : setSelected}
                  onToggleFav={toggleFav}
                  addMode={!!onAddToSession}
                />
              ))}
            </AnimatePresence>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-faint text-sm">Inga övningar hittades</p>
            </div>
          )}

          {filtered.length > displayCount && (
            <button
              onClick={() => setDisplayCount((n) => n + 36)}
              className="w-full mt-4 py-3 rounded-2xl bg-card border border-line text-sm text-mut hover:bg-soft transition-colors tnum"
            >
              Ladda fler... ({filtered.length - displayCount} kvar)
            </button>
          )}
        </div>
      </div>

      {/* Detail panel (slide-in overlay) */}
      <AnimatePresence>
        {selected && (
          <DetailPanel
            exercise={selected}
            isFav={favorites.includes(selected.id)}
            onClose={() => setSelected(null)}
            onToggleFav={toggleFav}
            onAddToSession={onAddToSession ? (e) => { onAddToSession(e); setSelected(null); } : undefined}
            addLabel={addLabel}
            standalone={standalone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
