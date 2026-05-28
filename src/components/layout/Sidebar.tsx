import type { ReactNode } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Page } from '../../types';
import {
  LayoutDashboard, ListFilter, BarChart3, Target,
  TrendingUp, Upload, Wallet, Bell, LogOut, X,
} from 'lucide-react';

const NAV: { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'overview',     label: 'Översikt',      icon: <LayoutDashboard size={18} /> },
  { page: 'transactions', label: 'Transaktioner', icon: <ListFilter size={18} /> },
  { page: 'analytics',    label: 'Analys',        icon: <BarChart3 size={18} /> },
  { page: 'budget',       label: 'Budget',        icon: <Target size={18} /> },
  { page: 'networth',     label: 'Förmögenhet',   icon: <TrendingUp size={18} /> },
  { page: 'import',       label: 'Importera',     icon: <Upload size={18} /> },
  { page: 'reminders',    label: 'Påminnelser',   icon: <Bell size={18} /> },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { page, setPage, transactions } = useStore();
  const { logout, user } = useAuthStore();
  const txCount = transactions.filter(t => !t.isTransfer).length;

  const navigate = (p: Page) => {
    setPage(p);
    onClose();
  };

  return (
    <aside
      className={[
        'w-64 lg:w-56 h-screen bg-white border-r border-gray-100 flex flex-col',
        'fixed left-0 top-0 z-30',
        'transition-transform duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ].join(' ')}
    >
      {/* Logo + close */}
      <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex-shrink-0 flex items-center justify-center">
            <Wallet size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight">Min Ekonomi</p>
            {txCount > 0 && (
              <p className="text-[11px] text-gray-400 leading-tight">{txCount.toLocaleString('sv-SE')} transaktioner</p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ page: p, label, icon }) => (
          <button
            key={p}
            onClick={() => navigate(p)}
            classNam