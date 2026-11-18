import type { ReactNode } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Page } from '../../types';
import {
  LayoutDashboard, ListFilter, BarChart3, Target,
  TrendingUp, Upload, Wallet, Bell, LogOut, X, Settings, PieChart,
} from 'lucide-react';

// ── Navigation groups ─────────────────────────────────────────────────────────

interface NavItem { page: Page; label: string; icon: ReactNode }

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Ekonomi',
    items: [
      { page: 'overview',     label: 'Översikt',      icon: <LayoutDashboard size={17} /> },
      { page: 'transactions', label: 'Transaktioner', icon: <ListFilter size={17} /> },
      { page: 'analytics',    label: 'Analys',        icon: <BarChart3 size={17} /> },
      { page: 'budget',       label: 'Budget',        icon: <Target size={17} /> },
    ],
  },
  {
    label: 'Förmögenhet',
    items: [
      { page: 'networth',  label: 'Förmögenhet', icon: <TrendingUp size={17} /> },
      { page: 'portfolio', label: 'Portfölj',    icon: <PieChart size={17} /> },
    ],
  },
  {
    label: 'Verktyg',
    items: [
      { page: 'import',    label: 'Importera',     icon: <Upload size={17} /> },
      { page: 'reminders', label: 'Påminnelser',   icon: <Bell size={17} /> },
      { page: 'settings',  label: 'Inställningar', icon: <Settings size={17} /> },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Desktop variant: rendered in normal flow, not fixed-positioned */
  desktop?: boolean;
}

export default function Sidebar({ isOpen, onClose, desktop = false }: SidebarProps) {
  const { page, setPage, transactions } = useStore();
  const { logout, user } = useAuthStore();
  const txCount = transactions.filter(t => !t.isTransfer).length;

  const navigate = (p: Page) => {
    setPage(p);
    onClose();
  };

  const baseClasses = 'w-56 h-screen bg-panel border-r border-line flex flex-col';

  // Desktop variant: static, in the normal flex flow
  const positionClasses = desktop
    ? ''
    : [
        'fixed left-0 top-0 z-30',
        'transition-transform duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ');

  return (
    <aside className={`${baseClasses} ${positionClasses}`}>
      {/* Logo + close (mobile only) */}
      <div className="px-5 py-5 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center font-display font-bold text-[#2a1d08]"
            style={{ background: 'linear-gradient(145deg,#f4d79a,#cf9a3f)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,.5)' }}>
            V
          </div>
          <div className="min-w-0">
            <p className="font-display text-ink text-[15px] leading-tight">Min Ekonomi</p>
            {txCount > 0 && (
              <p className="text-[11px] text-faint leading-tight tnum">{txCount.toLocaleString('sv-SE')} tr.</p>
            )}
          </div>
        </div>
        {!desktop && (
          <button onClick={onClose} className="p-1.5 rounded-lg text-mut hover:bg-white/5">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-faint uppercase tracking-[0.14em]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ page: p, label, icon }) => {
                const active = page === p;
                return (
                  <button
                    key={p}
                    onClick={() => navigate(p)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                      active ? 'text-gold font-medium' : 'text-mut hover:bg-white/5 hover:text-ink'
                    }`}
                    style={active ? { background: 'rgba(233,193,120,.12)' } : undefined}
                  >
                    <span className={active ? 'text-gold' : 'text-faint'}>{icon}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-line space-y-1">
        {user && (
          <p className="text-[11px] text-faint px-3 truncate">{user.email}</p>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-mut hover:bg-white/5 hover:text-ink transition-all"
        >
          <LogOut size={16} />
          Logga ut
        </button>
      </div>
    </aside>
  );
}
