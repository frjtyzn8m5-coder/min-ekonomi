// ── Historik-baserad cykelprognos (ren, deterministisk) ──────────────────────
// Lär av faktiskt loggade mensstarter istället för en fast 28-dagarscykel:
//   • cykellängder = gap mellan på varandra följande "periodStart"-datum
//   • menslängder  = periodStart → periodEnd (inklusivt)
// Averages matas sedan in i det befintliga computeCycle() så hjul/fas/fertilt
// fönster speglar användarens verkliga cykel. Inga Date.now()-anrop i kärnan —
// `now` skickas in så funktionen är testbar och deterministisk.

import type { CycleLog, CyclePrediction, CycleConfidence } from '../types';
import { parseDate, toISODate, addDays, daysBetween } from './cycle';

const WINDOW = 12;   // antal senaste cykler som vägs in (rullande fönster)
const MIN_GAP = 15;  // rimliga gränser för en cykellängd (dagar)
const MAX_GAP = 60;

export interface CycleProfileDefaults {
  averageCycleLength?: number;
  averagePeriodLength?: number;
}

export interface CycleHistoryRow {
  start: string;              // YYYY-MM-DD
  cycleLength: number | null; // gap till nästa start (null = pågående/senaste)
  periodLength: number | null;// periodStart → periodEnd (inklusivt)
}

// Samma spann som computeCycle() klämmer till.
const clampCycle = (n: number) => Math.max(21, Math.min(45, Math.round(n) || 28));
const clampPeriod = (n: number) => Math.max(2, Math.min(10, Math.round(n) || 5));

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

/** Unika, sorterade datum där mens startade. */
export function periodStartDates(logs: CycleLog[]): string[] {
  return Array.from(new Set(logs.filter(l => l.periodStart).map(l => l.date)))
    .sort((a, b) => a.localeCompare(b));
}

/** Observerade cykellängder (gap mellan starter), orimliga värden bortfiltrerade. */
export function observedCycleLengths(starts: string[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = daysBetween(parseDate(starts[i - 1]), parseDate(starts[i]));
    if (gap >= MIN_GAP && gap <= MAX_GAP) out.push(gap);
  }
  return out;
}

/** Mild outlier-gallring: släng värden > 2 standardavvikelser från medel. */
function trimOutliers(xs: number[]): number[] {
  if (xs.length < 4) return xs;
  const m = mean(xs);
  const sd = stdDev(xs);
  if (sd === 0) return xs;
  const kept = xs.filter(x => Math.abs(x - m) <= 2 * sd);
  return kept.length >= 2 ? kept : xs;
}

function computeConfidence(sampleSize: number, sd: number): CycleConfidence {
  if (sampleSize >= 6 && sd <= 2) return 'high';
  if (sampleSize >= 3 && sd <= 4) return 'medium';
  return 'low';
}

/**
 * Bygg en historik-tabell: en rad per mensstart med cykellängd (gap till nästa
 * start) och menslängd (start → end). Nyast sist. Används av historik-vyn.
 */
export function cycleHistory(logs: CycleLog[]): CycleHistoryRow[] {
  const starts = periodStartDates(logs);
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  return starts.map((start, i) => {
    const next = starts[i + 1];
    const gap = next ? daysBetween(parseDate(start), parseDate(next)) : null;
    const cycleLength = gap !== null && gap >= MIN_GAP && gap <= MAX_GAP ? gap : null;

    let end: string | null = null;
    for (const l of sorted) {
      if (l.date < start) continue;
      if (next && l.date >= next) break;
      if (l.periodEnd) { end = l.date; break; }
    }
    const periodLength = end ? daysBetween(parseDate(start), parseDate(end)) + 1 : null;
    return { start, cycleLength, periodLength };
  });
}

/** Observerade menslängder (start → end, inklusivt) inom rimligt spann. */
export function observedPeriodLengths(logs: CycleLog[]): number[] {
  return cycleHistory(logs)
    .map(r => r.periodLength)
    .filter((n): n is number => n !== null && n >= 1 && n <= 14);
}

/**
 * Huvudfunktion: härled snitt-cykel, snitt-mens, spridning, träffsäkerhet och
 * nästa mensstart ur historiken. Faller tillbaka på profilens värden (eller
 * 28/5) när historiken är otillräcklig.
 */
export function predictFromHistory(
  logs: CycleLog[],
  profileDefaults: CycleProfileDefaults = {},
  now: Date = new Date(),
): CyclePrediction {
  const defCycle = clampCycle(profileDefaults.averageCycleLength ?? 28);
  const defPeriod = clampPeriod(profileDefaults.averagePeriodLength ?? 5);

  const starts = periodStartDates(logs);
  const recentGaps = observedCycleLengths(starts).slice(-WINDOW);
  const gaps = trimOutliers(recentGaps);
  const periodLens = observedPeriodLengths(logs).slice(-WINDOW);

  const hasHistory = gaps.length >= 1;
  const sd = stdDev(gaps);
  const sampleSize = gaps.length;

  const avgCycleLength = hasHistory ? clampCycle(mean(gaps)) : defCycle;
  const avgPeriodLength = periodLens.length >= 1 ? clampPeriod(mean(periodLens)) : defPeriod;

  const confidence = computeConfidence(sampleSize, sd);
  // ± fönster: standardavvikelsen (minst 1 dag) från historik; 3 dagar vid fallback.
  const predictionWindow = hasHistory ? Math.max(1, Math.round(sd || 1)) : 3;

  // Nästa start: rulla fram senaste loggade start i snitt-cykelsteg till
  // första datum som inte redan passerat.
  let predictedNextStart: string | null = null;
  if (starts.length >= 1) {
    const today = parseDate(toISODate(now));
    let next = addDays(parseDate(starts[starts.length - 1]), avgCycleLength);
    let guard = 0;
    while (daysBetween(today, next) < 0 && guard < 120) {
      next = addDays(next, avgCycleLength);
      guard++;
    }
    predictedNextStart = toISODate(next);
  }

  return {
    avgCycleLength,
    avgPeriodLength,
    cycleLengthStdDev: Math.round(sd * 10) / 10,
    sampleSize,
    confidence,
    predictedNextStart,
    predictionWindow,
    observedCycleLengths: recentGaps,
    source: hasHistory ? 'history' : 'profile',
  };
}
