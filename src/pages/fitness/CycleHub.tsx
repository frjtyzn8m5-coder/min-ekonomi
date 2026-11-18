import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import PageBanner from '../../components/ui/PageBanner';
import { IMoon, IHeart, IBolt, IDumbbell, IUtensils, IArrowRight } from '../../components/ui/Icons';
import type { Contraceptive, CyclePhase, UserProfile } from '../../types';
import {
  computeCycle, toISODate, PHASE_META, LUTEAL_LENGTH, type CycleInfo,
} from '../../utils/cycle';

// ── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return toISODate(new Date());
}

function fmt(d: Date): string {
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

const CONTRACEPTIVES: { id: Contraceptive; label: string }[] = [
  { id: 'none', label: 'Inga' },
  { id: 'combined_pill', label: 'Kombinerade p-piller' },
  { id: 'mini_pill', label: 'Mini-piller' },
  { id: 'hormonal_iud', label: 'Hormonspiral' },
  { id: 'copper_iud', label: 'Kopparspiral' },
  { id: 'implant', label: 'P-stav' },
  { id: 'injection', label: 'P-spruta' },
  { id: 'other', label: 'Annat / vill inte ange' },
];

const PHASE_ORDER: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

// ── Cycle wheel (SVG) ───────────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

function CycleWheel({ info }: { info: CycleInfo }) {
  const { cycleLength, periodLength, ovulationDay, dayInCycle, phase } = info;
  const C = 130, R = 100, SW = 22;
  const deg = 360 / cycleLength;

  const segments = ([
    { phase: 'menstrual', from: 1, to: periodLength },
    { phase: 'follicular', from: periodLength + 1, to: ovulationDay - 2 },
    { phase: 'ovulation', from: ovulationDay - 1, to: ovulationDay + 1 },
    { phase: 'luteal', from: ovulationDay + 2, to: cycleLength },
  ] as { phase: CyclePhase; from: number; to: number }[]).filter(s => s.to >= s.from);

  const markerAngle = (dayInCycle - 0.5) * deg;
  const markerPos = polar(C, C, R, markerAngle);
  const meta = PHASE_META[phase];

  return (
    <div className="relative mx-auto" style={{ width: 260, maxWidth: '100%' }}>
      <svg viewBox="0 0 260 260" className="w-full h-auto">
        {/* track */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(244,241,234,.06)" strokeWidth={SW} />
        {/* phase arcs */}
        {segments.map(s => (
          <path
            key={s.phase}
            d={arcPath(C, C, R, (s.from - 1) * deg, s.to * deg)}
            fill="none"
            stroke={PHASE_META[s.phase].color}
            strokeWidth={SW}
            strokeLinecap="butt"
            opacity={s.phase === phase ? 1 : 0.42}
          />
        ))}
        {/* current-day marker */}
        <circle cx={markerPos.x} cy={markerPos.y} r={11} fill="#0e0e13" stroke={meta.color} strokeWidth={3} />
        <circle cx={markerPos.x} cy={markerPos.y} r={4} fill={meta.color} />
      </svg>
      {/* center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-[10px] tracking-[0.18em] uppercase text-mut">Dag</span>
        <span className="font-display text-ink tnum" style={{ fontSize: 46, lineHeight: 1 }}>{dayInCycle}</span>
        <span className="text-xs font-medium mt-1" style={{ color: meta.color }}>{meta.label}</span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CycleHub() {
  const { setFitnessPage, userProfile, updateUserProfile } = useStore();

  const cycleLength = userProfile?.averageCycleLength ?? 28;
  const periodLength = userProfile?.averagePeriodLength ?? 5;
  const lastStart = userProfile?.lastPeriodStartDate;

  const info = useMemo(
    () => computeCycle(lastStart, cycleLength, periodLength),
    [lastStart, cycleLength, periodLength],
  );

  const [periodInput, setPeriodInput] = useState<string>(lastStart ?? today());
  const [saving, setSaving] = useState(false);

  async function logPeriod(dateStr: string) {
    setSaving(true);
    try {
      await updateUserProfile({
        lastPeriodStartDate: dateStr,
        cycleTrackingEnabled: true,
      });
      setPeriodInput(dateStr);
    } finally {
      setSaving(false);
    }
  }

  const meta = info ? PHASE_META[info.phase] : null;

  return (
    <div className="min-h-full bg-bg text-ink pb-24 lg:pb-8">
      <PageBanner
        img="/img/f-run3.jpg"
        eyebrow="Kvinnohälsa"
        title="Cykelspårning"
        subtitle="Följ din menscykel och anpassa träning, kost och återhämtning efter fas."
        onBack={() => setFitnessPage('home')}
        action={
          <button
            onClick={() => setFitnessPage('pregnancy')}
            className="hidden sm:inline-flex items-center gap-2 text-[13px] font-semibold text-white border border-white/15 rounded-2xl px-4 py-2.5 backdrop-blur hover:bg-white/10 transition-colors"
            style={{ background: 'rgba(255,255,255,.08)' }}
          >
            <IHeart size={15} className="text-coral" /> Graviditet
          </button>
        }
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-7">

        {!info ? (
          // ── Empty state: first-time log ───────────────────────────────────
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <div className="vh-card p-8 flex flex-col items-center text-center">
              <span className="vh-tile vh-tile--violet w-14 h-14 mb-4"><IMoon size={24} /></span>
              <h2 className="font-display text-2xl text-ink">Kom igång</h2>
              <p className="text-sm text-faint mt-2 max-w-[44ch]">
                Logga din senaste mensstart så beräknar vi din nuvarande fas, kommande mens och
                fertila fönster — och ger dig fasanpassade råd.
              </p>
              <div className="w-full max-w-[320px] mt-6 space-y-3">
                <input
                  type="date"
                  value={periodInput}
                  max={today()}
                  onChange={e => setPeriodInput(e.target.value || today())}
                  className="w-full px-3 py-2.5 rounded-xl bg-soft border border-line text-sm text-ink outline-none focus:border-gold"
                />
                <button
                  onClick={() => logPeriod(periodInput)}
                  disabled={saving}
                  className="w-full py-3 text-[#2a1d08] text-sm font-semibold rounded-xl transition-opacity disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
                >
                  Logga mensstart
                </button>
              </div>
            </div>
            <CycleSettings
              cycleLength={cycleLength}
              periodLength={periodLength}
              contraceptive={userProfile?.contraceptive ?? 'none'}
              irregular={userProfile?.cycleIrregular ?? false}
              onChange={updateUserProfile}
            />
          </div>
        ) : (
          // ── Full dashboard ─────────────────────────────────────────────────
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            {/* Wheel + current phase */}
            <div className="lg:col-span-5 vh-card p-6">
              <CycleWheel info={info} />
              {meta && (
                <div className="mt-5 text-center">
                  <p className="text-sm text-mut">{meta.blurb}</p>
                  <div className="mt-4 flex items-center justify-center gap-4 text-center">
                    <div>
                      <p className="font-display text-xl text-ink tnum">{info.daysUntilNextPeriod}</p>
                      <p className="text-[10px] text-faint uppercase tracking-wide">dagar till mens</p>
                    </div>
                    <div className="w-px h-8 bg-line" />
                    <div>
                      <p className="font-display text-xl text-ink tnum">{info.cycleLength}</p>
                      <p className="text-[10px] text-faint uppercase tracking-wide">cykellängd</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Predictions + quick log */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Predictions */}
              <div className="vh-card p-6 sm:col-span-2">
                <p className="text-xs font-medium text-mut uppercase tracking-wide mb-4">Prognos</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Nästa mens', value: fmt(info.nextPeriodDate), tint: 'var(--coral)' },
                    { label: 'Ägglossning (est.)', value: fmt(info.ovulationDate), tint: 'var(--cyan)' },
                    {
                      label: 'Fertilt fönster',
                      value: `${info.fertileStart.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} – ${info.fertileEnd.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`,
                      tint: 'var(--lime)',
                    },
                  ].map(p => (
                    <div key={p.label} className="rounded-2xl p-4 border border-line" style={{ background: 'var(--soft)' }}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full mb-2" style={{ background: p.tint }} />
                      <p className="text-[11px] text-faint">{p.label}</p>
                      <p className="font-display text-ink mt-0.5" style={{ fontSize: 18 }}>{p.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-faint mt-4">
                  Estimaten bygger på en lutealfas på ~{LUTEAL_LENGTH} dagar och är inte preventivmedel.
                </p>
              </div>

              {/* Quick log period */}
              <div className="vh-card p-6">
                <p className="text-xs font-medium text-mut uppercase tracking-wide mb-3">Logga mensstart</p>
                <input
                  type="date"
                  value={periodInput}
                  max={today()}
                  onChange={e => setPeriodInput(e.target.value || today())}
                  className="w-full px-3 py-2.5 rounded-xl bg-soft border border-line text-sm text-ink outline-none focus:border-gold"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => logPeriod(today())}
                    disabled={saving}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-line text-ink bg-soft hover:bg-white/5 transition-colors disabled:opacity-40"
                  >
                    Mens idag
                  </button>
                  <button
                    onClick={() => logPeriod(periodInput)}
                    disabled={saving}
                    className="flex-1 py-2.5 text-[#2a1d08] text-sm font-semibold rounded-xl transition-opacity disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
                  >
                    Spara datum
                  </button>
                </div>
                <p className="text-[11px] text-faint mt-3">
                  Senast loggad: {lastStart ? new Date(lastStart + 'T00:00:00').toLocaleDateString('sv-SE') : '–'}
                </p>
              </div>

              {/* Phase legend */}
              <div className="vh-card p-6">
                <p className="text-xs font-medium text-mut uppercase tracking-wide mb-3">Faser i din cykel</p>
                <div className="space-y-2.5">
                  {PHASE_ORDER.map(p => {
                    const m = PHASE_META[p];
                    const active = info.phase === p;
                    return (
                      <div key={p} className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: m.color, opacity: active ? 1 : 0.5 }} />
                        <span className={`text-sm ${active ? 'text-ink font-semibold' : 'text-mut'}`}>{m.label}</span>
                        {active && <span className="ml-auto text-[10px] text-gold uppercase tracking-wide">Nu</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Phase tips: training + nutrition */}
            {meta && (
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="vh-card p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="vh-tile vh-tile--gold w-11 h-11"><IDumbbell size={20} /></span>
                    <div>
                      <p className="text-[11px] text-faint uppercase tracking-wide">Träning · {meta.label}</p>
                      <p className="font-display text-lg text-ink leading-tight">Så tränar du nu</p>
                    </div>
                  </div>
                  <p className="text-sm text-mut leading-relaxed">{meta.training}</p>
                </div>
                <div className="vh-card p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="vh-tile vh-tile--lime w-11 h-11"><IUtensils size={20} /></span>
                    <div>
                      <p className="text-[11px] text-faint uppercase tracking-wide">Kost · {meta.label}</p>
                      <p className="font-display text-lg text-ink leading-tight">Så äter du nu</p>
                    </div>
                  </div>
                  <p className="text-sm text-mut leading-relaxed">{meta.nutrition}</p>
                </div>
              </div>
            )}

            {/* All-phase overview */}
            <div className="lg:col-span-12 vh-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <IBolt size={16} className="text-gold" />
                <p className="font-display text-lg text-ink">Hela cykeln i korthet</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {PHASE_ORDER.map(p => {
                  const m = PHASE_META[p];
                  const active = info.phase === p;
                  return (
                    <div
                      key={p}
                      className="rounded-2xl p-4 border"
                      style={{
                        background: active ? 'rgba(255,255,255,.04)' : 'var(--soft)',
                        borderColor: active ? m.color : 'var(--line)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                        <p className="text-sm font-semibold text-ink">{m.label}</p>
                      </div>
                      <p className="text-xs text-faint leading-relaxed mb-2">{m.blurb}</p>
                      <p className="text-[12px] text-mut leading-relaxed"><span className="text-ink font-medium">Träning:</span> {m.training}</p>
                      <p className="text-[12px] text-mut leading-relaxed mt-1.5"><span className="text-ink font-medium">Kost:</span> {m.nutrition}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Settings */}
            <div className="lg:col-span-7">
              <CycleSettings
                cycleLength={cycleLength}
                periodLength={periodLength}
                contraceptive={userProfile?.contraceptive ?? 'none'}
                irregular={userProfile?.cycleIrregular ?? false}
                onChange={updateUserProfile}
              />
            </div>

            {/* Pregnancy cross-link */}
            <button
              onClick={() => setFitnessPage('pregnancy')}
              className="lg:col-span-5 vh-card p-6 text-left group flex items-center gap-4"
            >
              <span className="vh-tile vh-tile--coral w-12 h-12"><IHeart size={22} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg text-ink">Graviditetsspårning</p>
                <p className="text-sm text-faint">Vecka, trimester, utveckling och anpassad träning.</p>
              </div>
              <span className="w-9 h-9 rounded-full flex items-center justify-center bg-soft border border-line group-hover:bg-gold transition-colors flex-shrink-0">
                <IArrowRight size={16} className="text-mut group-hover:text-[#2a1d08]" />
              </span>
            </button>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-6 rounded-2xl border border-line p-4" style={{ background: 'rgba(233,193,120,.06)' }}>
          <p className="text-[12px] text-mut leading-relaxed">
            <span className="text-gold font-medium">Obs.</span> Informationen är ett allmänt, evidensbaserat
            stöd för träning och kost — inte medicinsk rådgivning eller preventivmedel. Rådgör med vårdpersonal
            vid oregelbunden cykel, uteblivna mens eller andra besvär.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Settings card ────────────────────────────────────────────────────────────

function CycleSettings({
  cycleLength, periodLength, contraceptive, irregular, onChange,
}: {
  cycleLength: number;
  periodLength: number;
  contraceptive: Contraceptive;
  irregular: boolean;
  onChange: (partial: Partial<UserProfile>) => Promise<void>;
}) {
  return (
    <div className="vh-card p-6">
      <p className="text-xs font-medium text-mut uppercase tracking-wide mb-4">Inställningar</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-faint mb-1">Cykellängd: {cycleLength} dagar</label>
          <input
            type="range" min={21} max={40} value={cycleLength}
            onChange={e => onChange({ averageCycleLength: Number(e.target.value) })}
            className="w-full accent-gold"
          />
        </div>
        <div>
          <label className="block text-xs text-faint mb-1">Menslängd: {periodLength} dagar</label>
          <input
            type="range" min={2} max={10} value={periodLength}
            onChange={e => onChange({ averagePeriodLength: Number(e.target.value) })}
            className="w-full accent-gold"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-faint mb-1">Preventivmedel</label>
          <select
            value={contraceptive}
            onChange={e => onChange({ contraceptive: e.target.value as Contraceptive })}
            className="w-full px-3 py-2 rounded-xl bg-soft border border-line text-sm text-ink outline-none focus:border-gold"
          >
            {CONTRACEPTIVES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <label className="sm:col-span-2 flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={irregular}
            onChange={e => onChange({ cycleIrregular: e.target.checked })}
            className="w-4 h-4 accent-gold"
          />
          <span className="text-sm text-mut">Oregelbunden cykel (prognoser blir mer osäkra)</span>
        </label>
      </div>
    </div>
  );
}
