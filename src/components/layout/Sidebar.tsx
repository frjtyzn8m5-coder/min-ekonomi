import type { ReactNode } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Page } from '../../types';
import {
  LayoutDashboard, ListFilter, BarChart3, Target,
  TrendingUp, Upload, Wallet, Bell, LogOut,
} from 'lucide-react';

const NAV: { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'overview', label: 'Översikt', icon: <LayoutDashboard size={18} /> },
  { page: 'transactions', label: 'Transaktioner', icon: <ListFilter size={18} /> },
  { page: 'analytics', label: 'Analys', icon: <BarChart3 size={18} /> },
  { page: 'budget', label: 'Budget', icon: <Target size={18} /> },
  { page: 'networth', label: 'Förmögenhet', icon: <TrendingUp size={18} /> },
  { page: 'import', label: 'Importera', icon: <Upload size={18} /> },
  { page: 'reminders', label: 'Påminnelser', icon: <Bell size={18} /> },
];

export default function Sidebar() {
  const { page, setPage, transactions } = useStore();
  const { logout } = useAuthStore();
  const txCount = transactions.filter(t => !t.isTransfer).length;

  return (
    <aside className="w-56 h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-10">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
            <Wallet size={14} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Min Ekonomi</span>
        </div>
        {txCount > 0 && (
          <p className="text-xs text-gray-400 mt-1 ml-9">{txCount} transaktioner</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ page: p, label, icon }) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              page === p
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className={page === p ? 'text-blue-600' : 'text-gray-400'}>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-all"
        >
          <LogOut size={16} />
          Logga ut
        </button>
      </div>
    </aside>
  );
}
