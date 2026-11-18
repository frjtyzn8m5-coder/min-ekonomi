import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Module, ActiveModule, FitnessPage } from '../../types';
import { IGrid, IWallet, IDumbbell, IUtensils, ICalendar, ILogout } from '../ui/Icons';

type IconC = (p: { size?: number; className?: string }) => React.ReactElement;

interface Tab {
  key: string;
  label: string;
  Icon: IconC;
  module: Module;
  page?: FitnessPage;        // landing page within the fitness module
  activeModule?: ActiveModule; // for the visibility filter
}

const TABS: Tab[] = [
  { key: 'home',     label: 'Hem',      Icon: IGrid,     module: 'home' },
  { key: 'economy',  label: 'Ekonomi',  Icon: IWallet,   module: 'economy',  activeModule: 'economy' },
  { key: 'fitness',  label: 'Fitness',  Icon: IDumbbell, module: 'fitness',  page: 'home',     activeModule: 'fitness' },
  { key: 'kost',     label: 'Kost',     Icon: IUtensils, module: 'fitness',  page: 'kosthome', activeModule: 'nutrition' },
  { key: 'calendar', label: 'Kalender', Icon: ICalendar, module: 'calendar', activeModule: 'calendar' },
];

// Pages that belong to the Kost tab (everything else under the fitness module is Fitness).
const KOST_PAGES = new Set<FitnessPage>(['kosthome', 'foodlog', 'recipes', 'pantry', 'mealplan']);

export default function TopNav() {
  const { module, fitnessPage, setModule, setFitnessPage, userProfile } = useStore();
  const { logout } = useAuthStore();

  const visible = TABS.filter(t => {
    if (!t.activeModule) return true;
    if (!userProfile || userProfile.activeModules.length === 0) return true;
    return userProfile.activeModules.includes(t.activeModule);
  });

  const isActive = (t: Tab): boolean => {
    if (t.module !== 'fitness') return module === t.module;
    if (module !== 'fitness') return false;
    const kost = KOST_PAGES.has(fitnessPage);
    return t.key === 'kost' ? kost : !kost;
  };

  const navigate = (t: Tab) => {
    setModule(t.module);
    if (t.page) setFitnessPage(t.page);
  };

  return (
    <>
      {/* Desktop top bar */}
      <div className="hidden lg:flex h-14 bg-panel border-b border-line items-center px-4 gap-1 flex-shrink-0">
        <span className="font-display text-lg text-ink mr-3 pl-1 select-none">Vardagshub</span>
        {visible.map(t => {
          const active = isActive(t);
          return (
            <button
              key={t.key}
              onClick={() => navigate(t)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                active ? 'text-gold' : 'text-mut hover:text-ink hover:bg-white/5'
              }`}
              style={active ? { background: 'rgba(233,193,120,.12)' } : undefined}
            >
              <t.Icon size={15} />
              {t.label}
            </button>
          );
        })}
        <div className="ml-auto">
          <button
            onClick={() => logout()}
            title="Logga ut"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-mut hover:text-ink hover:bg-white/5 transition-all"
          >
            <ILogout size={15} />
            Logga ut
          </button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex safe-area-inset-bottom border-t border-line"
        style={{ background: 'rgba(14,14,19,.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        {visible.map(t => {
          const active = isActive(t);
          return (
            <button
              key={t.key}
              onClick={() => navigate(t)}
              className={`flex-1 flex flex-col items-center gap-1 pt-2 pb-3 transition-colors ${active ? 'text-gold' : 'text-faint'}`}
            >
              <t.Icon size={21} />
              <span className="text-[10px] font-medium tracking-wide">{t.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => logout()}
          className="flex-1 flex flex-col items-center gap-1 pt-2 pb-3 transition-colors text-faint"
        >
          <ILogout size={21} />
          <span className="text-[10px] font-medium tracking-wide">Logga ut</span>
        </button>
      </div>
    </>
  );
}
