import type { CyclePhase } from '../types';

// ── Menstrual-cycle math ────────────────────────────────────────────────────
// Lightweight, evidence-aligned model: the luteal phase is held at a fixed ~14
// days (the most stable part of the cycle), ovulation is estimated at
// cycleLength − 14, and the fertile window spans the 5 days before ovulation
// plus the day itself (sperm/egg viability). This is an ESTIMATE for planning —
// not contraception and not medical advice.

export const LUTEAL_LENGTH = 14;

export interface CycleInfo {
  dayInCycle: number;        // 1-based day of the current cycle
  phase: CyclePhase;
  cycleLength: number;
  periodLength: number;
  ovulationDay: number;      // 1-based day ovulation is estimated on
  fertileStartDay: number;   // 1-based
  fertileEndDay: number;     // 1-based
  // Dates (local, YYYY-MM-DD anchored at midnight)
  currentCycleStart: Date;   // start date of the cycle we're currently in
  nextPeriodDate: Date;
  ovulationDate: Date;
  fertileStart: Date;
  fertileEnd: Date;
  daysUntilNextPeriod: number;
}

function atMidnight(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

export function parseDate(iso: string): Date {
  return atMidnight(new Date(iso + 'T00:00:00'));
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return atMidnight(n);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((atMidnight(b).getTime() - atMidnight(a).getTime()) / 86400000);
}

export function phaseForDay(day: number, cycleLength: number, periodLength: number): CyclePhase {
  const ovulationDay = Math.max(1, cycleLength - LUTEAL_LENGTH);
  if (day <= periodLength) return 'menstrual';
  if (day >= ovulationDay - 1 && day <= ovulationDay + 1) return 'ovulation';
  if (day < ovulationDay - 1) return 'follicular';
  return 'luteal';
}

/**
 * Compute the current cycle info from the last logged period start.
 * Returns null if no valid start date is given.
 */
export function computeCycle(
  lastPeriodStartISO: string | undefined,
  cycleLength = 28,
  periodLength = 5,
  now: Date = new Date(),
): CycleInfo | null {
  if (!lastPeriodStartISO) return null;
  const start = parseDate(lastPeriodStartISO);
  if (isNaN(start.getTime())) return null;

  const cl = Math.max(21, Math.min(45, Math.round(cycleLength) || 28));
  const pl = Math.max(2, Math.min(10, Math.round(periodLength) || 5));
  const today = atMidnight(now);

  // How many whole cycles have elapsed since the logged start → roll forward
  // to the cycle we're currently in (handles users who haven't logged in weeks).
  const elapsed = Math.max(0, daysBetween(start, today));
  const cyclesElapsed = Math.floor(elapsed / cl);
  const currentCycleStart = addDays(start, cyclesElapsed * cl);
  const dayInCycle = daysBetween(currentCycleStart, today) + 1; // 1-based

  const ovulationDay = Math.max(1, cl - LUTEAL_LENGTH);
  const fertileStartDay = Math.max(1, ovulationDay - 5);
  const fertileEndDay = ovulationDay + 1;

  const nextPeriodDate = addDays(currentCycleStart, cl);
  const ovulationDate = addDays(currentCycleStart, ovulationDay - 1);
  const fertileStart = addDays(currentCycleStart, fertileStartDay - 1);
  const fertileEnd = addDays(currentCycleStart, fertileEndDay - 1);

  return {
    dayInCycle,
    phase: phaseForDay(dayInCycle, cl, pl),
    cycleLength: cl,
    periodLength: pl,
    ovulationDay,
    fertileStartDay,
    fertileEndDay,
    currentCycleStart,
    nextPeriodDate,
    ovulationDate,
    fertileStart,
    fertileEnd,
    daysUntilNextPeriod: daysBetween(today, nextPeriodDate),
  };
}

export interface PhaseMeta {
  key: CyclePhase;
  label: string;
  color: string;        // hex
  cssVar: string;       // var(--…)
  blurb: string;
  training: string;
  nutrition: string;
}

export const PHASE_META: Record<CyclePhase, PhaseMeta> = {
  menstrual: {
    key: 'menstrual',
    label: 'Menstruation',
    color: '#ff8f7a',
    cssVar: 'var(--coral)',
    blurb: 'Hormonerna är låga. Energin kan variera — lyssna på kroppen.',
    training: 'Lättare pass eller aktiv vila. Rörlighet, lugn kondition eller teknikfokus. Känns du stark går styrka utmärkt.',
    nutrition: 'Prioritera järnrika livsmedel (rött kött, baljväxter, spenat) och tillräckligt med vätska. Magnesium kan lindra kramp.',
  },
  follicular: {
    key: 'follicular',
    label: 'Follikelfas',
    color: '#bfe26a',
    cssVar: 'var(--lime)',
    blurb: 'Stigande östrogen ger ofta mer energi och snabbare återhämtning.',
    training: 'Bra läge att pusha intensitet och progression — tyngre lyft, nya PR-försök och hårdare intervaller.',
    nutrition: 'Du tål kolhydrater väl — fyll på runt hårda pass för att stötta prestation och muskeluppbyggnad.',
  },
  ovulation: {
    key: 'ovulation',
    label: 'Ägglossning',
    color: '#5fe0d0',
    cssVar: 'var(--cyan)',
    blurb: 'Östrogen toppar — ofta högsta styrka och kraft under cykeln.',
    training: 'Passar för maxstyrka och tunga baslyft. Värm upp noga: lederna kan vara något lösare runt ägglossning.',
    nutrition: 'Håll protein högt och ät runt dina pass. Antiinflammatorisk kost (bär, fet fisk, grönt) stöttar återhämtning.',
  },
  luteal: {
    key: 'luteal',
    label: 'Lutealfas',
    color: '#9b8cff',
    cssVar: 'var(--violet)',
    blurb: 'Progesteron stiger. Vilopuls och kroppstemperatur kan vara högre.',
    training: 'Lägg in mer återhämtning. Volym och teknik framför nya maxlyft — sänk kraven något sista dagarna.',
    nutrition: 'Lite högre energibehov. Extra komplexa kolhydrater och magnesium kan dämpa sug och PMS-symtom.',
  },
};
