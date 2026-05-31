import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ChevronLeft, ExternalLink, Filter, Dumbbell,
  ChevronDown, ChevronUp, Plus
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Exercise } from '../../types';
import exercisesRaw from '../../../data/exercises.json';

const exercises = exercisesRaw as Exercise[];

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = ['Alla', 'Ben', 'Bröst', 'Rygg', 'Axlar', 'Biceps', 'Triceps', 'Core', 'Helkropp', 'Kondition'];
const EQUIPMENT  = ['Alla', 'Skivstång', 'Hantel', 'Kabel', 'Maskin', 'Kroppsvikt', 'Smith', 'Övrigt'];
const LEVELS     = ['Alla', 'beginner', 'intermediate', 'advanced'];
const LEVEL_LABELS: Record<string, string> = { beginner: 'Nybörjare', intermediate: 'Mellannivå', advanced: 'Avancerad' };
const MECHANIC_LABELS: Record<string, string> = { compound: 'Flerledsövning', isolation: 'Isolationsövning', cardio: 'Kondition' };

// ── ExerciseDetail ─────────────────────────────────────────────────────────────

interface ExerciseDetailProps {
  exercise: Exercise;
  onBack: () => void;
  onAddToSession?: (exercise: Exercise) => void;
  addLabel?: string;
}

function ExerciseDetail({ exercise, onBack, onAddToSession, addLabel = 'Lägg till i pass' }: ExerciseDetailProps) {
  const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.youtubeSearch)}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">{exercise.name}</h2>
          {exercise.nameEn && <p className="text-xs text-gray-400 truncate">{exercise.nameEn}</p>}
        </div>
        {onAddToSession && (
          <button
            onClick={() => onAddToSession(exercise)}
            className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Plus size={14} />
            {addLabel}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
            {exercise.category}
          </span>
          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full">
            {exercise.equipment}
          </span>
          <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full">
            {LEVEL_LABELS[exercise.level] ?? exercise.level}
          </span>
          <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
            {MECHANIC_LABELS[exercise.mechanic] ?? exercise.mechanic}
          </span>
        </div>

        {/* Muscles */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Muskler</h3>
          <div>
            <p className="text-xs text-gray-400 mb-1">Primära</p>
            <div className="flex flex-wrap gap-1.5">
              {exercise.muscles.map(m => (
                <span key={m} className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full">{m}</span>
              ))}
            </div>
          </div>
          {exercise.musclesSecondary && exercise.musclesSecondary.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Sekundära</p>
              <div className="flex flex-wrap gap-1.5">
                {exercise.musclesSecondary.map(m => (
                  <span key={m} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Video */}
        <a
          href={ytUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl p-4 hover:bg-red-100 transition-colors group"
        >
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-700">Se video på YouTube</p>
            <p className="text-xs text-red-400 truncate">{exercise.youtubeSearch}</p>
          </div>
          <ExternalLink size={14} className="text-red-400 flex-shrink-0 group-hover:text-red-600 transition-colors" />
        </a>

        {/* Instructions */}
        {exercise.instructions && exercise.instructions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Utförande</h3>
            <ol className="space-y-2">
              {exercise.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-600">
                  <span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── ExerciseCard ───────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, onClick }: { exercise: Exercise; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-100 p-3.5 text-left hover:border-gray-200 hover:shadow-sm active:scale-[0.99] transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{exercise.name}</p>
          {exercise.nameEn && <p className="text-xs text-gray-400 truncate">{exercise.nameEn}</p>}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {exercise.muscles.slice(0, 2).map(m => (
              <span key={m} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">{m}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{exercise.equipment}</span>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{exercise.category}</span>
        </div>
      </div>
    </button>
  );
}

// ── FilterPanel ────────────────────────────────────────────────────────────────

interface Filters { category: string; equipment: string; level: string }

function FilterPanel({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const activeCount = [filters.category, filters.equipment, filters.level].filter(v => v !== 'Alla').length;

  return (
    <div className="border border-gray-100 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm"
      >
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-gray-700 font-medium">Filter</span>
          {activeCount > 0 && (
            <span className="bg-emerald-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-3.5 py-3 space-y-3">
          {/* Category */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Muskelgrupp</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => onChange({ ...filters, category: c })}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    filters.category === c
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Utrustning</p>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT.map(e => (
                <button
                  key={e}
                  onClick={() => onChange({ ...filters, equipment: e })}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    filters.equipment === e
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Level */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Nivå</p>
            <div className="flex flex-wrap gap-1.5">
              {LEVELS.map(l => (
                <button
                  key={l}
                  onClick={() => onChange({ ...filters, level: l })}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    filters.level === l
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {l === 'Alla' ? 'Alla' : LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          {activeCount > 0 && (
            <button
              onClick={() => onChange({ category: 'Alla', equipment: 'Alla', level: 'Alla' })}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Återställ filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ExerciseDB ────────────────────────────────────────────────────────────

interface ExerciseDBProps {
  /** If provided, exercises can be added to a session */
  onAddToSession?: (exercise: Exercise) => void;
  /** Back button destination — defaults to setFitnessPage('home') */
  onBack?: () => void;
  /** Label for the add button */
  addLabel?: string;
  /** Show back-to-home button (true when opened as standalone page) */
  standalone?: boolean;
}

export default function ExerciseDB({ onAddToSession, onBack, addLabel, standalone = true }: ExerciseDBProps) {
  const { setFitnessPage } = useStore();
  const [search, setSearch]       = useState('');
  const [filters, setFilters]     = useState<Filters>({ category: 'Alla', equipment: 'Alla', level: 'Alla' });
  const [selected, setSelected]   = useState<Exercise | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return exercises.filter(ex => {
      if (q && !ex.name.toLowerCase().includes(q) && !(ex.nameEn?.toLowerCase().includes(q))) return false;
      if (filters.category !== 'Alla' && ex.category !== filters.category) return false;
      if (filters.equipment !== 'Alla' && ex.equipment !== filters.equipment) return false;
      if (filters.level    !== 'Alla' && ex.level    !== filters.level)    return false;
      return true;
    });
  }, [search, filters]);

  const handleBack = onBack ?? (() => setFitnessPage('home'));

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {selected ? (
          <ExerciseDetail
            key="detail"
            exercise={selected}
            onBack={() => setSelected(null)}
            onAddToSession={onAddToSession ? (ex) => { onAddToSession(ex); setSelected(null); } : undefined}
            addLabel={addLabel}
          />
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
              {standalone && (
                <button
                  onClick={handleBack}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft size={18} className="text-gray-600" />
                </button>
              )}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Dumbbell size={14} className="text-emerald-600" />
                </div>
                <h1 className="font-semibold text-gray-900 text-sm">Övningsdatabas</h1>
              </div>
              <span className="text-xs text-gray-400">{exercises.length} övningar</span>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Sök övning..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filters */}
              <FilterPanel filters={filters} onChange={setFilters} />

              {/* Results count */}
              <p className="text-xs text-gray-400">
                {filtered.length} {filtered.length === 1 ? 'övning' : 'övningar'} hittades
              </p>

              {/* Exercise list */}
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Dumbbell size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Inga övningar hittades</p>
                  </div>
                ) : (
                  filtered.map(ex => (
                    <ExerciseCard key={ex.id} exercise={ex} onClick={() => setSelected(ex)} />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
