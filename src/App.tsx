import { useState, lazy, Suspense } from 'react';
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
};

const pages = {
  overview: Overview,
  transactions: Transactions,
  analytics: Analytics,
  budget: Budget,
  networth: NetWorth,
  import: Import,
  reminders: Reminders,
};

export default function App() {
  const { page } = useStore();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );

  const PageComponent = pages[page];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:ml-56 overflow-auto flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {PAGE_LABELS[page] || 'Min Ekonomi'}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            {...PAGE_TRANSITION}
            className="flex-1 flex flex-col min-h-0"
          >
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <PageComponent />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
