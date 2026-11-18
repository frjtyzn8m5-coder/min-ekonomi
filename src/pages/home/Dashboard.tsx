import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import Hero3D from '../../components/ui/Hero3D';
import { IDumbbell, IHeart, IBolt, IMoon, IWallet, IUtensils, IPlay, IArrowRight } from '../../components/ui/Icons';

const sv = (n: number) => n.toLocaleString('sv-SE');

function ring(pct: number, color: string, label: string, caption: string) {
  const r = 38, len = 2 * Math.PI * r;
  const off = len * (1 - Math.min(pct, 100) / 100);
  return (
    <div className="text-center flex-1 min-w-[84px]">
      <div className="relative w-[92px] h-[92px] mx-auto">
        <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
          <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(244,241,234,.1)" strokeWidth="9" />
          <circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.3,.8,.3,1)' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display tnum text-[17px]">{label}</div>
      </div>
      <div className="text-[10.5px] text-mut mt-2">{caption}</div>
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

  // ── Real economy figures from the store ──────────────────────────────────────
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTx = transactions.filter(t => t.date.startsWith(ym) && !t.isTransfer);
  const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
  const remaining = Math.max(income - expenses, 0);
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;

  // ── Targets (real where available) ───────────────────────────────────────────
  const kcalTarget = userProfile?.dailyCalorieTarget ?? nutritionSettings.targetCalories;
  const proteinTarget = userProfile?.proteinTargetG ?? nutritionSettings.proteinTarget;
  const weight = userProfile?.currentWeight;
  const targetWeight = userProfile?.targetWeight;

  // Representative day values (pending food-log / wearable wiring)
  const kcalIn = Math.round(kcalTarget * 0.68);
  const proteinIn = Math.round(proteinTarget * 0.58);

  const goTo = (m: 'fitness' | 'economy', p?: string) => {
    setModule(m);
    if (m === 'fitness' && p) setFitnessPage(p as never);
    if (m === 'economy' && p) setPage(p as never);
  };

  return (
    <div className="min-h-full bg-bg text-ink px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-6xl mx-auto">

        {/* header */}
        <header className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-faint">{today}</p>
          <h1 className="font-display text-3xl sm:text-4xl mt-2 leading-none">
            {hi}, <span className="italic text-gold">{name}.</span>
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* HERO with live 3D */}
          <section className="vh-card lg:col-span-2 min-h-[320px] flex flex-col"
            style={{ background: 'radial-gradient(120% 90% at 80% 6%, rgba(155,140,255,.18), transparent 55%), linear-gradient(165deg, #15151b, #101016)' }}>
            <div className="absolute top-3 left-4 z-10 text-[10px] uppercase tracking-[0.12em] text-faint">◆ Rotera med musen · live 3D</div>
            <div className="relative flex-1 min-h-[200px]">
              <Hero3D />
            </div>
            <div className="relative z-10 p-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-mut">Dagens form-index</p>
                <p className="font-display text-4xl sm:text-5xl leading-none mt-1">86<span className="text-xl text-mut"> / 100</span></p>
              </div>
              <button onClick={() => goTo('fitness', 'workoutlog')}
                className="inline-flex items-center gap-2 font-semibold text-[13px] rounded-xl px-4 py-3 text-[#2a1d08]"
                style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)', boxShadow: '0 12px 26px -12px rgba(233,193,120,.7)' }}>
                <IPlay size={15} /> Starta Push A
              </button>
            </div>
          </section>

          {/* economy */}
          <button onClick={() => goTo('economy', 'overview')} className="vh-card text-left p-5 min-h-[320px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="vh-tile vh-tile--gold w-11 h-11"><IWallet size={22} /></span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(95,224,208,.15)', color: 'var(--cyan)' }}>▲ {savingsRate}% sparkvot</span>
              </div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-mut mt-5">Kvar att spendera</p>
              <p className="font-display text-4xl tnum mt-1">{sv(remaining)} <span className="text-base text-faint">kr</span></p>
            </div>
            <div className="text-[12px] text-mut">
              <div className="flex justify-between py-1 border-t border-line"><span>Inkomster</span><span className="tnum text-ink">{sv(income)} kr</span></div>
              <div className="flex justify-between py-1 border-t border-line"><span>Utgifter</span><span className="tnum text-ink">{sv(expenses)} kr</span></div>
            </div>
          </button>

          {/* stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:col-span-3">
            <Stat tile="coral" icon={<IHeart size={22} />} label="Vilopuls" value="54" unit="bpm" chip="▲ 2" good />
            <Stat tile="gold" icon={<IBolt size={22} />} label="Steg" value="9 240" chip="▲ 12%" good />
            <Stat tile="violet" icon={<IMoon size={22} />} label="Sömn" value="88" unit="/100" chip="7h 42m" good />
            <Stat tile="cyan" icon={<IDumbbell size={22} />} label={weight ? 'Vikt · 7d' : 'Vikt'} value={weight ? sv(weight) : '—'} unit="kg" chip={targetWeight ? `mål ${sv(targetWeight)}` : ''} />
          </div>

          {/* goals rings */}
          <section className="vh-card p-5 lg:col-span-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mut">Dagens mål</p>
            <div className="flex gap-2 justify-between mt-3 flex-wrap">
              {ring(Math.round((kcalIn / kcalTarget) * 100), 'var(--gold)', `${Math.round((kcalIn / kcalTarget) * 100)}%`, `Kalorier · ${sv(kcalTarget)}`)}
              {ring(Math.round((proteinIn / proteinTarget) * 100), 'var(--cyan)', `${proteinIn}g`, `Protein · ${proteinTarget} g`)}
              {ring(75, 'var(--violet)', '¾', 'Veckans pass')}
            </div>
          </section>

          {/* featured next workout */}
          <button onClick={() => goTo('fitness', 'program')} className="vh-card text-left p-5 flex flex-col justify-between"
            style={{ background: 'linear-gradient(150deg,#1b160c,#241a0b)', border: '1px solid rgba(233,193,120,.25)' }}>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-gold">Nästa pass · idag</p>
              <h3 className="font-display text-2xl mt-2 leading-tight text-[#f6ead2]">Push A väntar</h3>
              <p className="text-[12.5px] mt-2" style={{ color: '#cdbfa3' }}>Bänkpress · 4 övningar · ~55 min</p>
            </div>
            <span className="inline-flex items-center gap-2 mt-4 font-semibold text-[13px] text-gold">Till programmet <IArrowRight size={16} /></span>
          </button>

          {/* schedule */}
          <section className="vh-card p-5 lg:col-span-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mut mb-1">Idag</p>
            <Row dot="var(--lime)" m1="Frukost loggad" m2="480 kcal · 32 g protein" tm="07:30" />
            <Row dot="var(--gold)" m1="Lunch: Kyckling & ris" m2="620 kcal" tm="12:15" />
            <Row dot="var(--violet)" m1="Push A" m2="Gym · Push/Pull/Ben" tm="17:30" />
            <Row dot="var(--coral)" m1="Hyra" m2="Påminnelse" tm="25 nov" last />
          </section>

        </div>

        <p className="text-center text-faint text-[12px] mt-8">
          <IUtensils size={13} className="inline align-[-2px] mr-1" />
          Ekonomi, vikt och mål visar riktig data. Puls, steg, sömn och dagens intag kopplas när wearable &amp; matlogg wiras in.
        </p>
      </div>
    </div>
  );
}

function Stat({ tile, icon, label, value, unit, chip, good }:
  { tile: string; icon: React.ReactNode; label: string; value: string; unit?: string; chip?: string; good?: boolean }) {
  return (
    <div className="vh-card p-4">
      <div className="flex items-center justify-between">
        <span className={`vh-tile vh-tile--${tile} w-10 h-10`}>{icon}</span>
        {chip && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: good ? 'rgba(95,224,208,.15)' : 'rgba(255,143,122,.15)', color: good ? 'var(--cyan)' : 'var(--coral)' }}>{chip}</span>}
      </div>
      <p className="text-[10px] uppercase tracking-[0.13em] text-mut mt-3">{label}</p>
      <p className="font-display tnum text-[26px] mt-0.5">{value}{unit && <span className="text-[12px] text-faint"> {unit}</span>}</p>
    </div>
  );
}

function Row({ dot, m1, m2, tm, last }: { dot: string; m1: string; m2: string; tm: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 ${last ? '' : 'border-b border-line'}`}>
      <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: dot }} />
      <div>
        <p className="text-[13px] font-semibold">{m1}</p>
        <p className="text-[11px] text-faint">{m2}</p>
      </div>
      <span className="ml-auto text-[12px] text-mut tnum">{tm}</span>
    </div>
  );
}
