import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import Hero3D from '../../components/ui/Hero3D';
import { ImageTile } from '../../components/fitness/Editorial';
import { IDumbbell, IHeart, IBolt, IMoon, IWallet, IPlay, IArrowRight, ITrend } from '../../components/ui/Icons';
import type { Module, Page, FitnessPage } from '../../types';

const sv = (n: number) => n.toLocaleString('sv-SE');
const IMG = (f: string) => `/img/${f}.jpg`;

// ── real monthly aggregates from transactions ────────────────────────────────
function monthly(transactions: { date: string; amount: number; type: string; isTransfer?: boolean }[], n: number) {
  const now = new Date();
  const out: { ym: string; label: string; inc: number; exp: number; net: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const txs = transactions.filter(t => t.date.startsWith(ym) && !t.isTransfer);
    const inc = txs.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const exp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    out.push({ ym, label: d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', ''), inc, exp, net: inc - exp });
  }
  return out;
}

// ── tiny inline sparkline (real data only) ───────────────────────────────────
function spark(data: number[], color: string, w = 160, h = 40) {
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / rng) * (h - 4) - 2]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${w},${h} L0,${h} Z`;
  const id = 'sg' + color.replace(/\W/g, '');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="mt-2">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export default function Dashboard() {
  const { userProfile, transactions, nutritionSettings, reminders, setModule, setFitnessPage, setPage } = useStore();
  const { user } = useAuthStore();
  const [showConnect, setShowConnect] = useState(false);

  const name = ((userProfile?.displayName || user?.displayName || '').split(' ')[0]) || 'där';
  const h = new Date().getHours();
  const hi = h < 10 ? 'God morgon' : h < 18 ? 'God dag' : 'God kväll';
  const now = new Date();
  const today = now.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  const monthShort = now.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '');

  // ── REAL economy data ──────────────────────────────────────────────────────
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTx = transactions.filter(t => t.date.startsWith(ym) && !t.isTransfer);
  const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
  const remaining = Math.max(income - expenses, 0);
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
  const series6 = monthly(transactions, 6);
  const hasEcoHistory = series6.some(m => m.inc > 0 || m.exp > 0);
  const netSpark = series6.map(m => m.net);

  // ── REAL fitness / nutrition targets ───────────────────────────────────────
  const kcalTarget = userProfile?.dailyCalorieTarget ?? nutritionSettings.targetCalories;
  const proteinTarget = userProfile?.proteinTargetG ?? nutritionSettings.proteinTarget;
  const weight = userProfile?.currentWeight;
  const targetWeight = userProfile?.targetWeight;
  const weightDelta = weight && targetWeight ? Math.round((weight - targetWeight) * 10) / 10 : null;

  // honest highlight line — only from data we actually have
  const highlight =
    weightDelta !== null && weightDelta !== 0
      ? `${sv(Math.abs(weightDelta))} kg ${weightDelta > 0 ? 'kvar till' : 'under'} målvikt ${sv(targetWeight!)} kg`
      : income > 0
        ? `Sparkvot ${savingsRate}% i ${monthShort} — bra jobbat`
        : 'Logga dagens pass och måltider så fylls din översikt.';

  // ── navigation helpers ─────────────────────────────────────────────────────
  const go = (m: Module, p?: Page) => { setModule(m); if (p) setPage(p); };
  const goFit = (p: FitnessPage) => { setModule('fitness'); setFitnessPage(p); };

  // ── reminders (real, from store) ───────────────────────────────────────────
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const upcoming = reminders
    .filter(r => r.active)
    .map(r => ({ ...r, day: r.dayOfMonth < 0 ? lastDay + 1 + r.dayOfMonth : r.dayOfMonth }))
    .sort((a, b) => a.day - b.day)
    .slice(0, 4);

  return (
    <div className="relative min-h-full bg-bg text-ink overflow-hidden">
      <div className="vh-aurora" />

      <div className="relative z-10 max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8">

        {/* ── HERO — full-width, live 3D + greeting ─────────────────────────── */}
        <section className="vh-card relative overflow-hidden min-h-[380px] flex"
          style={{ background: 'radial-gradient(130% 110% at 85% 0%, rgba(155,140,255,.20), transparent 55%), linear-gradient(165deg,#17151f,#0e0e13)' }}>
          <div className="absolute inset-0"><Hero3D /></div>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, rgba(9,9,12,.94) 0%, rgba(9,9,12,.62) 44%, transparent 76%), linear-gradient(0deg, rgba(9,9,12,.72), transparent 55%)' }} />

          <div className="relative z-10 flex flex-col justify-between gap-7 p-6 sm:p-9 w-full max-w-[660px]">
            <div className="inline-flex items-center gap-2.5 text-[11px] tracking-[0.22em] uppercase text-gold-2">
              <span className="w-8 h-px bg-gold" />{today}
            </div>

            <div>
              <h1 className="font-display font-normal leading-[0.94] tracking-[-0.025em] m-0"
                style={{ fontSize: 'clamp(38px,6.2vw,76px)' }}>
                {hi},<br /><em className="italic text-gold-2">{name}.</em>
              </h1>
              <p className="text-[#cfc8b8] mt-4 max-w-[44ch]" style={{ fontSize: 'clamp(14px,1.5vw,17px)' }}>{highlight}</p>

              <div className="flex gap-3 mt-6 flex-wrap">
                <button onClick={() => goFit('workoutlog')}
                  className="inline-flex items-center gap-2 font-bold text-[15px] rounded-2xl px-6 py-3.5 text-[#2a1d08] transition-transform hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)', boxShadow: '0 16px 36px -16px rgba(233,193,120,.7)' }}>
                  <IPlay size={16} /> Starta dagens pass
                </button>
                <button onClick={() => go('economy', 'overview')}
                  className="inline-flex items-center gap-2 font-semibold text-[15px] rounded-2xl px-6 py-3.5 text-white border border-white/15 backdrop-blur hover:bg-white/10 transition-colors"
                  style={{ background: 'rgba(255,255,255,.08)' }}>
                  Översikt ekonomi <IArrowRight size={15} />
                </button>
              </div>
            </div>

            <span className="text-[10px] uppercase tracking-[0.18em] text-faint">◆ Live 3D · rotera med musen</span>
          </div>
        </section>

        {/* ── REAL DATA ROW ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 mt-4 lg:mt-5">

          {/* Economy — real */}
          <button onClick={() => go('economy', 'overview')} className="vh-card text-left p-5 lg:col-span-5">
            <div className="flex items-center justify-between">
              <span className="vh-tile vh-tile--gold w-11 h-11"><IWallet size={22} /></span>
              {income > 0 && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(95,224,208,.15)', color: 'var(--cyan)' }}>▲ {savingsRate}% sparkvot</span>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-mut mt-4">Kvar att spendera · {monthShort}</p>
            <p className="font-display text-4xl tnum mt-1">{sv(remaining)} <span className="text-base text-faint">kr</span></p>
            {hasEcoHistory ? spark(netSpark, '#e9c178', 280, 42)
              : <p className="text-[12px] text-faint mt-3">Importera transaktioner för att se ditt kassaflöde.</p>}
            <div className="mt-3 text-[12px] text-mut">
              <div className="flex justify-between py-1 border-t border-line"><span>Inkomster</span><span className="tnum text-ink">{sv(income)} kr</span></div>
              <div className="flex justify-between py-1 border-t border-line"><span>Utgifter</span><span className="tnum text-ink">{sv(expenses)} kr</span></div>
            </div>
          </button>

          {/* Goal targets — real targets, clickable rings */}
          <section className="vh-card p-5 lg:col-span-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mut">Dina mål per dag</p>
            <div className="flex gap-2 justify-between mt-4 flex-wrap">
              <Medallion color="var(--gold)" label={sv(kcalTarget)} caption="Kcal · mål" onClick={() => goFit('foodlog')} />
              <Medallion color="var(--cyan)" label={`${proteinTarget}g`} caption="Protein · mål" onClick={() => goFit('foodlog')} />
              <Medallion color="var(--violet)" label={<IDumbbell size={22} className="text-violet" />} caption="Pass · program" onClick={() => goFit('program')} />
            </div>
            <p className="text-[11px] text-faint mt-4">Logga dagens intag och pass så räknas måluppfyllnaden.</p>
          </section>

          {/* Weight — real */}
          <button onClick={() => goFit('weightlog')} className="vh-card text-left p-5 lg:col-span-3 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="vh-tile vh-tile--cyan w-11 h-11"><IDumbbell size={22} /></span>
              {targetWeight && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(95,224,208,.12)', color: 'var(--cyan)' }}>mål {sv(targetWeight)}</span>}
            </div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-mut mt-4">Vikt</p>
            <p className="font-display tnum text-4xl mt-1">{weight ? sv(weight) : '—'}{weight && <span className="text-base text-faint"> kg</span>}</p>
            <p className="text-[12px] text-mut mt-auto pt-3">
              {weightDelta !== null
                ? (weightDelta === 0 ? 'Du är på målvikt' : `${sv(Math.abs(weightDelta))} kg ${weightDelta > 0 ? 'kvar' : 'under mål'}`)
                : 'Logga din vikt'} <IArrowRight size={12} className="inline opacity-60" />
            </p>
          </button>
        </div>

        {/* ── CASHFLOW (real) + REMINDERS (real) ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 mt-4 lg:mt-5">
          <section className="vh-card lg:col-span-8 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.14em] text-mut">Kassaflöde · senaste 6 mån</p>
              <span className="text-[12px] text-mut">in <span className="text-cyan tnum">{sv(income)}</span> · ut <span className="text-coral tnum">{sv(expenses)}</span></span>
            </div>
            {hasEcoHistory ? <Cashflow data={series6} />
              : <div className="h-[150px] flex items-center justify-center text-[13px] text-faint">Inga transaktioner än — importera för att se ditt kassaflöde.</div>}
          </section>

          <section className="vh-card lg:col-span-4 p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-[0.14em] text-mut">Kommande påminnelser</p>
              <button onClick={() => go('economy', 'reminders')} className="text-faint hover:text-ink transition-colors"><IArrowRight size={14} /></button>
            </div>
            {upcoming.length ? upcoming.map((r, i) => (
              <div key={r.id} className={`flex items-center gap-3 py-2.5 ${i === upcoming.length - 1 ? '' : 'border-b border-line'}`}>
                <span className="text-lg leading-none">{r.emoji}</span>
                <div><p className="text-[13px] font-semibold">{r.title}</p><p className="text-[11px] text-faint">{r.time}</p></div>
                <span className="ml-auto text-[12px] text-mut tnum">{r.day} {monthShort}</span>
              </div>
            )) : <p className="text-[12px] text-faint py-4">Inga aktiva påminnelser.</p>}
          </section>
        </div>

        {/* ── QUICK NAV — image-rich tiles ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 lg:mt-5" style={{ gridAutoRows: '184px' }}>
          <ImageTile img={IMG('f-gym1')} tint="rgba(233,193,120,.42)" tag="Rörelse" title="Träning"
            desc="Pass, program och utveckling." onClick={() => goFit('home')} />
          <ImageTile img={IMG('f-food4')} tint="rgba(95,224,208,.42)" tag="Kost" title="Mat & makron"
            desc="Logga måltider och planera." onClick={() => goFit('kosthome')} />
          <ImageTile img={IMG('f-fin')} tint="rgba(155,140,255,.42)" tag="Kapital" title="Ekonomi"
            desc="Budget, flöde och sparande." onClick={() => go('economy', 'overview')} />
          <ImageTile img={IMG('f-cal')} tint="rgba(191,226,106,.40)" tag="Planering" title="Kalender"
            desc="Din dag och dina rutiner." onClick={() => setModule('calendar')} />
        </div>

        {/* ── HEALTH — honest "not connected" state ─────────────────────────── */}
        <section className="mt-7 lg:mt-9">
          <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
            <div>
              <p className="text-[12px] tracking-[0.2em] uppercase text-gold">Hälsodata</p>
              <h2 className="font-display mt-1.5 leading-tight" style={{ fontSize: 'clamp(22px,3vw,32px)', letterSpacing: '-0.02em' }}>
                Puls, steg & sömn — <em className="italic text-gold-2">ännu inte kopplat.</em>
              </h2>
            </div>
            <button onClick={() => setShowConnect(v => !v)}
              className="inline-flex items-center gap-2 text-[13px] font-semibold rounded-xl px-4 py-2.5 border border-line text-ink hover:bg-white/5 transition-colors">
              <ITrend size={15} className="text-gold" /> Koppla hälsodata
            </button>
          </div>

          {showConnect && (
            <div className="vh-card p-4 mb-4 flex items-start gap-3" style={{ background: 'rgba(233,193,120,.07)' }}>
              <span className="vh-tile vh-tile--gold w-9 h-9"><IHeart size={18} /></span>
              <div>
                <p className="text-[13px] font-semibold">Hälsokoppling kommer snart</p>
                <p className="text-[12px] text-mut mt-0.5">Integration mot Google Fit, Apple Health och Garmin är på väg. Tills dess visas inga påhittade värden här.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NotConnected tile="coral" icon={<IHeart size={22} />} label="Vilopuls" unit="bpm" onClick={() => setShowConnect(true)} />
            <NotConnected tile="gold" icon={<IBolt size={22} />} label="Steg idag" unit="steg" onClick={() => setShowConnect(true)} />
            <NotConnected tile="violet" icon={<IMoon size={22} />} label="Sömn" unit="h" onClick={() => setShowConnect(true)} />
          </div>
        </section>

      </div>
    </div>
  );
}

// ── Target medallion (real target value, clickable) ──────────────────────────
function Medallion({ color, label, caption, onClick }:
  { color: string; label: React.ReactNode; caption: string; onClick: () => void }) {
  const r = 38, len = 2 * Math.PI * r;
  return (
    <button onClick={onClick} className="group text-center flex-1 min-w-[84px]">
      <div className="relative w-[92px] h-[92px] mx-auto transition-transform group-hover:-translate-y-0.5">
        <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
          <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(244,241,234,.08)" strokeWidth="8" />
          <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={0} style={{ opacity: 0.85 }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display tnum text-[17px]">{label}</div>
      </div>
      <div className="text-[11px] text-mut mt-2 group-hover:text-ink transition-colors">{caption}</div>
    </button>
  );
}

// ── Real 6-month cashflow bars ───────────────────────────────────────────────
function Cashflow({ data }: { data: { label: string; inc: number; exp: number }[] }) {
  const max = Math.max(...data.flatMap(m => [m.inc, m.exp]), 1);
  return (
    <div className="mt-4 flex items-end justify-between gap-3 h-[150px]">
      {data.map((m, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
          <div className="w-full flex items-end justify-center gap-1 h-full">
            <div className="w-1/2 max-w-[18px] rounded-t-md" style={{ height: `${(m.inc / max) * 100}%`, background: 'linear-gradient(180deg,#9bf0e4,#34c3b2)' }} title={`In: ${sv(m.inc)} kr`} />
            <div className="w-1/2 max-w-[18px] rounded-t-md" style={{ height: `${(m.exp / max) * 100}%`, background: 'linear-gradient(180deg,#ffc3b6,#f06a52)' }} title={`Ut: ${sv(m.exp)} kr`} />
          </div>
          <span className="text-[10px] text-faint uppercase tracking-wide">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Honest "not connected" health card ───────────────────────────────────────
function NotConnected({ tile, icon, label, unit, onClick }:
  { tile: string; icon: React.ReactNode; label: string; unit: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="vh-card text-left p-4 opacity-95">
      <div className="flex items-center justify-between">
        <span className={`vh-tile vh-tile--${tile} w-10 h-10`} style={{ filter: 'grayscale(0.4)' }}>{icon}</span>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-line text-mut">Ej kopplad</span>
      </div>
      <p className="text-[10px] uppercase tracking-[0.13em] text-mut mt-3">{label}</p>
      <div className="flex items-end justify-between gap-2 mt-0.5">
        <p className="font-display tnum text-[26px] text-faint">—<span className="text-[12px]"> {unit}</span></p>
        <span className="text-[11px] text-gold inline-flex items-center gap-1">Koppla <IArrowRight size={12} /></span>
      </div>
    </button>
  );
}
