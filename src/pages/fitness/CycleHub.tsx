import { useStore } from '../../store/useStore';
import { IMoon } from '../../components/ui/Icons';

export default function CycleHub() {
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
        <span className="vh-tile vh-tile--violet w-9 h-9"><IMoon size={18} /></span>
        <h1 className="font-display text-2xl text-ink">Cykelspårning</h1>
      </div>
      <p className="text-sm text-faint mb-8">Menscykel och hormonell träningsoptimering – under uppbyggnad.</p>
      <div className="vh-card p-8 text-center text-faint text-sm">
        Kommer i Sprint 5
      </div>
    </div>
  );
}
