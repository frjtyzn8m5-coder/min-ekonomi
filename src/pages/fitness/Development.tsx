import { ChevronLeft } from 'lucide-react';
import { useStore } from '../../store/useStore';
import MuscleMap from '../../components/fitness/MuscleMap';
import { ITrend } from '../../components/ui/Icons';

export default function Development() {
  const { setFitnessPage } = useStore();

  return (
    <div className="min-h-full bg-bg text-ink p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setFitnessPage('home')}
          className="w-8 h-8 rounded-full bg-card border border-line flex items-center justify-center text-mut hover:text-ink transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <span className="vh-tile vh-tile--violet w-9 h-9"><ITrend size={18} /></span>
          <h1 className="font-display text-2xl text-ink">Utveckling</h1>
        </div>
      </div>

      <p className="text-sm text-faint mb-6">
        Grafer och statistik – grafer byggs i Sprint 3.
      </p>

      {/* Muscle volume heatmap preview */}
      <div className="vh-card p-5 mb-4">
        <p className="text-sm font-semibold text-mut mb-1">Träningsvolym – senaste 7 dagarna</p>
        <p className="text-xs text-faint mb-4">Färg visar antal set per muskelgrupp.</p>
        <MuscleMap
          mode="weekly_volume"
          weeklyVolume={{}}
        />
      </div>

      {/* Recovery heatmap preview */}
      <div className="vh-card p-5">
        <p className="text-sm font-semibold text-mut mb-1">Återhämtningsstatus</p>
        <p className="text-xs text-faint mb-4">Visar hur länge sedan varje muskelgrupp tränades.</p>
        <MuscleMap
          mode="fatigue"
          lastTrainedDays={{}}
        />
      </div>
    </div>
  );
}
