import { useEffect, useState, lazy, Suspense } from 'react';
import { useStore } from './store/useStore';
import { useAuthStore } from './store/useAuthStore';
import Sidebar from './components/layout/Sidebar';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';

const Overview     = lazy(() => import('./pages/Overview'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Analytics    = lazy(() => import('./pages/Analytics'));
const Budget       = lazy(() => import('./pages/Budget'));
const NetWorth     = lazy(() => import('./pages/NetWorth'));
const Import       = lazy(() => import('./pages/Import'));
const Reminders    = lazy(() => import('./pages/Reminders'));
const Settings     = lazy(() => import('./pages/Settings'));
const Portfolio    = lazy(() => import('./pages/Portfolio'));
const Login        = lazy(() => import('./pages/Login'));

const PAGE_TRANSITION = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
  transition: { duration: 0.18 },
};

const PAGE_LABELS: Record<string, string> = {
  overview: 'Översikt',
  transactions: 'Transaktioner',
  analytics: 'Analys',
  budget: 'Budget',
  networth: 'Förmögenhet',
  import: 'Importera',
  reminders: 'Påminnelser',
  settings: 'Inställningar',
  portfolio: 'Portfölj',
};

const pages: Record<string, any> = {
  overview: Overview,
  transactions: Transactions,
  analytics: Analytics,
  budget: Budget,
  networth: NetWorth,
  import: Import,
  reminders: Reminders,
  settings: Settings,
  portfolio: Portfolio,
};

export default function App() {
  const { page } = useStore();
  const { user, loading, initAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { initAuth(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={null}>
        <Login />
      </Suspense>
    );
  }

  const PageComponent = pages[page];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Desktop sidebar – in normal flex flow, not fixed */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar isOpen={true} onClose={() => {}} desktop={true} />
      </div>

      {/* Mobile sidebar – fixed overlay */}
      <div className="lg:hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <Menu size={18} className="text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {PAGE_LABELS[page] || page}
          </span>
        </div>

        <main className="flex-1 overflow-auto flex flex-col">
          <div className="flex-1 flex flex-col w-full">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>}>
              <AnimatePresence mode="wait">
                <motion.div key={page} {...PAGE_TRANSITION} className="flex-1 flex flex-col min-h-0">
                  <PageComponent />
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
