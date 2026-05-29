import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Wallet, Dumbbell, CalendarDays, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Module } from '../../types';

interface ModuleCard {
  module: Module;
  icon: any;
  label: string;
  color: string;
  bgColor: string;
  description: string;
  statusLine: () => string;
  ready: boolean;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'God natt';
  if (h < 11) return 'God morgon';
  if (h < 14) return 'God middag';
  if (h < 18) return 'God eftermiddag';
  return 'God kväll';
}

export default function Home() {
  const { setModule, transactions } = useStore();
  const { user } = useAuthStore();

  // Quick economy stat
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTxs = transactions.filter(t => t.date.startsWith(thisMonth) && !t.isTransfer);
  const income   = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  const balance  = income - expenses;

  const MODULES: ModuleCard[] = [
    {
      module: 'economy',
      icon: Wallet,
      label: 'Ekonomi',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Budget, transaktioner, portfölj och förmögenhet.',
      statusLine: () => transactions.length > 0
        ? `${balance >= 0 ? '+' : ''}${balance.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr denna månad`
        : 'Importera dina första transaktioner',
      ready: true,
    },
    {
      module: 'fitness',
      icon: Dumbbell,
      label: 'Fitness',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      description: 'Träningslogg, kalorier, vikt och recept.',
      statusLine: () => 'Kommer snart',
      ready: false,
    },
    {
      module: 'calendar',
      icon: CalendarDays,
      label: 'Kalender',
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
      description: 'Synka Teams, Google och Apple Calendar.',
      statusLine: () => 'Kommer snart',
      ready: false,
    },
  ];

  const displayName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-gray-900">
          {getGreeting()}{displayName ? `, ${displayName}` : ''}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </motion.div>

      {/* Module cards */}
      <div className="space-y-3">
        {MODULES.map(({ module, icon: Icon, label, color, bgColor, description, statusLine, ready }, i) => (
          <motion.button
            key={module}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.06 }}
            onClick={() => setModule(module)}
            className="w-full bg-white rounded-2xl border border-gray-100 p-5 text-left hover:border-gray-200 hover:shadow-sm transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={20} className={color} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{label}</span>
                    {!ready && (
                      <span className="text-[10px] font-medium bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                        Kommer snart
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                  <p className={`text-xs mt-1.5 font-medium ${ready ? color : 'text-gray-300'}`}>
                    {statusLine()}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </div>
          </motion.button>
        ))}
      </div>

      {/* Footer hint */}
      <p className="text-center text-xs text-gray-300 mt-10">
        Vardagshub · byggd av dig
      </p>
    </div>
  );
}
