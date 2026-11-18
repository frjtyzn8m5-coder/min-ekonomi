import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import PageBanner from '../../components/ui/PageBanner';
import { IMoon, IHeart, IBolt, IDumbbell, IUtensils, IArrowRight, ITrend } from '../../components/ui/Icons';
import type {
  Contraceptive, CyclePhase, UserProfile, CycleLog, CycleFlow, CycleMood,
  CycleConfidence, CyclePrediction,
} from '../../types';
import {
  computeCycle, toISODate, PHASE_META, LUTEAL_LENGTH, type CycleInfo,
} from '../../utils/cycle';
import {
  predictFromHistory, cycleHistory, periodStartDates, type CycleHistoryRow,
} from '../../utils/cyclePredict';
import { loadCycleLogs, saveCycleLog, deleteCycleLog } from '../../lib/cycleDb';

// ── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return toISODate(new Date());
}

function fmt(d: Date): string {
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
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

const FLOWS: { id: CycleFlow; label: string }[] = [
  { id: 'spotting', label: 'Spotting' },
  { id: 'light', label: 'Lätt' },
  { id: 'medium', label: 'Medel' },
  { id: 'heavy', label: 'Riklig' },
];

const SYMPTOMS = [
  'Kramp', 'Huvudvärk', 'Ömma bröst', 'Uppblåsthet', 'Trötthet',
  'Akne', 'Ryggont', 'Illamående', 'Sötsug', 'Sömnproblem',
];

const MOODS: { id: CycleMood; label: string }[] = [
  { id: 'bra', label: 'Bra' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'låg', label: 'Låg' },
  { id: 'irriterad', label: 'Irriterad' },
  { id: 'ångest', label: 'Ångest' },
];

const CONFIDENCE_META: Record<CycleConfidence, { label: string; color: string }> = {
  low: { label: 'Låg träffsäkerhet', color: '#ff8f7a' },
  medium: { label: 'Medel träffsäkerhet', color: '#e9c178' },
  high: { label: 'Hög träffsäkerhet', color: '#bfe26a' },
};

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

// ── Cycle-length trend (inline SVG bars) ─────────────────────────────────────

function TrendBars({ lengths, avg }: { lengths: number[]; avg: number }) {
  if (lengths.length < 2) {
    return <p className="text-xs text-faint">Logga fler cykler för att se en trend.</p>;
  }
  const W = 240, H = 72, gap = 6;
  const n = lengths.length;
  const bw = (W - gap * (n - 1)) / n;
  const min = Math.min(...lengths, avg) - 2;
  const max = Math.max(...lengths, avg) + 2;
  const span = Math.max(1, max - min);
  const y = (v: number) => H - ((v - min) / span) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
      {/* average line */}
      <line x1={0} y1={y(avg)} x2={W} y2={y(avg)} stroke="rgba(233,193,120,.5)" strokeWidth={1} strokeDasharray="3 3" />
      {lengths.map((v, i) => {
        const x = i * (bw + gap);
        const top = y(v);
        return (
          <g key={i}>
            <rect x={x} y={top} width={bw} height={H - top} rx={3}
              fill="url(#trendGrad)" opacity={0.9} />
          </g>
        );
      })}
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9b8cff" />
          <stop offset="100%" stopColor="#5fe0d0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence, sampleSize }: { confidence: CycleConfidence; sampleSize: number }) {
  const m = CONFIDENCE_META[confidence];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: 'rgba(255,255,255,.05)', color: m.color, border: `1px solid ${m.color}44` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}{sampleSize > 0 ? ` · ${sampleSize} ${sampleSize === 1 ? 'cykel' : 'cykler'}` : ''}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CycleHub() {
  const { setFitnessPage, userProfile, updateUserProfile } = useStore();
  const { user } = useAuthStore();
  const uid = user?.uid;

  const [logs, setLogs] = useState<CycleLog[]>([]);

  // Ladda historik en gång (demoläge → [] via cycleDb-guarden).
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    loadCycleLogs(uid).then(l => { if (alive) setLogs(l); }).catch(() => { /* behåll lokal state */ });
    return () => { alive = false; };
  }, [uid]);

  const profileCycleLen = userProfile?.averageCycleLength ?? 28;
  const profilePeriodLen = userProfile?.averagePeriodLength ?? 5;

  // Historik-baserad prognos (ren funktion, now injiceras).
  const prediction = useMemo<CyclePrediction>(
    () => predictFromHistory(
      logs,
      { averageCycleLength: profileCycleLen, averagePeriodLength: profilePeriodLen },
      new Date(),
    ),
    [logs, profileCycleLen, profilePeriodLen],
  );

  const starts = useMemo(() => periodStartDates(logs), [logs]);
  const history = useMemo<CycleHistoryRow[]>(() => cycleHistory(logs), [logs]);

  // Senaste faktiska start: från logg, annars profilens sparade datum.
  const effectiveLastStart = starts.length ? starts[starts.length - 1] : userProfile?.lastPeriodStartDate;

  // Hjul/fas/fertilt fönster bygger på de HISTORIK-härledda snitten.
  const info = useMemo(
    () => computeCycle(effectiveLastStart, prediction.avgCycleLength, prediction.avgPeriodLength),
    [effectiveLastStart, prediction.avgCycleLength, prediction.avgPeriodLength],
  );

  const meta = info ? PHASE_META[info.phase] : null;
  const win = prediction.predictionWindow;

  // ── Loggning (ett dokument per dag) ───────────────────────────────────────
  const [logDate, setLogDate] = useState<string>(today());
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Omit<CycleLog, 'id' | 'date' | 'updatedAt'>>({});

  // Fyll formuläret från ev. befintlig post när datum/logg ändras.
  useEffect(() => {
    const existing = logs.find(l => l.date === logDate);
    setDraft(existing
      ? {
          periodStart: existing.periodStart, periodEnd: existing.periodEnd,
          flow: existing.flow, symptoms: existing.symptoms, mood: existing.mood,
          energy: existing.energy, bbt: existing.bbt, notes: existing.notes,
        }
      : {});
  }, [logDate, logs]);

  function upsertLocal(prev: CycleLog[], log: CycleLog): CycleLog[] {
    return [...prev.filter(l => l.id !== log.id), log].sort((a, b) => a.date.localeCompare(b.date));
  }

  async function persist(log: CycleLog) {
    setLogs(prev => upsertLocal(prev, log));
    if (uid) { try { await saveCycleLog(uid, log); } catch { /* lokal state kvar */ } }
  }

  async function saveDay() {
    setSaving(true);
    try {
      const log: CycleLog = {
        id: logDate, date: logDate, updatedAt: Date.now(),
        periodStart: draft.periodStart || undefined,
        periodEnd: draft.periodEnd || undefined,
        flow: draft.flow,
        symptoms: draft.symptoms && draft.symptoms.length ? draft.symptoms : undefined,
        mood: draft.mood,
        energy: draft.energy,
        bbt: draft.bbt,
        notes: draft.notes?.trim() ? draft.notes.trim() : undefined,
      };
      await persist(log);
      // Håll profilen i synk när mensstart markeras (resten av appen läser den).
      if (log.periodStart) {
        await updateUserProfile({ lastPeriodStartDate: logDate, cycleTrackingEnabled: true });
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeDay() {
    setSaving(true);
    try {
      setLogs(prev => prev.filter(l => l.id !== logDate));
      if (uid) { try { await deleteCycleLog(uid, logDate); } catch { /* ignore */ } }
      setDraft({});
    } finally {
      setSaving(false);
    }
  }

  // Snabb "mensstart"-logg (används av tomt läge + snabbknapp).
  async function logPeriodStart(dateStr: string) {
    setSaving(true);
    try {
      const existing = logs.find(l => l.date === dateStr);
      const log: CycleLog = {
        ...(existing ?? { id: dateStr, date: dateStr }),
        id: dateStr, date: dateStr, periodStart: true,
        flow: existing?.flow ?? 'medium',
        updatedAt: Date.now(),
      };
      await persist(log);
      await updateUserProfile({ lastPeriodStartDate: dateStr, cycleTrackingEnabled: true });
      setLogDate(dateStr);
    } finally {
      setSaving(false);
    }
  }

  const toggleSymptom = (s: string) =>
    setDraft(d => {
      const cur = d.symptoms ?? [];
      return { ...d, symptoms: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s] };
    });

  const dayHasData = (() => {
    const l = logs.find(x => x.date === logDate);
    return !!l;
  })();

  const avgLens = prediction.observedCycleLengths;

  return (
    <div className="min-h-full bg-bg text-ink pb-24 lg:pb-8">
      <PageBanner
        img="/img/f-run3.jpg"
        eyebrow="Kvinnohälsa"
        title="Cykelspårning"
        subtitle="Logga mens, symtom och mående — få historik-baserade prognoser och fasanpassade råd."
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
                fertila fönster. Ju fler cykler du loggar, desto bättre blir prognosen.
              </p>
              <div className="w-full max-w-[320px] mt-6 space-y-3">
                <input
                  type="date"
                  value={logDate}
                  max={today()}
                  onChange={e => setLogDate(e.target.value || today())}
                  className="w-full px-3 py-2.5 rounded-xl bg-soft border border-line text-sm text-ink outline-none focus:border-gold"
                />
                <button
                  onClick={() => logPeriodStart(logDate)}
                  disabled={saving}
                  className="w-full py-3 text-[#2a1d08] text-sm font-semibold rounded-xl transition-opacity disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
                >
                  Logga mensstart
                </button>
              </div>
            </div>
            <CycleSettings
              cycleLength={profileCycleLen}
              periodLength={profilePeriodLen}
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
                    <div className="w-px h-8 bg-line" />
                    <div>
                      <p className="font-display text-xl text-ink tnum">{info.periodLength}</p>
                      <p className="text-[10px] text-faint uppercase tracking-wide">menslängd</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <ConfidenceBadge confidence={prediction.confidence} sampleSize={prediction.sampleSize} />
                  </div>
                </div>
              )}
            </div>

            {/* Predictions + quick log */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Predictions */}
              <div className="vh-card p-6 sm:col-span-2">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <p className="text-xs font-medium text-mut uppercase tracking-wide">Prognos</p>
                  <span className="text-[11px] text-faint">
                    {prediction.source === 'history' ? 'Baserat på din historik' : 'Baserat på dina inställningar'} · ±{win} {win === 1 ? 'dag' : 'dagar'}
                  </span>
                </div>
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
                      <p className="text-[10px] text-faint mt-1">± {win} {win === 1 ? 'dag' : 'dagar'}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-faint mt-4">
                  Estimaten bygger på en lutealfas på ~{LUTEAL_LENGTH} dagar och är inte preventivmedel.
                </p>
              </div>

              {/* Quick period-start log */}
              <div className="vh-card p-6">
                <p className="text-xs font-medium text-mut uppercase tracking-wide mb-3">Snabblogg mensstart</p>
                <input
                  type="date"
                  value={logDate}
                  max={today()}
                  onChange={e => setLogDate(e.target.value || today())}
                  className="w-full px-3 py-2.5 rounded-xl bg-soft border border-line text-sm text-ink outline-none focus:border-gold"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => logPeriodStart(today())}
                    disabled={saving}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-line text-ink bg-soft hover:bg-white/5 transition-colors disabled:opacity-40"
                  >
                    Mens idag
                  </button>
                  <button
                    onClick={() => logPeriodStart(logDate)}
                    disabled={saving}
                    className="flex-1 py-2.5 text-[#2a1d08] text-sm font-semibold rounded-xl transition-opacity disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
                  >
                    Markera start
                  </button>
                </div>
                <p className="text-[11px] text-faint mt-3">
                  Senaste start: {effectiveLastStart ? fmtShort(effectiveLastStart) : '–'}
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

            {/* ── Logga idag: flöde / symtom / humör / energi / BBT ───────────── */}
            <div className="lg:col-span-7 vh-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="vh-tile vh-tile--violet w-11 h-11"><IMoon size={20} /></span>
                  <div>
                    <p className="text-[11px] text-faint uppercase tracking-wide">Dagslogg</p>
                    <p className="font-display text-lg text-ink leading-tight">Logga idag</p>
                  </div>
                </div>
                <input
                  type="date"
                  value={logDate}
                  max={today()}
                  onChange={e => setLogDate(e.target.value || today())}
                  className="px-3 py-2 rounded-xl bg-soft border border-line text-sm text-ink outline-none focus:border-gold"
                />
              </div>

              {/* period start/end */}
              <div className="flex flex-wrap gap-2 mb-4">
                <ChipToggle active={!!draft.periodStart} tint="var(--coral)"
                  onClick={() => setDraft(d => ({ ...d, periodStart: !d.periodStart }))}>
                  Mensstart
                </ChipToggle>
                <ChipToggle active={!!draft.periodEnd} tint="var(--coral)"
                  onClick={() => setDraft(d => ({ ...d, periodEnd: !d.periodEnd }))}>
                  Mens slutar
                </ChipToggle>
              </div>

              {/* flow */}
              <p className="text-[11px] text-faint uppercase tracking-wide mb-2">Flöde</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {FLOWS.map(f => (
                  <ChipToggle key={f.id} active={draft.flow === f.id} tint="var(--coral)"
                    onClick={() => setDraft(d => ({ ...d, flow: d.flow === f.id ? undefined : f.id }))}>
                    {f.label}
                  </ChipToggle>
                ))}
              </div>

              {/* symptoms */}
              <p className="text-[11px] text-faint uppercase tracking-wide mb-2">Symtom</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {SYMPTOMS.map(s => (
                  <ChipToggle key={s} active={(draft.symptoms ?? []).includes(s)} tint="var(--violet)"
                    onClick={() => toggleSymptom(s)}>
                    {s}
                  </ChipToggle>
                ))}
              </div>

              {/* mood */}
              <p className="text-[11px] text-faint uppercase tracking-wide mb-2">Humör</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {MOODS.map(m => (
                  <ChipToggle key={m.id} active={draft.mood === m.id} tint="var(--cyan)"
                    onClick={() => setDraft(d => ({ ...d, mood: d.mood === m.id ? undefined : m.id }))}>
                    {m.label}
                  </ChipToggle>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* energy */}
                <div>
                  <p className="text-[11px] text-faint uppercase tracking-wide mb-2">Energi</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setDraft(d => ({ ...d, energy: d.energy === n ? undefined : n }))}
                        className={`w-9 h-9 rounded-xl text-sm font-semibold border transition-colors ${
                          draft.energy === n ? 'text-[#2a1d08] border-transparent' : 'text-mut border-line bg-soft hover:bg-white/5'
                        }`}
                        style={draft.energy === n ? { background: 'var(--lime)' } : undefined}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {/* bbt */}
                <div>
                  <p className="text-[11px] text-faint uppercase tracking-wide mb-2">Basaltemperatur (°C)</p>
                  <input
                    type="number" step={0.01} min={34} max={42}
                    value={draft.bbt ?? ''}
                    onChange={e => setDraft(d => ({ ...d, bbt: e.target.value === '' ? undefined : Number(e.target.value) }))}
                    placeholder="36.60"
                    className="w-full px-3 py-2.5 rounded-xl bg-soft border border-line text-sm text-ink outline-none focus:border-gold tnum"
                  />
                </div>
              </div>

              {/* notes */}
              <p className="text-[11px] text-faint uppercase tracking-wide mb-2">Anteckning</p>
              <textarea
                value={draft.notes ?? ''}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2}
                placeholder="Valfri notering …"
                className="w-full px-3 py-2.5 rounded-xl bg-soft border border-line text-sm text-ink outline-none focus:border-gold resize-none"
              />

              <div className="flex gap-2 mt-4">
                <button
                  onClick={saveDay}
                  disabled={saving}
                  className="flex-1 py-2.5 text-[#2a1d08] text-sm font-semibold rounded-xl transition-opacity disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
                >
                  Spara dagslogg
                </button>
                {dayHasData && (
                  <button
                    onClick={removeDay}
                    disabled={saving}
                    className="py-2.5 px-4 text-sm font-semibold rounded-xl border border-line text-mut bg-soft hover:bg-white/5 transition-colors disabled:opacity-40"
                  >
                    Ta bort
                  </button>
                )}
              </div>
            </div>

            {/* ── Historik + trend ──────────────────────────────────────────── */}
            <div className="lg:col-span-5 vh-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <ITrend size={16} className="text-gold" />
                <p className="font-display text-lg text-ink">Historik</p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <Stat label="Snitt cykel" value={`${prediction.avgCycleLength}`} unit="dgr" />
                <Stat label="Variation" value={`±${Math.max(1, Math.round(prediction.cycleLengthStdDev))}`} unit="dgr" />
                <Stat label="Snitt mens" value={`${prediction.avgPeriodLength}`} unit="dgr" />
              </div>

              <p className="text-[11px] text-faint uppercase tracking-wide mb-2">Cykellängd över tid</p>
              <div className="mb-5">
                <TrendBars lengths={avgLens} avg={prediction.avgCycleLength} />
              </div>

              <p className="text-[11px] text-faint uppercase tracking-wide mb-2">Senaste cykler</p>
              {history.length === 0 ? (
                <p className="text-xs text-faint">Inga loggade cykler ännu.</p>
              ) : (
                <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {[...history].reverse().map(row => (
                    <div key={row.start} className="flex items-center justify-between text-sm rounded-xl px-3 py-2"
                      style={{ background: 'var(--soft)' }}>
                      <span className="text-mut">{fmtShort(row.start)}</span>
                      <span className="flex items-center gap-3 tnum">
                        <span className="text-ink">
                          {row.cycleLength !== null ? `${row.cycleLength} dgr` : <span className="text-faint">pågående</span>}
                        </span>
                        <span className="text-faint text-[12px]">
                          {row.periodLength !== null ? `mens ${row.periodLength}d` : '—'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
                cycleLength={profileCycleLen}
                periodLength={profilePeriodLen}
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
            stöd för träning och kost — inte medicinsk rådgivning eller preventivmedel. Prognoser bygger på
            dina loggade cykler och blir säkrare med mer data. Rådgör med vårdpersonal vid oregelbunden cykel,
            uteblivna mens eller andra besvär.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────

function ChipToggle({
  active, tint, onClick, children,
}: {
  active: boolean;
  tint: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors ${
        active ? 'text-ink' : 'text-mut border-line bg-soft hover:bg-white/5'
      }`}
      style={active ? { background: 'rgba(255,255,255,.06)', borderColor: tint, color: '#fff' } : undefined}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl p-3 border border-line text-center" style={{ background: 'var(--soft)' }}>
      <p className="font-display text-ink tnum" style={{ fontSize: 22, lineHeight: 1 }}>{value}</p>
      <p className="text-[10px] text-faint">{unit}</p>
      <p className="text-[11px] text-mut mt-1">{label}</p>
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
      <p className="text-[11px] text-faint mb-4 -mt-2">
        Används som utgångsvärden tills du loggat nog med cykler — därefter styr din historik prognosen.
      </p>
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
