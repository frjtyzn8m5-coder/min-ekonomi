import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import Hero3D from '../../components/ui/Hero3D';
import { IDumbbell, IHeart, IBolt, IMoon, IWallet, IUtensils, IPlay, IArrowRight } from '../../components/ui/Icons';

const sv = (n: number) => n.toLocaleString('sv-SE');

// ── tiny inline charts ──────────────────────────────────────────────────────────
function spark(data: number[], color: string, w = 120, h = 36) {
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

function ring(pct: number, color: string, label: string, caption: string) {
  const r = 40, len = 2 * Math.PI * r, off = len * (1 - Math.min(pct, 100) / 100);
  return (
    <div className="text-center flex-1 min-w-[88px]">
      <div className="relative w-[100px] h-[100px] mx-auto">
        <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(244,241,234,.08)" strokeWidth="9" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.3,.8,.3,1)' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display tnum text-lg">{label}</div>
      </div>
      <div className="text-[11px] text-mut mt-2">{caption}</div>
    </div>
  );
}

export default function Dashboard() {
  const { userProfile, transactions, nutritionSettings, setModule, setFitnessPage, setPage } = useStore();
  const { user } = useAuthStore();

  const name = ((userProfile?.displayName || user?.displayName || '').split(' ')[0]) || 'där';
  const h = new Date().getHours();
  const hi = h < 10 ? 'God morgon' : h < 18 ? 'God dag' : 'God kväll';
  const today = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTx = transactions.filter(t => t.date.startsWith(ym) && !t.isTransfer);
  const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
  const remaining = Math.max(income - expenses, 0);
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;

  const kcalTarget = userProfile?.dailyCalorieTarget ?? nutritionSettings.targetCalories;
  const proteinTarget = userProfile?.proteinTargetG ?? nutritionSettings.proteinTarget;
  const weight = userProfile?.currentWeight;
  const targetWeight = userProfile?.targetWeight;
  const kcalIn = Math.round(kcalTarget * 0.68);
  const proteinIn = Math.round(proteinTarget * 0.58);

  const goTo = (m: 'fitness' | 'economy', p?: string) => {
    setModule(m);
    if (m === 'fitness' && p) setFitnessPage(p as never);
    if (m === 'economy' && p) setPage(p as never);
  };

  return (
    <div className="relative min-h-full bg-bg text-ink overflow-hidden">
      <div className="vh-aurora" />

      <div className="relative z-10 px-4 sm:px-6 lg:px-10 py-6">
        {/* header */}
        <header className="mb-5 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-faint">{today}</p>
            <h1 className="font-display text-3xl sm:text-4xl mt-2 leading-none">{hi}, <span className="italic text-gold">{name}.</span></h1>
          </div>
          <button onClick={() => goTo('fitness', 'workoutlog')}
            className="inline-flex items-center gap-2 font-semibold text-sm rounded-2xl px-5 py-3 text-[#2a1d08]"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)', boxShadow: '0 14px 30px -14px rgba(233,193,120,.7)' }}>
            <IPlay size={15} /> Starta dagens pass
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">

          {/* HERO — big, 3D fills it */}
          <section className="vh-card lg:col-span-8 relative min-h-[360px] flex flex-col overflow-hidden"
            style={{ background: 'radial-gradient(130% 110% at 82% 0%, rgba(155,140,255,.22), transparent 55%), linear-gradient(165deg,#17151f,#0e0e13)' }}>
            <div className="absolute inset-0"><Hero3D /></div>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 60% at 50% 40%, transparent 40%, rgba(10,10,13,.55) 100%)' }} />
            <div className="relative z-10 flex items-start justify-between p-5">
              <span className="text-[10px] uppercase tracking-[0.14em] text-faint">◆ Rotera med musen · live 3D</span>
              <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(95,224,208,.15)', color: 'var(--cyan)' }}>På rätt spår</span>
            </div>
            <div className="relative z-10 mt-auto p-6 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-mut">Dagens form-index</p>
                <p className="font-display text-6xl leading-none mt-1">86<span className="text-2xl text-mut"> / 100</span></p>
                <p className="text-sm text-mut mt-2 max-w-xs">Du ligger före på protein och sparkvot. Ett pass kvar den här veckan.</p>
              </div>
              <div className="w-40">
                <p className="text-[10px] uppercase tracking-[0.14em] text-faint mb-1">Veckans aktivitet</p>
                {spark([3, 5, 2, 6, 4, 7, 5], '#e9c178', 160, 44)}
              </div>
            </div>
          </section>

          {/* RIGHT stack */}
          <div className="lg:col-span-4 grid grid-rows-[auto_auto] gap-4 lg:gap-5">
            <button onClick={() => goTo('economy', 'overview')} className="vh-card text-left p-5">
              <div className="flex items-center justify-between">
                <span className="vh-tile vh-tile--gold w-11 h-11"><IWallet size={22} /></span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(95,224,208,.15)', color: 'var(--cyan)' }}>▲ {savingsRate}% sparkvot</span>
              </div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-mut mt-4">Kvar att spendera</p>
              <p className="font-display text-4xl tnum mt-1">{sv(remaining)} <span className="text-base text-faint">kr</span></p>
              {spark([12, 9, 14, 11, 16, 13, 18], '#e9c178', 240, 40)}
              <div className="mt-3 text-[12px] text-mut">
                <div className="flex justify-between py-1 border-t border-line"><span>Inkomster</span><span className="tnum text-ink">{sv(income)} kr</span></div>
                <div className="flex justify-between py-1 border-t border-line"><span>Utgifter</span><span className="tnum text-ink">{sv(expenses)} kr</span></div>
              </div>
            </button>

            <section className="vh-card p-5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-mut">Dagens mål</p>
              <div className="flex gap-2 justify-between mt-3 flex-wrap">
                {ring(Math.round((kcalIn / kcalTarget) * 100), 'var(--gold)', `${Math.round((kcalIn / kcalTarget) * 100)}%`, `Kcal · ${sv(kcalTarget)}`)}
                {ring(Math.round((proteinIn / proteinTarget) * 100), 'var(--cyan)', `${proteinIn}g`, `Protein · ${proteinTarget}g`)}
                {ring(75, 'var(--violet)', '¾', 'Pass')}
              </div>
            </section>
          </div>

          {/* KPI row with sparklines */}
          <Stat className="lg:col-span-3" tile="coral" icon={<IHeart size={22} />} label="Vilopuls" value="54" unit="bpm" chip="▲ 2" good series={[58, 57, 56, 55, 55, 54, 54]} color="#ff8f7a" />
          <Stat className="lg:col-span-3" tile="gold" icon={<IBolt size={22} />} label="Steg idag" value="9 240" chip="▲ 12%" good series={[6, 8, 5, 9, 7, 10, 9]} color="#e9c178" />
          <Stat className="lg:col-span-3" tile="violet" icon={<IMoon size={22} />} label="Sömn" value="88" unit="/100" chip="7h 42m" good series={[80, 84, 79, 88, 85, 90, 88]} color="#9b8cff" />
          <Stat className="lg:col-span-3" tile="cyan" icon={<IDumbbell size={22} />} label={weight ? 'Vikt · 7d' : 'Vikt'} value={weight ? sv(weight) : '—'} unit="kg" chip={targetWeight ? `mål ${sv(targetWeight)}` : ''} series={[85.1, 84.9, 84.8, 84.6, 84.5, 84.3, 84.2]} color="#5fe0d0" />

          {/* cashflow chart wide */}
          <section className="vh-card lg:col-span-8 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.14em] text-mut">Kassaflöde · 12 månader</p>
              <span className="text-[12px] text-mut">in <span className="text-cyan tnum">{sv(income)}</span> · ut <span className="text-coral tnum">{sv(expenses)}</span></span>
            </div>
            <svg viewBox="0 0 800 200" width="100%" height="190" preserveAspectRatio="none" className="mt-3">
              <defs><linearGradient id="cf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#e9c178" stopOpacity=".3" /><stop offset="1" stopColor="#e9c178" stopOpacity="0" /></linearGradient></defs>
              <g stroke="rgba(244,241,234,.06)"><line x1="0" y1="50" x2="800" y2="50" /><line x1="0" y1="100" x2="800" y2="100" /><line x1="0" y1="150" x2="800" y2="150" /></g>
              <path d="M0,150 C70,140 110,95 180,105 C250,115 300,60 370,72 C440,84 490,45 560,55 C630,65 690,38 800,48 L800,200 L0,200 Z" fill="url(#cf)" />
              <path d="M0,150 C70,140 110,95 180,105 C250,115 300,60 370,72 C440,84 490,45 560,55 C630,65 690,38 800,48" fill="none" stroke="#f4d79a" strokeWidth="2.5" />
              <path d="M0,170 C80,166 120,172 190,165 C260,158 320,168 390,162 C460,156 500,166 570,158 C640,150 700,160 800,154" fill="none" stroke="#5fe0d0" strokeWidth="2" strokeOpacity=".75" />
            </svg>
          </section>

          {/* schedule */}
          <section className="vh-card lg:col-span-4 p-5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mut mb-1">Idag</p>
            <Row dot="var(--lime)" m1="Frukost loggad" m2="480 kcal · 32 g protein" tm="07:30" />
            <Row dot="var(--gold)" m1="Lunch: Kyckling & ris" m2="620 kcal" tm="12:15" />
            <Row dot="var(--violet)" m1="Push A" m2="Gym · Push/Pull/Ben" tm="17:30" />
            <Row dot="var(--coral)" m1="Hyra" m2="Påminnelse" tm="25 nov" last />
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ className, tile, icon, label, value, unit, chip, good, series, color }:
  { className?: string; tile: string; icon: React.ReactNode; label: string; value: string; unit?: string; chip?: string; good?: boolean; series: number[]; color: string }) {
  const min = Math.min(...series), max = Math.max(...series), rng = max - min || 1;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * 120},${36 - ((v - min) / rng) * 32 - 2}`).join(' ');
  return (
    <div className={`vh-card p-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <span className={`vh-tile vh-tile--${tile} w-10 h-10`}>{icon}</span>
        {chip && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: good ? 'rgba(95,224,208,.15)' : 'rgba(255,143,122,.15)', color: good ? 'var(--cyan)' : 'var(--coral)' }}>{chip}</span>}
      </div>
      <p className="text-[10px] uppercase tracking-[0.13em] text-mut mt-3">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="font-display tnum text-[26px] mt-0.5">{value}{unit && <span className="text-[12px] text-faint"> {unit}</span>}</p>
        <svg viewBox="0 0 120 36" width="96" height="30" preserveAspectRatio="none" className="flex-none opacity-80">
          <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function Row({ dot, m1, m2, tm, last }: { dot: string; m1: string; m2: string; tm: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 ${last ? '' : 'border-b border-line'}`}>
      <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: dot }} />
      <div><p className="text-[13px] font-semibold">{m1}</p><p className="text-[11px] text-faint">{m2}</p></div>
      <span className="ml-auto text-[12px] text-mut tnum">{tm}</span>
    </div>
  );
}
