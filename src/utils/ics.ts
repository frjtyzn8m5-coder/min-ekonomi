// ── iCalendar (ICS) parser ─────────────────────────────────────────────────────
// Hand-written, dependency-free parser for the subset of RFC 5545 we care about.
//
// Supported:
//   - VEVENT blocks: SUMMARY, DTSTART, DTEND, DESCRIPTION, LOCATION, URL, UID
//   - All-day (VALUE=DATE / YYYYMMDD) vs timed (DATE-TIME) events
//   - Line unfolding (RFC 5545 §3.1: continuation lines start with space/tab)
//   - Property parameters (NAME;PARAM=VALUE:…) e.g. VALUE=DATE, TZID
//   - Text unescaping (\n \, \; \\)
//   - RRULE: FREQ, INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY
//
// Limitations (documented, not bugs):
//   - TZID is ignored → DATE-TIME without a trailing "Z" is treated as the
//     viewer's LOCAL time (floating). No IANA tz database is bundled.
//   - RRULE BYDAY ordinal prefixes ("2MO", "-1FR") are reduced to the weekday
//     (the nth-of-month position is dropped).
//   - BYMONTH / BYSETPOS / BYYEARDAY / BYWEEKNO and FREQ=HOURLY|MINUTELY|SECONDLY
//     are not expanded (such events import as single occurrences).
//   - EXDATE / RDATE / RECURRENCE-ID overrides are ignored.

import type { RecurrenceRule, RecurrenceFreq } from '../types';

export interface ParsedIcsEvent {
  uid?: string;
  title: string;
  start: string;        // ISO datetime
  end: string;          // ISO datetime
  allDay: boolean;
  description?: string;
  location?: string;
  url?: string;
  recurrence?: RecurrenceRule;
}

// ── Line unfolding ──────────────────────────────────────────────────────────────

function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

// ── Property line: NAME;PARAM=x;PARAM2=y:VALUE ──────────────────────────────────

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseProp(line: string): Prop | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(';');
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1);
  }
  return { name, params, value };
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// ── Date / date-time parsing ────────────────────────────────────────────────────

interface ParsedDate {
  iso: string;
  dateOnly: boolean;
}

function parseIcsDate(value: string, params: Record<string, string>): ParsedDate | null {
  const v = value.trim();
  // All-day: VALUE=DATE or bare YYYYMMDD
  const dateOnly = params.VALUE === 'DATE' || /^\d{8}$/.test(v);
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);
  if (!m) return null;
  const [, Y, Mo, D, h, mi, s, z] = m;
  const year = +Y, month = +Mo - 1, day = +D;
  if (dateOnly || h === undefined) {
    // Local midnight of that calendar day.
    return { iso: new Date(year, month, day, 0, 0, 0, 0).toISOString(), dateOnly: true };
  }
  const hour = +h, min = +mi, sec = +s;
  if (z === 'Z') {
    return { iso: new Date(Date.UTC(year, month, day, hour, min, sec)).toISOString(), dateOnly: false };
  }
  // Floating / TZID → treat as local.
  return { iso: new Date(year, month, day, hour, min, sec).toISOString(), dateOnly: false };
}

// ── RRULE ────────────────────────────────────────────────────────────────────────

const BYDAY_MAP: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };

function parseRRule(value: string): RecurrenceRule | undefined {
  const parts: Record<string, string> = {};
  for (const seg of value.split(';')) {
    const eq = seg.indexOf('=');
    if (eq === -1) continue;
    parts[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
  }
  const freqRaw = (parts.FREQ || '').toUpperCase();
  const freqMap: Record<string, RecurrenceFreq> = {
    DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly',
  };
  const freq = freqMap[freqRaw];
  if (!freq) return undefined; // unsupported FREQ → import as single event

  const rule: RecurrenceRule = { freq };
  if (parts.INTERVAL) {
    const n = parseInt(parts.INTERVAL, 10);
    if (!isNaN(n) && n > 0) rule.interval = n;
  }
  if (parts.COUNT) {
    const n = parseInt(parts.COUNT, 10);
    if (!isNaN(n) && n > 0) rule.count = n;
  }
  if (parts.UNTIL) {
    const m = parts.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) rule.until = `${m[1]}-${m[2]}-${m[3]}`;
  }
  if (parts.BYDAY && freq === 'weekly') {
    const days = parts.BYDAY.split(',')
      .map(d => d.trim().toUpperCase().replace(/^[+-]?\d+/, '')) // drop ordinal prefix
      .map(d => BYDAY_MAP[d])
      .filter((n): n is number => n !== undefined);
    if (days.length) rule.byWeekday = [...new Set(days)].sort((a, b) => a - b);
  }
  if (parts.BYMONTHDAY && freq === 'monthly') {
    const n = parseInt(parts.BYMONTHDAY, 10);
    if (!isNaN(n)) rule.byMonthDay = n;
  }
  return rule;
}

// ── Main parser ────────────────────────────────────────────────────────────────

export function parseICS(text: string): ParsedIcsEvent[] {
  const lines = unfold(text);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let cur: Partial<ParsedIcsEvent> & { _dtstart?: ParsedDate; _dtend?: ParsedDate } = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') { inEvent = true; cur = {}; continue; }
    if (trimmed === 'END:VEVENT') {
      inEvent = false;
      finalize(cur, events);
      cur = {};
      continue;
    }
    if (!inEvent) continue;

    const prop = parseProp(line);
    if (!prop) continue;

    switch (prop.name) {
      case 'SUMMARY': cur.title = unescapeText(prop.value); break;
      case 'DESCRIPTION': cur.description = unescapeText(prop.value); break;
      case 'LOCATION': cur.location = unescapeText(prop.value); break;
      case 'URL': cur.url = prop.value.trim(); break;
      case 'UID': cur.uid = prop.value.trim(); break;
      case 'DTSTART': {
        const d = parseIcsDate(prop.value, prop.params);
        if (d) cur._dtstart = d;
        break;
      }
      case 'DTEND':
      case 'DUE': {
        const d = parseIcsDate(prop.value, prop.params);
        if (d) cur._dtend = d;
        break;
      }
      case 'RRULE': {
        const r = parseRRule(prop.value);
        if (r) cur.recurrence = r;
        break;
      }
      default: break;
    }
  }

  return events;
}

function finalize(
  cur: Partial<ParsedIcsEvent> & { _dtstart?: ParsedDate; _dtend?: ParsedDate },
  out: ParsedIcsEvent[],
): void {
  if (!cur._dtstart) return; // no start → invalid event
  const allDay = cur._dtstart.dateOnly;
  const startD = new Date(cur._dtstart.iso);

  let endIso: string;
  if (cur._dtend) {
    if (allDay) {
      // All-day DTEND is EXCLUSIVE in iCal → last day = DTEND - 1 day, 23:59:59 local.
      const end = new Date(cur._dtend.iso);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 0);
      // Guard against DTEND == DTSTART (single all-day day).
      endIso = end.getTime() < startD.getTime()
        ? new Date(startD.getFullYear(), startD.getMonth(), startD.getDate(), 23, 59, 59).toISOString()
        : end.toISOString();
    } else {
      endIso = cur._dtend.iso;
    }
  } else if (allDay) {
    endIso = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate(), 23, 59, 59).toISOString();
  } else {
    endIso = new Date(startD.getTime() + 60 * 60 * 1000).toISOString();
  }

  out.push({
    uid: cur.uid,
    title: cur.title?.trim() || '(Namnlös)',
    start: cur._dtstart.iso,
    end: endIso,
    allDay,
    description: cur.description,
    location: cur.location,
    url: cur.url,
    recurrence: cur.recurrence,
  });
}
