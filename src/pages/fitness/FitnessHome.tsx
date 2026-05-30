import { Scale, UtensilsCrossed, Dumbbell, BookOpen, CalendarDays, ChevronRight, ShoppingBasket, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import type { FitnessPage } from '../../types';

const MODULES: {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  bg: string;
  page: FitnessPage;
  ready: boolean;
}[] = [
  {
    icon: Scale,
    label: 'Vikt & Kropp',
    description: 'Logga vikt, kroppsmatt och kroppsfett. Trendgrafik och prognos.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    page: 'weightlog',
    ready: true,
  },
  {
    icon: UtensilsCrossed,
    label: 'Mat & Kalorier',
    description: 'Matdagbok med barcode-scanning. Makron, mikronäringsämnen och adaptiv TDEE.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    page: 'foodlog',
    ready: true,
  },
  {
    icon: Dumbbell,
    label: 'Träning',
    description: 'Träningslogg, övningsdatabas med muskelkarta och styrkeprogressionsgrafer.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    page: 'workoutlog',
    ready: false,
  },
  {
    icon: BookOpen,
    label: 'Recept',
    description: 'Importera recept från ICA. Kalori- och kostnadsberäkning med Livsmedelsverkets databas.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    page: 'recipes',
    ready: true,
  },
  {
    icon: ShoppingBasket,
    label: 'Skafferi',
    description: 'Registrera varor via kvitto, streckkod eller manuellt. Lagerstatus, utgångsdatum och priser.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    page: 'pantry',
    ready: true,
  },
  {
    icon: CalendarDays,
    label: 'Veckoplanering',
    description: 'Generera en anpassad veckoplan. Byt ut måltider, spara favoritfrukost och exportera inköpslista.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
    page: 'mealplan',
    ready: true,
  },
  {
    icon: ClipboardList,
    label: 'Träningsprogram',
    description: 'Personligt program baserat på dina mål och erfarenhet. PPL, Upper/Lower eller Helkropp.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    page: 'program',
    ready: true,
  },
];

export default function FitnessHome() {
  const { setFitnessPage } = useStore();

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Dumbbell size={18} className="text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Fitness</h1>
        </div>
        <p className="text-sm text-gray-400">Din personliga tränings- och näringshub.</p>
      </motion.div>

      <div className="space-y-3">
        {MODULES.map(({ icon: Icon, label, description, color, bg, page, ready }, i) => (
          <motion.button
            key={label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.06 }}
            onClick={() => ready && setFitnessPage(page)}
            className={`w-full bg-white rounded-2xl border border-gray-100 p-5 text-left transition-all ${
              ready
                ? 'hover:border-gray-200 hover:shadow-sm active:scale-[0.99] cursor-pointer'
                : 'opacity-70 cursor-default'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon size={18} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900 text-sm">{label}</span>
                  {!ready && (
                    <span className="text-[10px] font-medium bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                      Kommer snart
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
              </div>
              {ready && <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
