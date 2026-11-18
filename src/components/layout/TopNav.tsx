import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Module, ActiveModule } from '../../types';
import { IGrid, IWallet, IDumbbell, IUtensils, ICalendar, ILogout } from '../ui/Icons';

type IconC = (p: { size?: number; className?: string }) => React.ReactElement;

const ALL_MODULES: { id: Module; activeModule?: ActiveModule; label: string; Icon: IconC }[] = [
  { id: 'home',     label: 'Hem',      Icon: IGrid },
  { id: 'economy',  activeModule: 'economy',   label: 'Ekonomi',  Icon: IWallet },
  { id: 'fitness',  activeModule: 'fitness',   label: 'Fitness',  Icon: IDumbbell },
  { id: 'fitness',  activeModule: 'nutrition', label: 'Kost',     Icon: IUtensils },
  { id: 'calendar', activeModule: 'calendar',  label: 'Kalender', Icon: ICalendar },
];

export default function TopNav() {
  const { module, setModule, userProfile } = useStore();
  const { logout } = useAuthStore();

  const visibleModules = ALL_MODULES.filter(m => {
    if (!m.activeModule) return true;
    if (!userProfile || userProfile.activeModules.length === 0) return true;
    return userProfile.activeModules.includes(m.activeModule);
  });

  const deduped = visibleModules.filter((m, idx, arr) =>
    arr.findIndex(x => x.id === m.id && x.label === m.label) === idx
  );

  return (
    <>
      {/* ── Desktop: slim top bar ─────────────────────────────────────────── */}
      <div className="hidden lg:flex h-14 bg-panel border-b border-line items-center px-4 gap-1 flex-shrink-0">
        <span className="font-display text-lg text-ink mr-3 pl-1 select-none">Vardagshub</span>
        {deduped.map(({ id, label, Icon }) => {
          const active = module === id;
          return (
            <button
              key={label}
              onClick={() => setModule(id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                active ? 'text-gold' : 'text-mut hover:text-ink hover:bg-white/5'
              }`}
              style={active ? { background: 'rgba(233,193,120,.12)' } : undefined}
            >
              <Icon size={15} />
              {label}
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

      {/* ── Mobile: fixed bottom nav bar ──────────────────────────────────── */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex safe-area-inset-bottom border-t border-line"
        style={{ background: 'rgba(14,14,19,.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        {deduped.map(({ id, label, Icon }) => {
          const active = module === id;
          return (
            <button
              key={label}
              onClick={() => setModule(id)}
              className={`flex-1 flex flex-col items-center gap-1 pt-2 pb-3 transition-colors ${active ? 'text-gold' : 'text-faint'}`}
            >
              <Icon size={21} />
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
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
