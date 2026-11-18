import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import type { ActiveModule, UserProfile } from '../types';
import { IWallet, IDumbbell, IUtensils, ICalendar } from '../components/ui/Icons';

type IconC = (p: { size?: number; className?: string }) => React.ReactElement;

interface ModuleCard {
  id: ActiveModule;
  Icon: IconC;
  tile: string;
  label: string;
  description: string;
}

const MODULES: ModuleCard[] = [
  { id: 'economy',   Icon: IWallet,   tile: 'gold',   label: 'Ekonomi', description: 'Budget, portfölj, transaktioner' },
  { id: 'fitness',   Icon: IDumbbell, tile: 'violet', label: 'Träning', description: 'Program, logg, styrkeprogression' },
  { id: 'nutrition', Icon: IUtensils, tile: 'lime',   label: 'Kost',    description: 'Kalorier, recept, måltidsplan' },
  { id: 'calendar',  Icon: ICalendar, tile: 'cyan',   label: 'Kalender', description: 'Events, schema, Google / Outlook' },
];

export default function ModuleSelector() {
  const { setUserProfile, updateUserProfile, userProfile, setModule } = useStore();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<Set<ActiveModule>>(new Set(['economy', 'fitness']));
  const [saving, setSaving] = useState(false);

  function toggle(id: ActiveModule) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(MODULES.map(m => m.id)));
  }

  async function buildAndSaveProfile(modules: ActiveModule[]) {
    if (!user) return;
    const now = Date.now();
    const base: UserProfile = userProfile ?? {
      uid: user.uid,
      displayName: user.displayName ?? undefined,
      email: user.email ?? undefined,
      activeModules: modules,
      onboardingCompletedModules: [],
      gender: 'prefer_not_to_say',
      activityLevel: 'moderately_active',
      trainingDaysPerWeek: 3,
      primaryGoal: 'general_health',
      experienceLevel: 'beginner',
      availableEquipment: [],
      dietaryPreferences: [],
      cookingTimePreference: 'moderate',
      mealVariationPreference: 'medium',
      batchCookingEnabled: false,
      breakfastPreference: 'full_variation',
      sleepTargetHours: 8,
      stepsTargetDaily: 8000,
      createdAt: now,
      updatedAt: now,
      appVersion: '1.0.0',
    };

    const updated = { ...base, activeModules: modules, updatedAt: now };
    setUserProfile(updated);
    await updateUserProfile({ activeModules: modules });
  }

  async function handleContinue() {
    if (selected.size === 0) return;
    setSaving(true);
    const modules = [...selected];
    await buildAndSaveProfile(modules);
    setSaving(false);
    if (modules.includes('fitness')) {
      useStore.getState().setModule('fitness');
      useStore.getState().setFitnessPage('onboarding');
    } else if (modules.includes('nutrition')) {
      useStore.getState().setModule('fitness');
      useStore.getState().setFitnessPage('onboarding');
    } else {
      setModule('economy');
    }
  }

  async function handleSkip() {
    setSaving(true);
    await buildAndSaveProfile(['economy']);
    setSaving(false);
    setModule('economy');
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        {/* Rubrik */}
        <div className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold mb-3">Välkommen</p>
          <h1 className="font-display text-3xl mb-2 leading-tight">Vad vill du <span className="italic text-gold">bygga?</span></h1>
          <p className="text-sm text-mut">Välj det du vill använda appen till.<br />Du kan alltid lägga till mer senare.</p>
        </div>

        {/* Modul-kort */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {MODULES.map(({ id, Icon, tile, label, description }) => {
            const on = selected.has(id);
            return (
              <motion.button
                key={id}
                whileTap={{ scale: 0.97 }}
                onClick={() => toggle(id)}
                className="vh-card relative p-5 text-left"
                style={on ? { borderColor: 'rgba(233,193,120,.5)', boxShadow: '0 0 0 1px rgba(233,193,120,.35), var(--shadow-s)' } : undefined}
              >
                <span className={`vh-tile vh-tile--${tile} w-11 h-11 mb-3`}><Icon size={22} /></span>
                <p className={`font-semibold text-sm mb-1 ${on ? 'text-gold' : 'text-ink'}`}>{label}</p>
                <p className="text-xs text-faint leading-snug">{description}</p>

                <div
                  className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                  style={on ? { background: 'var(--gold)' } : { border: '2px solid rgba(244,241,234,.2)' }}
                >
                  {on && <Check size={11} className="text-[#2a1d08]" strokeWidth={3} />}
                </div>
              </motion.button>
            );
          })}
        </div>

        <button onClick={selectAll} className="text-sm text-gold font-medium hover:underline mb-5 block">
          Välj alla
        </button>

        <button
          onClick={handleContinue}
          disabled={selected.size === 0 || saving}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm text-[#2a1d08] disabled:opacity-40 transition-transform active:scale-[0.99] mb-3"
          style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)', boxShadow: '0 14px 30px -14px rgba(233,193,120,.6)' }}
        >
          {saving ? 'Sparar…' : 'Fortsätt →'}
        </button>

        <button
          onClick={handleSkip}
          disabled={saving}
          className="w-full text-sm text-faint hover:text-mut py-2 transition-colors"
        >
          Hoppa över – börja direkt
        </button>
      </motion.div>
    </div>
  );
}
