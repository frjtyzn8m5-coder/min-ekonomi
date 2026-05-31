import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Module, ActiveModule } from '../../types';
import { Home, Wallet, Dumbbell, UtensilsCrossed, CalendarDays, LogOut } from 'lucide-react';

const ALL_MODULES: { id: Module; activeModule?: ActiveModule; label: string; Icon: any }[] = [
  { id: 'home',     label: 'Hem',      Icon: Home },
  { id: 'economy',  activeModule: 'economy',   label: 'Ekonomi',  Icon: Wallet },
  { id: 'fitness',  activeModule: 'fitness',   label: 'Fitness',  Icon: Dumbbell },
  { id: 'fitness',  activeModule: 'nutrition', label: 'Kost',     Icon: UtensilsCrossed },
  { id: 'calendar', activeModule: 'calendar',  label: 'Kalender', Icon: CalendarDays },
];

export default function TopNav() {
  const { module, setModule, userProfile } = useStore();
  const { logout } = useAuthStore();

  // Filtrera flikar baserat på activeModules. Om ingen profil finns, visa alla.
  const visibleModules = ALL_MODULES.filter(m => {
    if (!m.activeModule) return true; // 'Hem' alltid synlig
    if (!userProfile || userProfile.activeModules.length === 0) return true;
    return userProfile.activeModules.includes(m.activeModule);
  });

  // Deduplicate: visa inte "Kost" och "Fitness" som separata flikar (de delar module='fitness')
  // Kost visas bara om nutrition är aktivt men inte fitness, annars är det under Fitness
  const deduped = visibleModules.filter((m, idx, arr) =>
    arr.findIndex(x => x.id === m.id && x.label === m.label) === idx
  );

  return (
    <>
      {/* ── Desktop: slim top bar ─────────────────────────────────────────── */}
      <div className="hidden lg:flex h-11 bg-white border-b border-gray-100 items-center px-4 gap-0.5 flex-shrink-0">
        {deduped.map(({ id, label, Icon }) => (
          <button
            key={label}
            onClick={() => setModule(id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              module === id
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => logout()}
            title="Logga ut"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-all"
          >
            <LogOut size={14} />
            Logga ut
          </button>
        </div>
      </div>

      {/* ── Mobile: fixed bottom nav bar ──────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex safe-area-inset-bottom">
        {deduped.map(({ id, label, Icon }) => (
          <button
            key={label}
            onClick={() => setModule(id)}
            className={`flex-1 flex flex-col items-center gap-1 pt-2 pb-3 transition-colors ${
              module === id ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <Icon size={21} strokeWidth={module === id ? 2.2 : 1.8} />
            <span className="text-[10px] font-medium tracking-wide">{label}</span>
          </button>
        ))}
        <button
          onClick={() => logout()}
          className="flex-1 flex flex-col items-center gap-1 pt-2 pb-3 transition-colors text-gray-400"
        >
          <LogOut size={21} strokeWidth={1.8} />
          <span className="text-[10px] font-medium tracking-wide">Logga ut</span>
        </button>
      </div>
    </>
  );
}
