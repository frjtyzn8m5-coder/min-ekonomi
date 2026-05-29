import { useEffect, useState, lazy, Suspense } from 'react';
import { useStore } from './store/useStore';
import { useAuthStore } from './store/useAuthStore';
import Sidebar from './components/layout/Sidebar';
import TopNav from './components/layout/TopNav';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';

// ── Economy pages (lazy) ──────────────────────────────────────────────────────
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

// ── Hub module pages (lazy) ───────────────────────────────────────────────────
const Home         = lazy(() => import('./pages/home/Home'));
const FitnessHome  = lazy(() => import('./pages/fitness/FitnessHome'));
const CalendarHome = lazy(() => import('./pages/calendar/CalendarHome'));

// ─────────────────────────────────────────────────────────────────────────────

const PAGE_TRANSITION = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -8 },
  transition: { duration: 0.18 },
};

const PAGE_LABELS: Record<string, string> = {
  overview:     'Översikt',
  transactions: 'Transaktioner',
  analytics:    'Analys',
  budget:       'Budget',
  networth:     'Förmögenhet',
  import:       'Importera',
  reminders:    'Påminnelser',
  settings:     'Inställningar',
  portfolio:    'Portfölj',
};

const ECONOMY_PAGES: Record<string, any> = {
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

const Spinner = () => (
  <div className="flex-1 flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  const { page, module } = useStore();
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

  const EconomyPage = ECONOMY_PAGES[page];

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

      {/* ── Desktop top nav (hidden on mobile – mobile uses fixed bottom nav) ── */}
      <TopNav />

      {/* ── Main content area ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {module === 'economy' ? (
          // ── Economy module: sidebar + paged content ──────────────────────
          <>
            {/* Mobile overlay backdrop */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 z-20 bg-black/30 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Desktop sidebar – in normal flex flow */}
            <div className="hidden lg:flex flex-shrink-0">
              <Sidebar isOpen={true} onClose={() => {}} desktop={true} />
            </div>

            {/* Mobile sidebar – fixed overlay */}
            <div className="lg:hidden">
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Page area */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {/* Mobile top bar with hamburger */}
              <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
                >
                  <Menu size={18} className="text-gray-600" />
                </button>
                <span className="text-sm font-semibold text-gray-900">
                  {PAGE_LABELS[page] || page}
                </span>
              </div>

              {/* pb-16 on mobile avoids the fixed bottom nav covering content */}
              <main className="flex-1 overflow-auto pb-16 lg:pb-0">
                <div className="min-h-full flex flex-col max-w-screen-2xl mx-auto w-full">
                  <Suspense fallback={<Spinner />}>
                    <AnimatePresence mode="wait">
                      <motion.div key={page} {...PAGE_TRANSITION} className="flex-1 flex flex-col min-h-0">
                        <EconomyPage />
                      </motion.div>
                    </AnimatePresence>
                  </Suspense>
                </div>
              </main>
            </div>
          </>
        ) : (
          // ── Other modules: full-width, no sidebar ────────────────────────
          <main className="flex-1 overflow-auto pb-16 lg:pb-0">
            <Suspense fallback={<Spinner />}>
              <AnimatePresence mode="wait">
                <motion.div key={module} {...PAGE_TRANSITION} className="min-h-full">
                  {module === 'home'     && <Home />}
                  {module === 'fitness'  && <FitnessHome />}
                  {module === 'calendar' && <CalendarHome />}
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </main>
        )}
      </div>
    </div>
  );
}
