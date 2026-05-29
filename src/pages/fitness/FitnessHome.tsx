import { Scale, UtensilsCrossed, Dumbbell, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

const COMING_SOON = [
  {
    icon: Scale,
    label: 'Vikt & Kropp',
    description: 'Logga vikt, kroppsmått och kroppsfett. Trendgrafik och prognos.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    icon: UtensilsCrossed,
    label: 'Mat & Kalorier',
    description: 'Matdagbok med barcode-scanning. Makron, mikronäringsämnen och adaptiv TDEE.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    icon: Dumbbell,
    label: 'Träning',
    description: 'Träningslogg, övningsdatabas med muskelkarta och styrkeprogressionsgrafer.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: BookOpen,
    label: 'Recept & Pantry',
    description: 'Importera recept från ICA. Kalori- och kostnadsberäkning. Veckoplanering.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
];

export default function FitnessHome() {
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
        <p className="text-sm text-gray-400">
          Din personliga tränings- och näringshub – under uppbyggnad.
        </p>
      </motion.div>

      <div className="space-y-3">
        {COMING_SOON.map(({ icon: Icon, label, description, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.06 }}
            className="bg-white rounded-2xl border border-gray-100 p-5"
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900 text-sm">{label}</span>
                  <span className="text-[10px] font-medium bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                    Kommer snart
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
