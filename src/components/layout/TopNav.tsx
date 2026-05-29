import { useStore } from '../../store/useStore';
import type { Module } from '../../types';
import { Home, Wallet, Dumbbell, CalendarDays } from 'lucide-react';

const MODULES: { id: Module; label: string; Icon: any }[] = [
  { id: 'home',     label: 'Hem',      Icon: Home },
  { id: 'economy',  label: 'Ekonomi',  Icon: Wallet },
  { id: 'fitness',  label: 'Fitness',  Icon: Dumbbell },
  { id: 'calendar', label: 'Kalender', Icon: CalendarDays },
];

export default function TopNav() {
  const { module, setModule } = useStore();

  return (
    <>
      {/* ── Desktop: slim top bar ─────────────────────────────────────────── */}
      <div className="hidden lg:flex h-11 bg-white border-b border-gray-100 items-center px-4 gap-0.5 flex-shrink-0">
        {MODULES.map(({ id, label, Icon }) => (
          <button
            key={id}
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
      </div>

      {/* ── Mobile: fixed bottom nav bar ──────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex safe-area-inset-bottom">
        {MODULES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setModule(id)}
            className={`flex-1 flex flex-col items-center gap-1 pt-2 pb-3 transition-colors ${
              module === id ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <Icon size={21} strokeWidth={module === id ? 2.2 : 1.8} />
            <span className="text-[10px] font-medium tracking-wide">{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
