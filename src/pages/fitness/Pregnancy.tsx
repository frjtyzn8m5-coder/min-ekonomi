import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import PageBanner from '../../components/ui/PageBanner';
import { IHeart, IMoon, IDumbbell, IUtensils, ITrend, IArrowRight } from '../../components/ui/Icons';
import { parseDate, toISODate, addDays, daysBetween } from '../../utils/cycle';

// ── Pregnancy math ────────────────────────────────────────────────────────────
// Standard: 280 days (40 weeks) from the first day of the last menstrual period
// (LMP). Due date (EDD) = LMP + 280 days. Gestational age is counted from LMP.

const TERM_DAYS = 280;

function today(): string {
  return toISODate(new Date());
}

interface PregInfo {
  lmp: Date;
  dueDate: Date;
  week: number;      // completed weeks (0-40+)
  dayOfWeek: number; // 0-6 within the current week
  totalDays: number; // days since LMP
  trimester: 1 | 2 | 3;
  daysUntilDue: number;
}

function computeFromDue(dueISO: string | undefined): PregInfo | null {
  if (!dueISO) return null;
  const dueDate = parseDate(dueISO);
  if (isNaN(dueDate.getTime())) return null;
  const lmp = addDays(dueDate, -TERM_DAYS);
  return buildInfo(lmp, dueDate);
}

function computeFromLmp(lmpISO: string | undefined): PregInfo | null {
  if (!lmpISO) return null;
  const lmp = parseDate(lmpISO);
  if (isNaN(lmp.getTime())) return null;
  const dueDate = addDays(lmp, TERM_DAYS);
  return buildInfo(lmp, dueDate);
}

function buildInfo(lmp: Date, dueDate: Date): PregInfo {
  const now = parseDate(today());
  const totalDays = Math.max(0, daysBetween(lmp, now));
  const week = Math.floor(totalDays / 7);
  const dayOfWeek = totalDays % 7;
  const trimester: 1 | 2 | 3 = week < 14 ? 1 : week < 28 ? 2 : 3;
  return { lmp, dueDate, week, dayOfWeek, totalDays, trimester, daysUntilDue: daysBetween(now, dueDate) };
}

// ── Week-by-week table (1–40) ─────────────────────────────────────────────────

interface WeekRow { w: number; size: string; dev: string }

const WEEK_DATA: WeekRow[] = [
  { w: 1, size: '—', dev: 'Räknas från senaste mensstart. Befruktning har ännu inte skett.' },
  { w: 2, size: '—', dev: 'Ägglossning och befruktning sker vanligtvis nu.' },
  { w: 3, size: 'Knappnålshuvud', dev: 'Det befruktade ägget fäster i livmoderslemhinnan.' },
  { w: 4, size: 'Vallmofrö', dev: 'Embryot bildas; moderkaka och fostersäck utvecklas.' },
  { w: 5, size: 'Sesamfrö', dev: 'Neuralröret (hjärna/ryggmärg) börjar formas. Hjärtat anläggs.' },
  { w: 6, size: 'Linsfrö', dev: 'Hjärtslag kan ofta ses på ultraljud. Ansiktsdrag börjar.' },
  { w: 7, size: 'Blåbär', dev: 'Armar och ben börjar som små knoppar. Hjärnan växer snabbt.' },
  { w: 8, size: 'Hallon', dev: 'Fingrar och tår börjar formas. Alla större organ anläggs.' },
  { w: 9, size: 'Vindruva', dev: 'Embryo blir foster. Leder böjs, grundläggande anatomi klar.' },
  { w: 10, size: 'Jordgubbe', dev: 'Naglar och hårsäckar börjar. Organen mognar vidare.' },
  { w: 11, size: 'Lime', dev: 'Fostret rör sig (känns ännu inte). Tandanlag bildas.' },
  { w: 12, size: 'Plommon', dev: 'Reflexer utvecklas. Njurarna börjar producera urin.' },
  { w: 13, size: 'Citron', dev: 'Fingeravtryck bildas. Slutet av första trimestern.' },
  { w: 14, size: 'Persika', dev: 'Ansiktsmuskler aktiveras. Fostret kan grimasera.' },
  { w: 15, size: 'Äpple', dev: 'Skelettet förbenas. Fostret kan uppfatta ljus.' },
  { w: 16, size: 'Avokado', dev: 'Du kan börja känna fosterrörelser snart. Hörsel utvecklas.' },
  { w: 17, size: 'Päron', dev: 'Fettlager börjar byggas. Navelsträngen blir starkare.' },
  { w: 18, size: 'Paprika', dev: 'Hörseln fungerar; fostret hör ljud utifrån.' },
  { w: 19, size: 'Mango', dev: 'Skyddande fosterfett (vernix) täcker huden.' },
  { w: 20, size: 'Banan', dev: 'Halvvägs. Rutinultraljud brukar göras runt nu.' },
  { w: 21, size: 'Morot', dev: 'Tydliga sparkar. Fostret sväljer fostervatten.' },
  { w: 22, size: 'Spaghettisquash', dev: 'Ögonbryn och ögonlock klara. Greppreflex utvecklas.' },
  { w: 23, size: 'Grapefrukt', dev: 'Lungorna utvecklar blodkärl inför andning.' },
  { w: 24, size: 'Majskolv', dev: 'Livsduglighetsgräns närmar sig. Innerörat färdigt — balans.' },
  { w: 25, size: 'Blomkål', dev: 'Fettlager fyller ut huden. Reagerar på röster.' },
  { w: 26, size: 'Salladshuvud', dev: 'Ögonen öppnas. Lungorna producerar surfaktant.' },
  { w: 27, size: 'Blomkålshuvud', dev: 'Slutet av andra trimestern. Regelbunden sömnrytm.' },
  { w: 28, size: 'Aubergine', dev: 'Tredje trimestern. Drömsömn (REM) förekommer.' },
  { w: 29, size: 'Butternutpumpa', dev: 'Muskler och lungor mognar snabbt. Benstomme förstärks.' },
  { w: 30, size: 'Stor gurka', dev: 'Fostervattnet minskar när fostret växer. Mer kraftfulla sparkar.' },
  { w: 31, size: 'Kokosnöt', dev: 'Snabb hjärnutveckling. Alla sinnen fungerar.' },
  { w: 32, size: 'Jicama', dev: 'Övar på att andas. Naglarna når fingertopparna.' },
  { w: 33, size: 'Ananas', dev: 'Skallbenen är mjuka och rörliga inför födseln.' },
  { w: 34, size: 'Cantaloupemelon', dev: 'Centrala nervsystemet och lungorna mognar.' },
  { w: 35, size: 'Honungsmelon', dev: 'Lägger på sig ~200 g/vecka. Vänder sig ofta huvudet nedåt.' },
  { w: 36, size: 'Romansallad', dev: 'Anses nästan fullgången. Mjukdun (lanugo) försvinner.' },
  { w: 37, size: 'Mangold', dev: 'Tidig fullgången. Övar grepp, sug och andning.' },
  { w: 38, size: 'Purjolök', dev: 'Organen färdiga. Lägger på fett de sista veckorna.' },
  { w: 39, size: 'Minivattenmelon', dev: 'Fullgången. Redo för födsel när som helst.' },
  { w: 40, size: 'Pumpa', dev: 'Beräknad förlossning. Endast ~5 % föds på exakt datum.' },
];

// ── Trimester guidance ────────────────────────────────────────────────────────

const TRIMESTER_GUIDE: Record<1 | 2 | 3, { label: string; weeks: string; training: string; nutrition: string }> = {
  1: {
    label: 'Första trimestern',
    weeks: 'Vecka 1–13',
    training: 'Fortsätt röra dig i den takt du är van vid. Måttlig kondition och styrka är säkert — undvik att bli överhettad och pressa inte vid illamående/trötthet.',
    nutrition: 'Folsyra (400 µg/dag) är viktigast nu. Ät regelbundet mot illamående, välj järn- och proteinrikt. Undvik opastöriserat, rått kött och alkohol.',
  },
  2: {
    label: 'Andra trimestern',
    weeks: 'Vecka 14–27',
    training: 'Ofta den energirikaste perioden. Bra för styrka och kondition. Undvik övningar på rygg längre stunder och kontaktsport med fallrisk.',
    nutrition: 'Energibehovet ökar ~340 kcal/dag. Prioritera protein, kalcium, järn och omega-3 (fet fisk i måttliga mängder). Drick rikligt.',
  },
  3: {
    label: 'Tredje trimestern',
    weeks: 'Vecka 28–40',
    training: 'Sänk intensiteten och lyssna på kroppen. Promenader, simning, bäckenbotten- och andningsträning förbereder inför födseln.',
    nutrition: 'Energibehovet ökar ~450 kcal/dag. Håll järn och kalcium uppe, ät mindre och oftare vid halsbränna. Fortsätt med folsyra/vitamin D enligt råd.',
  },
};

// ── Weight-gain guidance (IOM) ─────────────────────────────────────────────────

function weightGainRange(bmi: number | null): { label: string; range: string } {
  if (bmi == null) return { label: 'Okänt BMI', range: '–' };
  if (bmi < 18.5) return { label: 'Undervikt', range: '12,5–18 kg' };
  if (bmi < 25) return { label: 'Normalvikt', range: '11,5–16 kg' };
  if (bmi < 30) return { label: 'Övervikt', range: '7–11,5 kg' };
  return { label: 'Fetma', range: '5–9 kg' };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Pregnancy() {
  const { setFitnessPage, userProfile, updateUserProfile } = useStore();

  const info = useMemo(() => computeFromDue(userProfile?.pregnancyDueDate), [userProfile?.pregnancyDueDate]);
  const active = userProfile?.pregnancyActive && info;

  const [mode, setMode] = useState<'due' | 'lmp'>('due');
  const [dateInput, setDateInput] = useState<string>(userProfile?.pregnancyDueDate ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!dateInput) return;
    const computed = mode === 'due' ? computeFromDue(dateInput) : computeFromLmp(dateInput);
    if (!computed) return;
    setSaving(true);
    try {
      await updateUserProfile({
        pregnancyDueDate: toISODate(computed.dueDate),
        pregnancyActive: true,
      });
    } finally {
      setSaving(false);
    }
  }

  async function endPregnancy() {
    setSaving(true);
    try {
      await updateUserProfile({ pregnancyActive: false });
    } finally {
      setSaving(false);
    }
  }

  // BMI from profile (pre-pregnancy approximation)
  const bmi = userProfile?.height && userProfile?.currentWeight
    ? userProfile.currentWeight / Math.pow(userProfile.height / 100, 2)
    : null;
  const gain = weightGainRange(bmi);

  const currentWeekRow = active ? WEEK_DATA.find(r => r.w === Math.min(40, Math.max(1, info!.week))) : undefined;
  const progress = active ? Math.min(100, (info!.totalDays / TERM_DAYS) * 100) : 0;

  return (
    <div className="min-h-full bg-bg text-ink pb-24 lg:pb-8">
      <PageBanner
        img="/img/f-body6.jpg"
        eyebrow="Kvinnohälsa"
        title="Graviditet"
        subtitle="Följ vecka för vecka — utveckling, träning, kost och viktökning."
        onBack={() => setFitnessPage('home')}
        action={
          <button
            onClick={() => setFitnessPage('cyclehub')}
            className="hidden sm:inline-flex items-center gap-2 text-[13px] font-semibold text-white border border-white/15 rounded-2xl px-4 py-2.5 backdrop-blur hover:bg-white/10 transition-colors"
            style={{ background: 'rgba(255,255,255,.08)' }}
          >
            <IMoon size={15} className="text-violet" /> Cykelspårning
          </button>
        }
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-7">

        {!active ? (
          // ── Setup ───────────────────────────────────────────────────────────
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            <div className="vh-card p-8 flex flex-col items-center text-center">
              <span className="vh-tile vh-tile--coral w-14 h-14 mb-4"><IHeart size={24} /></span>
              <h2 className="font-display text-2xl text-ink">Starta graviditetsspårning</h2>
              <p className="text-sm text-faint mt-2 max-w-[44ch]">
                Ange ditt beräknade förlossningsdatum (BF) eller första dagen i din senaste mens, så
                räknar vi ut vecka, trimester och utveckling.
              </p>

              <div className="w-full max-w-[340px] mt-6">
                <div className="flex gap-2 p-1 rounded-xl bg-soft border border-line mb-3">
                  {([['due', 'Förlossningsdatum'], ['lmp', 'Senaste mens']] as const).map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                      style={mode === m
                        ? { background: 'rgba(233,193,120,.14)', color: 'var(--gold)' }
                        : { color: 'var(--mut)' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-soft border border-line text-sm text-ink outline-none focus:border-gold"
                />
                <button
                  onClick={save}
                  disabled={saving || !dateInput}
                  className="mt-3 w-full py-3 text-[#2a1d08] text-sm font-semibold rounded-xl transition-opacity disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
                >
                  Starta spårning
                </button>
              </div>
            </div>

            <div className="vh-card p-6">
              <p className="text-xs font-medium text-mut uppercase tracking-wide mb-3">Så funkar det</p>
              <ul className="space-y-3 text-sm text-mut leading-relaxed">
                <li>• Graviditeten räknas som 40 veckor (280 dagar) från första dagen i senaste mens.</li>
                <li>• Vi visar aktuell vecka, trimester och en kort utvecklingsöversikt vecka för vecka.</li>
                <li>• Du får trimesteranpassade råd för träning och kost samt riktlinjer för viktökning.</li>
                <li>• Endast ca 5 % föds på exakt beräknat datum — se det som en vägledning.</li>
              </ul>
            </div>
          </div>
        ) : (
          // ── Dashboard ────────────────────────────────────────────────────────
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            {/* Hero status */}
            <div className="lg:col-span-5 vh-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="vh-tile vh-tile--coral w-12 h-12"><IHeart size={22} /></span>
                <div>
                  <p className="text-[11px] text-faint uppercase tracking-wide">{TRIMESTER_GUIDE[info!.trimester].label}</p>
                  <p className="font-display text-ink leading-none" style={{ fontSize: 30 }}>
                    Vecka {info!.week}
                    <span className="text-base text-mut"> +{info!.dayOfWeek} d</span>
                  </p>
                </div>
              </div>

              {/* progress bar */}
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--soft)' }}>
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#f4d79a,#ff8f7a)' }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-faint">
                <span>v.0</span><span>v.20</span><span>v.40</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-5">
                <div className="rounded-2xl p-4 border border-line" style={{ background: 'var(--soft)' }}>
                  <p className="text-[11px] text-faint">Beräknat förlossningsdatum</p>
                  <p className="font-display text-ink mt-0.5" style={{ fontSize: 17 }}>
                    {info!.dueDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <div className="rounded-2xl p-4 border border-line" style={{ background: 'var(--soft)' }}>
                  <p className="text-[11px] text-faint">Kvar till BF</p>
                  <p className="font-display text-ink mt-0.5" style={{ fontSize: 17 }}>
                    {info!.daysUntilDue >= 0 ? `${info!.daysUntilDue} dagar` : 'Över tiden'}
                  </p>
                </div>
              </div>
            </div>

            {/* Current week highlight */}
            <div className="lg:col-span-7 vh-card p-6">
              <p className="text-xs font-medium text-mut uppercase tracking-wide mb-3">Just nu · vecka {info!.week}</p>
              {currentWeekRow ? (
                <>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <p className="font-display text-ink" style={{ fontSize: 24 }}>Stor som: {currentWeekRow.size}</p>
                  </div>
                  <p className="text-sm text-mut leading-relaxed mt-2">{currentWeekRow.dev}</p>
                </>
              ) : (
                <p className="text-sm text-mut">Grattis — du är i eller förbi vecka 40. Kontakt hålls normalt tätare med vården nu.</p>
              )}

              <div className="mt-5 pt-5 border-t border-line">
                <div className="flex items-center gap-2 mb-3">
                  <ITrend size={15} className="text-gold" />
                  <p className="text-sm font-semibold text-ink">Viktökning</p>
                </div>
                <div className="flex items-center justify-between rounded-2xl p-4 border border-line" style={{ background: 'var(--soft)' }}>
                  <div>
                    <p className="text-[11px] text-faint">Rekommenderad total ({gain.label})</p>
                    <p className="font-display text-ink" style={{ fontSize: 20 }}>{gain.range}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-faint">Ditt BMI (ca)</p>
                    <p className="font-display text-ink tnum" style={{ fontSize: 20 }}>{bmi ? bmi.toFixed(1) : '–'}</p>
                  </div>
                </div>
                <p className="text-[11px] text-faint mt-2">
                  Riktlinjer enligt IOM, baserat på BMI före graviditet. Lite viktökning sker i första trimestern,
                  mest under andra och tredje.
                </p>
              </div>
            </div>

            {/* Trimester guidance */}
            <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="vh-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="vh-tile vh-tile--gold w-11 h-11"><IDumbbell size={20} /></span>
                  <div>
                    <p className="text-[11px] text-faint uppercase tracking-wide">Träning · {TRIMESTER_GUIDE[info!.trimester].label}</p>
                    <p className="font-display text-lg text-ink leading-tight">Rörelse som passar nu</p>
                  </div>
                </div>
                <p className="text-sm text-mut leading-relaxed">{TRIMESTER_GUIDE[info!.trimester].training}</p>
              </div>
              <div className="vh-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="vh-tile vh-tile--lime w-11 h-11"><IUtensils size={20} /></span>
                  <div>
                    <p className="text-[11px] text-faint uppercase tracking-wide">Kost · {TRIMESTER_GUIDE[info!.trimester].label}</p>
                    <p className="font-display text-lg text-ink leading-tight">Näring i fokus</p>
                  </div>
                </div>
                <p className="text-sm text-mut leading-relaxed">{TRIMESTER_GUIDE[info!.trimester].nutrition}</p>
              </div>
            </div>

            {/* Week-by-week table */}
            <div className="lg:col-span-12 vh-card p-6">
              <p className="font-display text-lg text-ink mb-4">Vecka för vecka</p>
              <div className="overflow-x-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 min-w-[280px]">
                  {WEEK_DATA.map(row => {
                    const isNow = row.w === Math.min(40, Math.max(1, info!.week));
                    const done = row.w < info!.week;
                    const tri = row.w < 14 ? 1 : row.w < 28 ? 2 : 3;
                    const triColor = tri === 1 ? 'var(--lime)' : tri === 2 ? 'var(--cyan)' : 'var(--coral)';
                    return (
                      <div
                        key={row.w}
                        className="rounded-xl p-3 border flex gap-3"
                        style={{
                          background: isNow ? 'rgba(255,143,122,.10)' : 'var(--soft)',
                          borderColor: isNow ? 'var(--coral)' : 'var(--line)',
                          opacity: done ? 0.6 : 1,
                        }}
                      >
                        <div className="flex flex-col items-center flex-shrink-0 w-9">
                          <span className="font-display text-ink tnum" style={{ fontSize: 18 }}>{row.w}</span>
                          <span className="w-2 h-2 rounded-full mt-1" style={{ background: triColor }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-ink">{row.size}</p>
                          <p className="text-[12px] text-faint leading-snug mt-0.5">{row.dev}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-4 mt-4 flex-wrap">
                {[['Trimester 1', 'var(--lime)'], ['Trimester 2', 'var(--cyan)'], ['Trimester 3', 'var(--coral)']].map(([l, c]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                    <span className="text-[11px] text-faint">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Manage + cross-link */}
            <div className="lg:col-span-7 vh-card p-6">
              <p className="text-xs font-medium text-mut uppercase tracking-wide mb-3">Hantera spårning</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs text-faint mb-1">Justera förlossningsdatum</label>
                  <input
                    type="date"
                    value={userProfile?.pregnancyDueDate ?? ''}
                    onChange={e => e.target.value && updateUserProfile({ pregnancyDueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-soft border border-line text-sm text-ink outline-none focus:border-gold"
                  />
                </div>
                <button
                  onClick={endPregnancy}
                  disabled={saving}
                  className="py-2.5 text-sm font-semibold rounded-xl border border-line text-mut bg-soft hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  Avsluta spårning
                </button>
              </div>
            </div>

            <button
              onClick={() => setFitnessPage('cyclehub')}
              className="lg:col-span-5 vh-card p-6 text-left group flex items-center gap-4"
            >
              <span className="vh-tile vh-tile--violet w-12 h-12"><IMoon size={22} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg text-ink">Cykelspårning</p>
                <p className="text-sm text-faint">Tillbaka till menscykel och fasanpassad träning.</p>
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
            <span className="text-gold font-medium">Obs.</span> Detta är ett allmänt, evidensbaserat stöd —
            inte medicinsk rådgivning. Följ alltid råden från din barnmorska eller läkare, särskilt gällande
            träning, kost, kosttillskott och viktökning under graviditeten.
          </p>
        </div>
      </div>
    </div>
  );
}
