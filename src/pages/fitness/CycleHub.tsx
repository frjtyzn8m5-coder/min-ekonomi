import { useStore } from '../../store/useStore';
import { IMoon } from '../../components/ui/Icons';
import PageBanner from '../../components/ui/PageBanner';

export default function CycleHub() {
  const { setFitnessPage } = useStore();

  return (
    <div className="min-h-full bg-bg text-ink pb-24 lg:pb-8">
      <PageBanner
        img="/img/f-run3.jpg"
        eyebrow="Cykel"
        title="Cykelspårning"
        subtitle="Menscykel och hormonell träningsoptimering."
        onBack={() => setFitnessPage('home')}
      />

      <div className="max-w-[1100px] mx-auto px-5 sm:px-8 lg:px-10 pt-7">
        <div className="vh-card p-10 flex flex-col items-center text-center">
          <span className="vh-tile vh-tile--violet w-14 h-14 mb-4"><IMoon size={24} /></span>
          <h2 className="font-display text-xl text-ink">Cykelspårning byggs</h2>
          <p className="text-sm text-faint mt-2 max-w-[42ch]">
            Spåra menscykeln och anpassa träning och återhämtning efter fas. Kommer i Sprint 5.
          </p>
        </div>
      </div>
    </div>
  );
}
