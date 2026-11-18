import { Target } from 'lucide-react';
import { useStore } from '../../store/useStore';

export default function GoalCenter() {
  const { setFitnessPage } = useStore();

  return (
    <div className="min-h-full bg-bg text-ink p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setFitnessPage('home')}
          className="text-sm text-mut hover:text-ink transition-colors"
        >
          ← Tillbaka
        </button>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-cyan" style={{ background: 'rgba(95,224,208,.12)' }}>
          <Target size={18} />
        </div>
        <h1 className="font-display text-2xl text-ink">Målcentrum</h1>
      </div>
      <p className="text-sm text-faint mb-8">Sätt och följ upp dina hälso- och träningsmål.</p>
      <div className="vh-card p-8 text-center text-faint text-sm">
        Kommer i Sprint 2
      </div>
    </div>
  );
}
