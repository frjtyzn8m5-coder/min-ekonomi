// ── Recurrence expansion ──────────────────────────────────────────────────────
// Pure, deterministic helpers that expand a recurring event into concrete
// occurrences inside a given [rangeStart, rangeEnd] window.
//
// IMPORTANT: the pure core takes everything it needs as arguments. No Date.now(),
// no Math.random() — the caller passes the range explicitly so results are stable
// and testable.
//
// Weekday convention everywhere in this app: 0 = Mån .. 6 = Sön (ISO-ish,
// Monday-first) to match the calendar grid and the weekday picker.

import type { RecurrenceRule } from '../types';

export interface RecurrenceBase {
  start: string;          // ISO datetime (seriens första tillfälle / DTSTART)
  end: string;            // ISO datetime
  recurrence?: RecurrenceRule;
}

export interface Occurrence {
  start: string;          // ISO datetime för detta tillfälle
  end: string;            // ISO datetime
}

// Guard against runaway loops (≈ covers daily recurrence over ~55 years).
const MAX_ITER = 20000;

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isoWeekday(d: Date): number {
  // JS getDay(): 0=Sön..6=Lör → 0=Mån..6=Sön
  return (d.getDay() + 6) % 7;
}

function lastDayOfMonth(year: number, month: number): number {
  // month 0-based; day 0 of next month = last day of this month
  return new Date(year, month + 1, 0).getDate();
}

function withTime(year: number, month: number, day: number, base: Date): Date {
  return new Date(year, month, day, base.getHours(), base.getMinutes(), base.getSeconds(), 0);
}

/**
 * Expand a (possibly recurring) event into concrete occurrences overlapping the
 * given window. Deterministic: same inputs → same output.
 *
 * - Occurrences are generated chronologically from the series start (DTSTART).
 * - `count` is honoured against the whole series (as in iCal), not just the window.
 * - `until` is inclusive (end of that day).
 */
export function expandOccurrences(
  base: RecurrenceBase,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const out: Occurrence[] = [];
  const baseStart = new Date(base.start);
  const baseEnd = new Date(base.end);
  if (isNaN(baseStart.getTime())) return out;
  const durationMs = Math.max(0, baseEnd.getTime() - baseStart.getTime());
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  const rule = base.recurrence;

  const pushIfInRange = (startD: Date) => {
    const s = startD.getTime();
    const e = s + durationMs;
    if (s <= rangeEndMs && e >= rangeStartMs) {
      out.push({ start: startD.toISOString(), end: new Date(e).toISOString() });
    }
  };

  // Single (non-recurring) event.
  if (!rule || rule.freq === 'none') {
    pushIfInRange(baseStart);
    return out;
  }

  const interval = Math.max(1, Math.floor(rule.interval ?? 1));
  const count = rule.count && rule.count > 0 ? rule.count : Infinity;
  const untilMs = rule.until ? new Date(`${rule.until}T23:59:59`).getTime() : Infinity;

  let emitted = 0;   // antal tillfällen i serien (för count)
  let guard = 0;
  let stop = false;

  // Returns false when the series should stop.
  const consider = (cand: Date): boolean => {
    if (stop) return false;
    if (guard++ > MAX_ITER) { stop = true; return false; }
    const t = cand.getTime();
    if (t > untilMs) { stop = true; return false; }
    if (emitted >= count) { stop = true; return false; }
    emitted++;
    pushIfInRange(cand);
    if (t > rangeEndMs) { stop = true; return false; } // kronologiskt → klart
    return true;
  };

  switch (rule.freq) {
    case 'daily': {
      let cur = new Date(baseStart);
      while (!stop) {
        if (!consider(cur)) break;
        cur = addDays(cur, interval);
      }
      break;
    }
    case 'weekly': {
      const weekdays = (rule.byWeekday && rule.byWeekday.length)
        ? [...new Set(rule.byWeekday)].sort((a, b) => a - b)
        : [isoWeekday(baseStart)];
      // Måndagen i seriens första vecka (behåller tidskomponenten).
      let weekStart = addDays(baseStart, -isoWeekday(baseStart));
      while (!stop) {
        for (const wd of weekdays) {
          const cand = addDays(weekStart, wd);
          // Hoppa över tillfällen före seriens start.
          if (cand.getTime() < baseStart.getTime()) continue;
          if (!consider(cand)) break;
        }
        weekStart = addDays(weekStart, 7 * interval);
      }
      break;
    }
    case 'monthly': {
      let y = baseStart.getFullYear();
      let m = baseStart.getMonth();
      const dom = rule.byMonthDay ?? baseStart.getDate();
      while (!stop) {
        const ld = lastDayOfMonth(y, m);
        let day: number;
        if (dom < 0) day = ld + 1 + dom; // -1 → sista dagen, -2 → näst sista ...
        else day = dom;
        if (day >= 1 && day <= ld) {
          const cand = withTime(y, m, day, baseStart);
          if (cand.getTime() >= baseStart.getTime()) {
            if (!consider(cand)) break;
          }
        }
        // avancera interval månader
        m += interval;
        y += Math.floor(m / 12);
        m = ((m % 12) + 12) % 12;
      }
      break;
    }
    case 'yearly': {
      let y = baseStart.getFullYear();
      const m = baseStart.getMonth();
      const dom = baseStart.getDate();
      while (!stop) {
        const ld = lastDayOfMonth(y, m);
        if (dom <= ld) {
          const cand = withTime(y, m, dom, baseStart);
          if (!consider(cand)) break;
        }
        y += interval;
      }
      break;
    }
  }

  return out;
}

const SV_WEEKDAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];

/** Kort svensk beskrivning av en återkommande regel, för UI. */
export function describeRecurrence(rule?: RecurrenceRule): string {
  if (!rule || rule.freq === 'none') return 'Engångstillfälle';
  const n = Math.max(1, Math.floor(rule.interval ?? 1));
  let base: string;
  switch (rule.freq) {
    case 'daily':
      base = n === 1 ? 'Varje dag' : `Var ${n}:e dag`;
      break;
    case 'weekly': {
      const days = (rule.byWeekday && rule.byWeekday.length)
        ? rule.byWeekday.slice().sort((a, b) => a - b).map(d => SV_WEEKDAYS[d]).join(', ')
        : '';
      const every = n === 1 ? 'Varje vecka' : `Var ${n}:e vecka`;
      base = days ? `${every} (${days})` : every;
      break;
    }
    case 'monthly': {
      const dom = rule.byMonthDay;
      const every = n === 1 ? 'Varje månad' : `Var ${n}:e månad`;
      if (dom === -1) base = `${every}, sista dagen`;
      else if (dom && dom < 0) base = `${every}, ${-dom}:e sista dagen`;
      else base = `${every}${dom ? `, den ${dom}` : ''}`;
      break;
    }
    case 'yearly':
      base = n === 1 ? 'Varje år' : `Var ${n}:e år`;
      break;
    default:
      base = 'Återkommande';
  }
  if (rule.count) base += ` · ${rule.count} ggr`;
  else if (rule.until) base += ` · t.o.m. ${rule.until}`;
  return base;
}
