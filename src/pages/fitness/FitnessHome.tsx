import { useStore } from '../../store/useStore';
import { EditorialHero, StatStrip, ImageTile } from '../../components/fitness/Editorial';
import type { FitnessPage } from '../../types';

const IMG = (f: string) => `/img/${f}.jpg`;

export default function FitnessHome() {
  const { setFitnessPage } = useStore();
  const go = (p: FitnessPage) => setFitnessPage(p);

  return (
    <div className="min-h-full bg-bg text-ink">
      <EditorialHero
        img={IMG('f-hero')}
        eyebrow="Fitness"
        title="Bygg dig"
        titleEm="starkare."
        sub="Program, pass, kropp och kost i en rytm. Dagens pass väntar: Push A."
        onPrimary={() => go('workoutlog')}
        primaryLabel="Starta Push A"
        onSecondary={() => go('weightlog')}
        secondaryLabel="Logga vikt"
      />

      <div className="max-w-[1500px] mx-auto px-5 sm:px-8 lg:px-12">
        <StatStrip stats={[
          { label: 'Form-index', value: '86', unit: '/100' },
          { label: 'Pass denna vecka', value: '3', unit: '/ 4' },
          { label: 'Est. 1RM bänk', value: '112', unit: 'kg' },
          { label: 'Vikt · 7d', value: '84,2', unit: 'kg' },
        ]} />

        <section className="pt-14 pb-4">
          <p className="text-[12px] tracking-[0.2em] uppercase text-gold">Allt på ett ställe</p>
          <h2 className="font-display text-ink mt-3 leading-tight" style={{ fontSize: 'clamp(28px,4vw,46px)', letterSpacing: '-0.02em' }}>
            Din <em className="italic text-gold-2">träningsvärld.</em>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mt-7" style={{ gridAutoRows: '220px' }}>
            <ImageTile className="lg:col-span-3 lg:row-span-2" img={IMG('f-gym1')} tint="rgba(233,193,120,.4)"
              tag="Dagligt" title="Träningslogg" desc="Logga pass med set, vikt, reps och RPE. Vila-timer, 1RM och PR. Progressionsförslag varje pass."
              onClick={() => go('workoutlog')} />
            <ImageTile className="lg:col-span-3" img={IMG('f-body6')} tint="rgba(95,224,208,.4)"
              tag="Kropp" title="Vikt & Kropp" desc="Vikt, mått, fettprocent och prognos."
              onClick={() => go('weightlog')} />
            <ImageTile className="lg:col-span-3" img={IMG('f-lift2')} tint="rgba(155,140,255,.4)"
              tag="Plan" title="Träningsprogram" desc="PPL, Upper/Lower eller helkropp — anpassat efter dig."
              onClick={() => go('program')} />
            <ImageTile className="lg:col-span-3" img={IMG('f-run3')} tint="rgba(191,226,106,.38)"
              tag="Bibliotek" title="Övningsdatabas" desc="Hundratals övningar med muskelkarta."
              onClick={() => go('exercises')} />
            <ImageTile className="lg:col-span-3" img={IMG('f-hero')} tint="rgba(255,143,122,.38)"
              tag="Analys" title="Utveckling" desc="Styrka, volym och kropp över tid."
              onClick={() => go('development')} />
          </div>
        </section>

        <section className="pb-16">
          <p className="text-[12px] tracking-[0.2em] uppercase text-gold">Kost</p>
          <h2 className="font-display text-ink mt-3 leading-tight" style={{ fontSize: 'clamp(28px,4vw,46px)', letterSpacing: '-0.02em' }}>
            Äta för att <em className="italic text-gold-2">prestera.</em>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mt-7" style={{ gridAutoRows: '220px' }}>
            <ImageTile className="lg:col-span-4" img={IMG('f-food4')} tint="rgba(233,193,120,.4)"
              tag="Dagligt" title="Matdagbok & makron" desc="Barcode-scanning, adaptiv TDEE, mikronäring."
              onClick={() => go('foodlog')} />
            <ImageTile className="lg:col-span-2" img={IMG('f-meal5')} tint="rgba(95,224,208,.4)"
              tag="Planera" title="Recept & måltidsplan" desc="Importera, planera veckan, inköpslista."
              onClick={() => go('recipes')} />
          </div>
        </section>
      </div>
    </div>
  );
}
