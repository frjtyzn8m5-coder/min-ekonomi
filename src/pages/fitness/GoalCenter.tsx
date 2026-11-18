import { Target } from 'lucide-react';
import { useStore } from '../../store/useStore';
import PageBanner from '../../components/ui/PageBanner';

export default function GoalCenter() {
  const { setFitnessPage } = useStore();

  return (
    <div className="min-h-full bg-bg text-ink pb-24 lg:pb-8">
      <PageBanner
        img="/img/f-lift2.jpg"
        eyebrow="Mål"
        title="Målcentrum"
        subtitle="Sätt och följ upp dina hälso- och träningsmål."
        onBack={() => setFitnessPage('home')}
      />

      <div className="max-w-[1100px] mx-auto px-5 sm:px-8 lg:px-10 pt-7">
        <div className="vh-card p-10 flex flex-col items-center text-center">
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-cyan mb-4" style={{ background: 'rgba(95,224,208,.12)' }}>
            <Target size={24} />
          </span>
          <h2 className="font-display text-xl text-ink">Målcentrum byggs</h2>
          <p className="text-sm text-faint mt-2 max-w-[42ch]">
            Här kommer du kunna sätta vikt-, styrke- och volymmål och följa dem över tid. Kommer i Sprint 2.
          </p>
        </div>
      </div>
    </div>
  );
}
