import { useStore } from './store/useStore';
import { useAuthStore } from './store/useAuthStore';
import Sidebar from './components/layout/Sidebar';
import Overview from './pages/Overview';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import Budget from './pages/Budget';
import NetWorth from './pages/NetWorth';
import Import from './pages/Import';
import Reminders from './pages/Reminders';
import Login from './pages/Login';
import { AnimatePresence, motion } from 'framer-motion';

const PAGE_TRANSITION = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
  transition: { duration: 0.18 },
};

export default function App() {
  const { page } = useStore();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return <Login />;

  const pages = {
    overview: Overview,
    transactions: Transactions,
    analytics: Analytics,
    budget: Budget,
    networth: NetWorth,
    import: Import,
    reminders: Reminders,
  };

  const PageComponent = pages[page];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-56 overflow-auto flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={page} {...PAGE_TRANSITION} className="flex-1 flex flex-col min-h-0">
            <PageComponent />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
