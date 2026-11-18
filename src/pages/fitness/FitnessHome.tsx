import { Scale, UtensilsCrossed, Dumbbell, BookOpen, CalendarDays, ChevronRight, ShoppingBasket, ClipboardList, ListVideo, TrendingUp, Moon, Target, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { IDumbbell } from '../../components/ui/Icons';
import type { FitnessPage } from '../../types';

// Accent tints for module icon tiles (soft clay backgrounds + colored stroke glyphs)
type Accent = 'gold' | 'cyan' | 'violet' | 'coral' | 'lime';
const TINT: Record<Accent, { bg: string; color: string }> = {
  gold:   { bg: 'rgba(233,193,120,.14)', color: 'var(--gold)' },
  cyan:   { bg: 'rgba(95,224,208,.14)',  color: 'var(--cyan)' },
  violet: { bg: 'rgba(155,140,255,.14)', color: 'var(--violet)' },
  coral:  { bg: 'rgba(255,143,122,.14)', color: 'var(--coral)' },
  lime:   { bg: 'rgba(191,226,106,.14)', color: 'var(--lime)' },
};

const MODULES: {
  icon: React.ElementType;
  label: string;
  description: string;
  accent: Accent;
  page: FitnessPage;
  ready: boolean;
}[] = [
  {
    icon: Scale,
    label: 'Vikt & Kropp',
    description: 'Logga vikt, kroppsmatt och kroppsfett. Trendgrafik och prognos.',
    accent: 'cyan',
    page: 'weightlog',
    ready: true,
  },
  {
    icon: UtensilsCrossed,
    label: 'Mat & Kalorier',
    description: 'Matdagbok med barcode-scanning. Makron, mikronäringsämnen och adaptiv TDEE.',
    accent: 'coral',
    page: 'foodlog',
    ready: true,
  },
  {
    icon: Dumbbell,
    label: 'Träningslogg',
    description: 'Logga pass med övningar, vikt, reps och RPE. Vila-timer och sessionshistorik.',
    accent: 'gold',
    page: 'workoutlog',
    ready: true,
  },
  {
    icon: ListVideo,
    label: 'Övningsdatabas',
    description: 'Sök bland hundratals övningar med muskelgrupp, utrustning och videolänk.',
    accent: 'cyan',
    page: 'exercises',
    ready: true,
  },
  {
    icon: BookOpen,
    label: 'Recept',
    description: 'Importera recept från ICA. Kalori- och kostnadsberäkning med Livsmedelsverkets databas.',
    accent: 'violet',
    page: 'recipes',
    ready: true,
  },
  {
    icon: ShoppingBasket,
    label: 'Skafferi',
    description: 'Registrera varor via kvitto, streckkod eller manuellt. Lagerstatus, utgångsdatum och priser.',
    accent: 'lime',
    page: 'pantry',
    ready: true,
  },
  {
    icon: CalendarDays,
    label: 'Veckoplanering',
    description: 'Generera en anpassad veckoplan. Byt ut måltider, spara favoritfrukost och exportera inköpslista.',
    accent: 'coral',
    page: 'mealplan',
    ready: true,
  },
  {
    icon: ClipboardList,
    label: 'Träningsprogram',
    description: 'Personligt program baserat på dina mål och erfarenhet. PPL, Upper/Lower eller Helkropp.',
    accent: 'violet',
    page: 'program',
    ready: true,
  },
  {
    icon: TrendingUp,
    label: 'Utveckling',
    description: 'Grafer och statistik över styrka, vikt och näring över tid.',
    accent: 'lime',
    page: 'development',
    ready: false,
  },
  {
    icon: Target,
    label: 'Målcentrum',
    description: 'Sätt mål för vikt, kroppsfett och styrka. Följ upp din progress.',
    accent: 'gold',
    page: 'goalcenter',
    ready: false,
  },
  {
    icon: Moon,
    label: 'Cykelspårning',
    description: 'Optimera träning och kost baserat på din menscykel.',
    accent: 'violet',
    page: 'cyclehub',
    ready: false,
  },
];

export default function FitnessHome() {
  const { setFitnessPage, userProfile } = useStore();
  const onboardingDone = userProfile?.onboardingCompletedModules?.includes('fitness');

  return (
    <div className="min-h-full bg-bg text-ink p-6 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <span className="vh-tile vh-tile--gold w-9 h-9"><IDumbbell size={18} /></span>
          <h1 className="font-display text-2xl text-ink">Fitness</h1>
        </div>
        <p className="text-sm text-mut">Din personliga tränings- och näringshub.</p>
      </motion.div>

      {/* Onboarding-banner (visas om profil ej satt upp) */}
      {!onboardingDone && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="vh-card p-5 mb-5"
          style={{ background: 'linear-gradient(150deg,#1b160c,#241a0b)', border: '1px solid rgba(233,193,120,.25)' }}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(233,193,120,.15)' }}>
              <Zap size={16} className="text-gold" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1 text-[#f6ead2]">Starta din träningsprofil</p>
              <p className="text-xs mb-3" style={{ color: '#cdbfa3' }}>Det tar ungefär 3 minuter. Du får personliga vikter, anpassad progression och PR-spårning.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFitnessPage('onboarding')}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#2a1d08] transition-colors"
                  style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
                >
                  Starta träningsprofil
                </button>
                <button
                  onClick={() => {/* bara stäng bannern – användaren loggar fritt */}}
                  className="px-3 py-2 rounded-xl border border-[rgba(233,193,120,.3)] text-gold text-xs hover:bg-white/5 transition-colors"
                >
                  Börja utan profil
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {MODULES.map(({ icon: Icon, label, description, accent, page, ready }, i) => {
          const tint = TINT[accent];
          return (
          <motion.button
            key={label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.06 }}
            onClick={() => ready && setFitnessPage(page)}
            className={`vh-card w-full p-5 text-left transition-all ${
              ready
                ? 'active:scale-[0.99] cursor-pointer'
                : 'opacity-60 cursor-default'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: tint.bg }}>
                <Icon size={18} style={{ color: tint.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-ink text-sm">{label}</span>
                  {!ready && (
                    <span className="text-[10px] font-medium bg-soft text-faint px-2 py-0.5 rounded-full">
                      Kommer snart
                    </span>
                  )}
                </div>
                <p className="text-xs text-mut leading-relaxed">{description}</p>
              </div>
              {ready && <ChevronRight size={16} className="text-faint flex-shrink-0 mt-1" />}
            </div>
          </motion.button>
          );
        })}
      </div>
    </div>
  );
}
