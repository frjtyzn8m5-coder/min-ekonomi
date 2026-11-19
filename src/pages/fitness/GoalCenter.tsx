import { useMemo } from 'react';
import { Target, Flame, Activity, Gauge, TrendingDown, TrendingUp, Minus, Scale, CalendarDays, Utensils, ClipboardList, Info } from 'lucide-react';
import { useStore } from '../../store/useStore';
import PageBanner from '../../components/ui/PageBanner';
import { computeTargets, macroCaloriePercents } from '../../utils/nutritionEngine';
import type { PrimaryGoal } from '../../types';

// ─── Målcentrum ───────────────────────────────────────────────────────────────
// Editorial hub för hela den mål-drivna kedjan: kropp + mål → BMR → TDEE →
// dagliga kalori-/makromål (via utils/nutritionEngine). Visar uträkningen med
// förklaring, makrofördelning och en viktprognos, och låter användaren justera
// mål / målvikt / takt (skrivs till profilen → motorn räknar om allt).

const fmt = (n: number, d = 0) => n.toLocaleString('sv-SE', { maximumFractionDigits: d, minimumFractionDigits: d });

const GOALS: { value: PrimaryGoal; label: string; emoji: string }[] = [
  { value: 'lose_fat', label: 'Minska fett', emoji: '🔥' },
  { value: 'recomp', label: 'Rekomp', emoji: '♻️' },
  { value: 'maintain', label: 'Bibehåll', emoji: '⚖️' },
  { value: 'gain_muscle', label: 'Bygg muskler', emoji: '💪' },
  { value: 'general_health', label: 'Hälsa', emoji: '🌿' },
];

// ─── Makro-ring (donut) ──────────────────────────────────────────────────────────
function MacroRing({ protein, fat, carb, kcal }: { protein: number; fat: number; carb: number; kcal: number }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const segs = [
    { pct: protein, color: 'var(--cyan)' },
    { pct: carb, color: 'var(--gold)' },
    { pct: fat, color: 'var(--violet)' },
  ];
  let offset = 0;
  return (
    <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(244,241,234,.08)" strokeWidth="14" />
        {segs.map((s, i) => {
          const len = (s.pct / 100) * C;
          const el = (
            <circle
              key={i}
              cx="70" cy="70" r={R} fill="none"
              stroke={s.color} strokeWidth="14"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              style={{ transition: 'stroke-dasharray .5s ease, stroke-dashoffset .5s ease' }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl text-ink tnum leading-none">{fmt(kcal)}</span>
        <span className="text-[10px] text-faint mt-0.5">kcal / dag</span>
      </div>
    </div>
  );
}

// ─── Statruta ───────────────────────────────────────────────────────────────────
function Stat({ icon: Icon, label, value, sub, tint }: {
  icon: typeof Flame; label: string; value: string; sub?: string; tint: string;
}) {
  return (
    <div className="vh-card p-4 flex items-start gap-3">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-faint">{label}</p>
        <p className="font-display text-lg text-ink tnum leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-mut mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Makrostapel ──────────────────────────────────────────────────────────────────
function MacroBar({ label, grams, pct, color, perKg }: {
  label: string; grams: number; pct: number; color: string; perKg?: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-mut">{label}{perKg && <span className="text-faint"> · {perKg}</span>}</span>
        <span className="text-xs font-semibold text-ink tnum">{fmt(grams)} g <span className="text-faint">· {pct}%</span></span>
      </div>
      <div className="h-2 bg-soft rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

// ─── Stepper ────────────────────────────────────────────────────────────────────
function Stepper({ value, onChange, step, min, max, suffix, fractionDigits = 1 }: {
  value: number; onChange: (v: number) => void; step: number; min: number; max: number; suffix: string; fractionDigits?: number;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(clamp(value - step))}
        className="w-9 h-9 rounded-xl bg-soft flex items-center justify-center text-mut hover:bg-white/10 text-lg"
      >−</button>
      <span className="min-w-[88px] text-center font-display text-ink tnum">
        {fmt(value, fractionDigits)} <span className="text-xs text-faint">{suffix}</span>
      </span>
      <button
        onClick={() => onChange(clamp(value + step))}
        className="w-9 h-9 rounded-xl bg-soft flex items-center justify-center text-mut hover:bg-white/10 text-lg"
      >+</button>
    </div>
  );
}

export default function GoalCenter() {
  const { userProfile, updateUserProfile, setFitnessPage } = useStore();

  const targets = useMemo(
    () => (userProfile ? computeTargets(userProfile, Date.now()) : null),
    [userProfile],
  );

  // ── Guard: ingen profil / otillräckligt underlag ──
  if (!userProfile || !targets) {
    return (
      <div className="min-h-full bg-bg text-ink pb-24 lg:pb-8">
        <PageBanner
          img="/img/f-lift2.jpg" eyebrow="Mål" title="Målcentrum"
          subtitle="Sätt och följ upp dina hälso- och träningsmål."
          onBack={() => setFitnessPage('home')}
        />
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 lg:px-10 pt-7">
          <div className="vh-card p-10 flex flex-col items-center text-center">
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-cyan mb-4" style={{ background: 'rgba(95,224,208,.12)' }}>
              <Target size={24} />
            </span>
            <h2 className="font-display text-xl text-ink">Komplettera din profil</h2>
            <p className="text-sm text-faint mt-2 max-w-[42ch]">
              Vi behöver vikt, längd och födelsedatum för att räkna ut ditt energibehov och dina mål.
            </p>
            <button
              onClick={() => setFitnessPage('onboarding')}
              className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#2a1d08]"
              style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
            >
              Till profilen
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pct = macroCaloriePercents(targets);
  const weight = userProfile.currentWeight ?? 0;
  const targetWeight = userProfile.targetWeight ?? weight;
  const weeklyTarget = userProfile.weeklyWeightChangeTarget ?? targets.weeklyChangeKg;

  // ── Viktprognos ──
  const diff = targetWeight - weight;               // + = gå upp, − = gå ner
  const rate = targets.weeklyChangeKg;              // effektiv takt (kg/vecka)
  const sameDirection = rate !== 0 && Math.sign(diff) === Math.sign(rate);
  const weeksToGoal = sameDirection ? Math.abs(diff / rate) : null;
  const goalDate = weeksToGoal != null
    ? new Date(Date.now() + weeksToGoal * 7 * 86400000).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // Prognospunkter (4/8/12 veckor) för en liten tidslinje.
  const milestones = [4, 8, 12].map(w => ({ w, kg: Math.round((weight + rate * w) * 10) / 10 }));

  const DeltaIcon = targets.dailyDeltaKcal < -5 ? TrendingDown : targets.dailyDeltaKcal > 5 ? TrendingUp : Minus;
  const deltaTint = targets.dailyDeltaKcal < -5 ? 'var(--coral)' : targets.dailyDeltaKcal > 5 ? 'var(--lime)' : 'var(--gold)';

  return (
    <div className="min-h-full bg-bg text-ink pb-24 lg:pb-8">
      <PageBanner
        img="/img/f-lift2.jpg" eyebrow="Mål" title="Målcentrum"
        subtitle="Din kropp och ditt mål → energibehov och dagliga kalori- och makromål."
        onBack={() => setFitnessPage('home')}
      />

      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10 pt-7 space-y-6">

        {/* ── Hero: ring + stats ── */}
        <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-stretch">
          <div className="vh-card p-6 flex flex-col items-center justify-center text-center">
            <MacroRing protein={pct.protein} fat={pct.fat} carb={pct.carb} kcal={targets.calorieTarget} />
            <div className="flex items-center gap-4 mt-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-mut"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--cyan)' }} />Protein</span>
              <span className="flex items-center gap-1.5 text-mut"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--gold)' }} />Kolh</span>
              <span className="flex items-center gap-1.5 text-mut"><span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--violet)' }} />Fett</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 content-start">
            <Stat icon={Gauge} label="BMR" tint="var(--cyan)"
              value={`${fmt(targets.bmr)} kcal`}
              sub={targets.bmrFormula === 'katch' ? 'Katch–McArdle (fettfri massa)' : 'Mifflin–St Jeor'} />
            <Stat icon={Activity} label={targets.tdeeSource === 'adaptive' ? 'TDEE (adaptiv)' : 'TDEE (uppskattad)'} tint="var(--lime)"
              value={`${fmt(targets.tdee)} kcal`}
              sub="Totalt dagligt energibehov" />
            <Stat icon={Flame} label="Dagligt mål" tint="var(--gold)"
              value={`${fmt(targets.calorieTarget)} kcal`}
              sub={`Underhåll: ${fmt(targets.maintenanceKcal)} kcal`} />
            <Stat icon={DeltaIcon} label="Kaloridelta" tint={deltaTint}
              value={`${targets.dailyDeltaKcal >= 0 ? '+' : ''}${fmt(targets.dailyDeltaKcal)} kcal`}
              sub={`≈ ${targets.weeklyChangeKg >= 0 ? '+' : ''}${fmt(targets.weeklyChangeKg, 2)} kg/vecka`} />
          </div>
        </div>

        {/* ── Rationale ── */}
        <div className="vh-card p-5 flex gap-3">
          <Info size={18} className="text-gold flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-faint uppercase tracking-wide mb-1">Så räknade vi</p>
            <p className="text-sm text-mut leading-relaxed">{targets.rationale}</p>
          </div>
        </div>

        {/* ── Makrofördelning ── */}
        <div className="vh-card p-5">
          <h3 className="font-display text-lg text-ink mb-4">Makromål</h3>
          <div className="grid sm:grid-cols-3 gap-5">
            <MacroBar label="Protein" grams={targets.proteinG} pct={pct.protein} color="var(--cyan)"
              perKg={weight > 0 ? `${fmt(targets.proteinPerKg, 1)} g/kg` : undefined} />
            <MacroBar label="Kolhydrater" grams={targets.carbG} pct={pct.carb} color="var(--gold)" />
            <MacroBar label="Fett" grams={targets.fatG} pct={pct.fat} color="var(--violet)" />
          </div>
        </div>

        {/* ── Kontroller + prognos ── */}
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* Justera mål */}
          <div className="vh-card p-5 space-y-5">
            <h3 className="font-display text-lg text-ink">Justera ditt mål</h3>

            <div>
              <p className="text-xs font-semibold text-mut mb-2">Primärt mål</p>
              <div className="grid grid-cols-3 gap-2">
                {GOALS.map(g => (
                  <button
                    key={g.value}
                    onClick={() => updateUserProfile({ primaryGoal: g.value })}
                    className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                      userProfile.primaryGoal === g.value
                        ? 'text-[#2a1d08] border-transparent'
                        : 'bg-soft text-mut border-line hover:bg-white/5'
                    }`}
                    style={userProfile.primaryGoal === g.value ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
                  >
                    <span className="block text-base leading-none mb-1">{g.emoji}</span>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale size={16} className="text-cyan" />
                <span className="text-sm text-mut">Målvikt</span>
              </div>
              <Stepper
                value={targetWeight} onChange={v => updateUserProfile({ targetWeight: v })}
                step={0.5} min={40} max={200} suffix="kg" fractionDigits={1}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown size={16} className="text-coral" />
                <span className="text-sm text-mut">Takt (vikt/vecka)</span>
              </div>
              <Stepper
                value={weeklyTarget} onChange={v => updateUserProfile({ weeklyWeightChangeTarget: v })}
                step={0.1} min={-1.2} max={0.5} suffix="kg/v" fractionDigits={1}
              />
            </div>
            <p className="text-[11px] text-faint">
              Negativ takt = gå ner, positiv = gå upp. Underskott cappas till 20 % och överskott till 15 % av TDEE för hållbarhet.
            </p>
          </div>

          {/* Prognos */}
          <div className="vh-card p-5 space-y-4">
            <h3 className="font-display text-lg text-ink">Viktprognos</h3>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-[11px] text-faint uppercase tracking-wide">Nu</p>
                <p className="font-display text-2xl text-ink tnum">{fmt(weight, 1)} <span className="text-sm text-faint">kg</span></p>
              </div>
              <div className="flex-1 h-px bg-line mb-3 relative">
                <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 text-faint">→</span>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-faint uppercase tracking-wide">Mål</p>
                <p className="font-display text-2xl text-gold tnum">{fmt(targetWeight, 1)} <span className="text-sm text-faint">kg</span></p>
              </div>
            </div>

            {weeksToGoal != null ? (
              <div className="bg-[rgba(233,193,120,0.08)] border border-gold/20 rounded-xl p-3 flex items-center gap-3">
                <CalendarDays size={18} className="text-gold flex-shrink-0" />
                <p className="text-sm text-mut">
                  Når målet om <span className="font-semibold text-ink tnum">{fmt(weeksToGoal, 0)} veckor</span>
                  {goalDate && <> — omkring <span className="text-ink">{goalDate}</span></>}.
                </p>
              </div>
            ) : (
              <div className="bg-soft border border-line rounded-xl p-3 flex items-center gap-3">
                <Info size={18} className="text-faint flex-shrink-0" />
                <p className="text-sm text-mut">
                  {Math.abs(diff) < 0.1
                    ? 'Du är på din målvikt — kalorierna ligger på underhåll.'
                    : 'Takten och målvikten pekar åt olika håll. Justera målet eller takten för en prognos.'}
                </p>
              </div>
            )}

            {sameDirection && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {milestones.map(m => (
                  <div key={m.w} className="bg-card border border-line rounded-xl p-3 text-center">
                    <p className="text-[11px] text-faint">+{m.w} v</p>
                    <p className="font-display text-base text-ink tnum">{fmt(m.kg, 1)}</p>
                    <p className="text-[10px] text-faint">kg</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Länkar vidare ── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => setFitnessPage('foodlog')}
            className="vh-card p-5 flex items-center gap-4 text-left hover:border-gold/40 transition-colors group"
          >
            <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-gold" style={{ background: 'rgba(233,193,120,.12)' }}>
              <Utensils size={20} />
            </span>
            <div>
              <p className="font-display text-ink">Matdagbok</p>
              <p className="text-xs text-faint mt-0.5">Logga mot {fmt(targets.calorieTarget)} kcal och {fmt(targets.proteinG)} g protein</p>
            </div>
          </button>
          <button
            onClick={() => setFitnessPage('mealplan')}
            className="vh-card p-5 flex items-center gap-4 text-left hover:border-gold/40 transition-colors group"
          >
            <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-cyan" style={{ background: 'rgba(95,224,208,.12)' }}>
              <ClipboardList size={20} />
            </span>
            <div>
              <p className="font-display text-ink">Måltidsplan & matlådor</p>
              <p className="text-xs text-faint mt-0.5">Planera veckan och dela upp batchlagning i portioner</p>
            </div>
          </button>
        </div>

        {/* Draft-notis (org-policy: utdata ska granskas av en person) */}
        <p className="text-[11px] text-faint text-center">
          Utkast — uppskattade värden från formler. Kontrolleras av dig; rådgör med vårdgivare vid behov.
        </p>
      </div>
    </div>
  );
}
