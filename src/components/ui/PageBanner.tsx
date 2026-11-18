import type { ReactNode } from 'react';
import { IArrowRight } from './Icons';

// Compact editorial banner for inner/sub pages: a duotone photo header with a
// Fraunces title, so every sub-page feels designed like the hubs (no plain
// headers / black bars). Keep it SHORT so the page's actual content stays primary.
export default function PageBanner({
  img, eyebrow, title, subtitle, onBack, action,
}: {
  img: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-b-[26px]" style={{ minHeight: 170 }}>
      <div
        className="absolute inset-[-6%] bg-cover bg-center vh-kenburns"
        style={{ backgroundImage: `url(${img})`, filter: 'grayscale(1) contrast(1.06) brightness(0.55)' }}
      />
      <div className="absolute inset-0" style={{
        background:
          'linear-gradient(90deg,rgba(9,9,11,.82),rgba(9,9,11,.35) 60%,transparent),' +
          'linear-gradient(0deg,rgba(9,9,11,.92),transparent 70%),' +
          'radial-gradient(90% 80% at 85% 0%,rgba(233,193,120,.28),transparent 60%)',
      }} />
      <div className="relative z-10 flex items-end justify-between gap-3 px-5 sm:px-8 lg:px-10 pt-6 pb-5" style={{ minHeight: 170 }}>
        <div>
          {onBack && (
            <button onClick={onBack}
              className="inline-flex items-center gap-1.5 text-[12px] text-white/70 hover:text-white mb-3 transition-colors">
              <IArrowRight size={14} className="rotate-180" /> Tillbaka
            </button>
          )}
          {eyebrow && <div className="text-[11px] tracking-[0.2em] uppercase text-gold-2 mb-1.5">{eyebrow}</div>}
          <h1 className="font-display text-white leading-none" style={{ fontSize: 'clamp(28px,4.4vw,48px)', letterSpacing: '-0.02em' }}>{title}</h1>
          {subtitle && <p className="text-[13px] text-white/70 mt-2 max-w-[48ch]">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
