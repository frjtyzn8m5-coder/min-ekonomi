import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import type { ActiveModule, UserProfile } from '../types';

interface ModuleCard {
  id: ActiveModule;
  emoji: string;
  label: string;
  description: string;
}

const MODULES: ModuleCard[] = [
  {
    id: 'economy',
    emoji: '💰',
    label: 'Ekonomi',
    description: 'Budget, portfölj, transaktioner',
  },
  {
    id: 'fitness',
    emoji: '🏋️',
    label: 'Träning',
    description: 'Program, logg, styrkeprogresson',
  },
  {
    id: 'nutrition',
    emoji: '🥗',
    label: 'Kost',
    description: 'Kalorier, recept, måltidsplan',
  },
  {
    id: 'calendar',
    emoji: '📅',
    label: 'Kalender',
    description: 'Events, schema, Google / Outlook',
  },
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
    // Persist to Firestore via updateUserProfile
    await updateUserProfile({ activeModules: modules });
  }

  async function handleContinue() {
    if (selected.size === 0) return;
    setSaving(true);
    const modules = [...selected];
    await buildAndSaveProfile(modules);
    setSaving(false);
    // Routing: om fitness är vald → gå till fitnessOnboarding via module=fitness, page=onboarding
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        {/* Rubrik */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Välkommen till Vardagshub! 👋</h1>
          <p className="text-sm text-gray-500">Vad vill du använda appen till?<br />Du kan alltid lägga till mer senare.</p>
        </div>

        {/* Modul-kort */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {MODULES.map(({ id, emoji, label, description }) => {
            const on = selected.has(id);
            return (
              <motion.button
                key={id}
                whileTap={{ scale: 0.97 }}
                onClick={() => toggle(id)}
                className={`relative rounded-2xl border-2 p-5 text-left transition-all ${
                  on
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-2xl block mb-2">{emoji}</span>
                <p className={`font-semibold text-sm mb-1 ${on ? 'text-blue-700' : 'text-gray-900'}`}>{label}</p>
                <p className="text-xs text-gray-400 leading-snug">{description}</p>

                {/* Checkbox */}
                <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  on ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                }`}>
                  {on && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Välj alla */}
        <button
          onClick={selectAll}
          className="text-sm text-blue-600 font-medium hover:underline mb-5 block"
        >
          Välj alla
        </button>

        {/* Fortsätt */}
        <button
          onClick={handleContinue}
          disabled={selected.size === 0 || saving}
          className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors mb-3"
        >
          {saving ? 'Sparar...' : 'Fortsätt →'}
        </button>

        {/* Hoppa över */}
        <button
          onClick={handleSkip}
          disabled={saving}
          className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
        >
          Hoppa över – börja direkt
        </button>
      </motion.div>
    </div>
  );
}
