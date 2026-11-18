import { IArrowRight, IPlay } from '../ui/Icons';

// Shared building blocks for the image-rich editorial hubs (Fitness, Kost).
// Duotone photography (grayscale + gold/dark wash) + motion, no "black bars".

const DUO = (img: string): React.CSSProperties => ({
  backgroundImage: `url(${img})`,
  filter: 'grayscale(1) contrast(1.06) brightness(0.58)',
});

export function EditorialHero({
  img, eyebrow, title, titleEm, sub, onPrimary, primaryLabel, onSecondary, secondaryLabel,
}: {
  img: string; eyebrow: string; title: string; titleEm: string; sub: string;
  onPrimary?: () => void; primaryLabel?: string; onSecondary?: () => void; secondaryLabel?: string;
}) {
  return (
    <header className="relative h-[58vh] min-h-[440px] flex items-end overflow-hidden">
      <div className="absolute inset-[-6%] bg-cover bg-center vh-kenburns" style={DUO(img)} />
      <div className="absolute inset-0" style={{
        background:
          'linear-gradient(90deg,rgba(9,9,11,.85),rgba(9,9,11,.35) 55%,transparent),' +
          'linear-gradient(0deg,rgba(9,9,11,.96),transparent 58%),' +
          'radial-gradient(90% 70% at 82% 8%,rgba(233,193,120,.3),transparent 60%)',
      }} />
      <div className="relative z-10 w-full max-w-[1500px] mx-auto px-5 sm:px-8 lg:px-12 pb-9">
        <div className="inline-flex items-center gap-2.5 text-[12px] tracking-[0.22em] uppercase text-gold-2 mb-4">
          <span className="w-8 h-px bg-gold" />{eyebrow}
        </div>
        <h1 className="font-display font-normal leading-[0.92] tracking-[-0.025em] m-0"
          style={{ fontSize: 'clamp(40px,7vw,92px)' }}>
          {title}<br /><em className="italic text-gold-2">{titleEm}</em>
        </h1>
        <p className="text-[#cfc8b8] mt-4 max-w-[42ch]" style={{ fontSize: 'clamp(15px,1.5vw,18px)' }}>{sub}</p>
        {(onPrimary || onSecondary) && (
          <div className="flex gap-3 mt-6 flex-wrap">
            {onPrimary && (
              <button onClick={onPrimary}
                className="inline-flex items-center gap-2 font-bold text-[15px] rounded-2xl px-6 py-3.5 text-[#2a1d08] transition-transform hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)', boxShadow: '0 16px 36px -16px rgba(233,193,120,.7)' }}>
                <IPlay size={16} /> {primaryLabel}
              </button>
            )}
            {onSecondary && (
              <button onClick={onSecondary}
                className="inline-flex items-center gap-2 font-semibold text-[15px] rounded-2xl px-6 py-3.5 text-white border border-white/15 backdrop-blur hover:bg-white/10 transition-colors"
                style={{ background: 'rgba(255,255,255,.08)' }}>
                {secondaryLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export function StatStrip({ stats }: { stats: { label: string; value: string; unit?: string }[] }) {
  return (
    <div className="relative z-[3] grid grid-cols-2 sm:grid-cols-4 gap-px rounded-[20px] overflow-hidden border border-line -mt-11"
      style={{ background: 'var(--line)' }}>
      {stats.map(s => (
        <div key={s.label} className="bg-soft px-5 py-4">
          <div className="text-[10px] tracking-[0.14em] uppercase text-mut">{s.label}</div>
          <div className="font-display text-[30px] mt-1 tnum">{s.value}{s.unit && <span className="text-[13px] text-faint"> {s.unit}</span>}</div>
        </div>
      ))}
    </div>
  );
}

export function ImageTile({
  img, tag, title, desc, tint = 'rgba(233,193,120,.35)', className = '', onClick,
}: {
  img: string; tag: string; title: string; desc: string; tint?: string; className?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className={`group relative rounded-[22px] overflow-hidden border border-line text-left ${className}`}>
      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[1100ms] ease-out group-hover:scale-[1.13]"
        style={{ ...DUO(img), transform: 'scale(1.03)' }} />
      <div className="absolute inset-0" style={{
        background: `linear-gradient(0deg,rgba(9,9,11,.92),rgba(9,9,11,.12) 62%),linear-gradient(120deg,${tint},transparent 55%)`,
      }} />
      <span className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center bg-white/10 backdrop-blur transition-colors group-hover:bg-gold">
        <IArrowRight size={16} className="text-white group-hover:text-[#2a1d08]" />
      </span>
      <div className="relative z-[2] h-full flex flex-col justify-end p-5">
        <span className="text-[10px] tracking-[0.14em] uppercase text-gold-2">{tag}</span>
        <h3 className="font-display text-xl leading-tight mt-1.5 mb-1">{title}</h3>
        <p className="text-[12.5px]" style={{ color: '#cfc8b8' }}>{desc}</p>
      </div>
    </button>
  );
}
