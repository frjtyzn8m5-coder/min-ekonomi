import { TrendingUp } from 'lucide-react';
import { useStore } from '../../store/useStore';

export default function Development() {
  const { setFitnessPage } = useStore();

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setFitnessPage('home')}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← Tillbaka
        </button>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
          <TrendingUp size={18} className="text-purple-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Utveckling</h1>
      </div>
      <p className="text-sm text-gray-400 mb-8">Grafer och statistik – under uppbyggnad.</p>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
        Kommer i Sprint 3
      </div>
    </div>
  );
}
