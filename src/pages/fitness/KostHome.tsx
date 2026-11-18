import { useStore } from '../../store/useStore';
import { EditorialHero, StatStrip, ImageTile } from '../../components/fitness/Editorial';
import type { FitnessPage } from '../../types';

const IMG = (f: string) => `/img/${f}.jpg`;

export default function KostHome() {
  const { setFitnessPage, userProfile, nutritionSettings } = useStore();
  const go = (p: FitnessPage) => setFitnessPage(p);

  const kcal = userProfile?.dailyCalorieTarget ?? nutritionSettings.targetCalories;
  const protein = userProfile?.proteinTargetG ?? nutritionSettings.proteinTarget;

  return (
    <div className="min-h-full bg-bg text-ink">
      <EditorialHero
        img={IMG('f-food4')}
        eyebrow="Kost"
        title="Äta för att"
        titleEm="prestera."
        sub="Logga mat, planera veckan och håll koll på makron — kopplat till ditt mål."
        onPrimary={() => go('foodlog')}
        primaryLabel="Logga måltid"
        onSecondary={() => go('mealplan')}
        secondaryLabel="Veckoplan"
      />

      <div className="max-w-[1500px] mx-auto px-5 sm:px-8 lg:px-12">
        <StatStrip stats={[
          { label: 'Kalorimål', value: kcal.toLocaleString('sv-SE'), unit: 'kcal' },
          { label: 'Protein', value: String(protein), unit: 'g' },
          { label: 'Idag', value: '1 420', unit: 'kcal' },
          { label: 'Vatten', value: '1,8', unit: 'L' },
        ]} />

        <section className="pt-14 pb-16">
          <p className="text-[12px] tracking-[0.2em] uppercase text-gold">Din kost</p>
          <h2 className="font-display text-ink mt-3 leading-tight" style={{ fontSize: 'clamp(28px,4vw,46px)', letterSpacing: '-0.02em' }}>
            Mat som <em className="italic text-gold-2">funkar.</em>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mt-7" style={{ gridAutoRows: '220px' }}>
            <ImageTile className="lg:col-span-3 lg:row-span-2" img={IMG('f-food4')} tint="rgba(233,193,120,.4)"
              tag="Dagligt" title="Matdagbok & makron" desc="Barcode-scanning, adaptiv TDEE och mikronäring. Fyra måltider med makro-progress."
              onClick={() => go('foodlog')} />
            <ImageTile className="lg:col-span-3" img={IMG('f-cook')} tint="rgba(155,140,255,.4)"
              tag="Recept" title="Recept" desc="Importera från ICA, kostnad & näring via Livsmedelsverket."
              onClick={() => go('recipes')} />
            <ImageTile className="lg:col-span-3" img={IMG('f-meal5')} tint="rgba(95,224,208,.4)"
              tag="Planera" title="Måltidsplan" desc="Generera veckan, byt måltider, exportera inköpslista."
              onClick={() => go('mealplan')} />
            <ImageTile className="lg:col-span-6" img={IMG('f-pantry')} tint="rgba(191,226,106,.36)"
              tag="Hemma" title="Skafferi" desc="Registrera varor via kvitto eller streckkod. Lagerstatus, utgångsdatum och priser — se vad du kan laga."
              onClick={() => go('pantry')} />
          </div>
        </section>
      </div>
    </div>
  );
}
