import { useStore } from '../../store/useStore';
import MuscleMap from '../../components/fitness/MuscleMap';
import PageBanner from '../../components/ui/PageBanner';

export default function Development() {
  const { setFitnessPage } = useStore();

  return (
    <div className="min-h-full bg-bg text-ink pb-24 lg:pb-8">
      <PageBanner
        img="/img/f-data.jpg"
        eyebrow="Analys"
        title="Utveckling"
        subtitle="Styrka, volym och kropp över tid — se hur träningen ger resultat."
        onBack={() => setFitnessPage('home')}
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-7">
        <p className="text-sm text-faint mb-6">
          Grafer och statistik – grafer byggs i Sprint 3.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
          {/* Muscle volume heatmap preview */}
          <div className="vh-card p-5">
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
      </div>
    </div>
  );
}
