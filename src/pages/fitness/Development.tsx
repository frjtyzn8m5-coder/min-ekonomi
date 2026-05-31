import { TrendingUp, ChevronLeft } from 'lucide-react';
import { useStore } from '../../store/useStore';
import MuscleMap from '../../components/fitness/MuscleMap';

export default function Development() {
  const { setFitnessPage } = useStore();

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setFitnessPage('home')}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <ChevronLeft size={16} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
            <TrendingUp size={18} className="text-purple-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Utveckling</h1>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-6">
        Grafer och statistik – grafer byggs i Sprint 3.
      </p>

      {/* Muscle volume heatmap preview */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-1">Träningsvolym – senaste 7 dagarna</p>
        <p className="text-xs text-gray-400 mb-4">Färg visar antal set per muskelgrupp.</p>
        <MuscleMap
          mode="weekly_volume"
          weeklyVolume={{}}
        />
      </div>

      {/* Recovery heatmap preview */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-1">Återhämtningsstatus</p>
        <p className="text-xs text-gray-400 mb-4">Visar hur länge sedan varje muskelgrupp tränades.</p>
        <MuscleMap
          mode="fatigue"
          lastTrainedDays={{}}
        />
      </div>
    </div>
  );
}
