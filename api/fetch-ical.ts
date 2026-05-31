import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Lightweight ICS / iCal parser ─────────────────────────────────────────────
// Parses VEVENT blocks without any external dependency.

interface ParsedEvent {
  id: string;
  uid: string;
  title: string;
  start: string;     // ISO datetime
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  url?: string;
}

function unfold(ics: string): string {
  // RFC 5545 line folding: continuation lines start with space or tab
  return ics.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseIcsDateTime(val: string): { iso: string; allDay: boolean } {
  // VALUE=DATE format: YYYYMMDD
  if (/^\d{8}$/.test(val)) {
    const y = val.slice(0, 4), m = val.slice(4, 6), d = val.slice(6, 8);
    return { iso: `${y}-${m}-${d}T00:00:00`, allDay: true };
  }
  // DATE-TIME: YYYYMMDDTHHmmss[Z]
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ? 'Z' : ''}`;
    return { iso, allDay: false };
  }
  // Fallback
  return { iso: new Date().toISOString(), allDay: false };
}

function extractValue(line: string): string {
  // Strip param=value; prefixes
  const colonIdx = line.indexOf(':');
  return colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
}

function parseIcs(ics: string): ParsedEvent[] {
  const lines = unfold(ics).split('\n');
  const events: ParsedEvent[] = [];
  let inEvent = false;
  let current: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      const uid = current['UID'] ?? Math.random().toString(36).slice(2);
      const summaryRaw = current['SUMMARY'] ?? '(Utan titel)';
      // Unescape ICS text
      const title = summaryRaw.replace(/\\,/g, ',').replace(/\\n/g, ' ').replace(/\\\\/g, '\\');

      // Start
      const startKey = Object.keys(current).find(k => k === 'DTSTART' || k.startsWith('DTSTART;')) ?? 'DTSTART';
      const { iso: startIso, allDay } = parseIcsDateTime(current[startKey] ?? '');

      // End
      const endKey = Object.keys(current).find(k => k === 'DTEND' || k.startsWith('DTEND;')) ?? 'DTEND';
      const endRaw = current[endKey] ?? current[startKey] ?? '';
      const { iso: endIso } = parseIcsDateTime(endRaw);

      const location = current['LOCATION']?.replace(/\\,/g, ',').replace(/\\n/g, '\n') || undefined;
      const description = current['DESCRIPTION']?.replace(/\\,/g, ',').replace(/\\n/g, '\n').slice(0, 300) || undefined;
      const url = current['URL'] || undefined;

      events.push({
        id: uid.replace(/[^a-zA-Z0-9_-]/g, '_'),
        uid,
        title,
        start: startIso,
        end: endIso,
        allDay,
        location,
        description,
        url,
      });
      continue;
    }
    if (!inEvent) continue;

    // Parse property key (may have params, e.g. DTSTART;TZID=Europe/Stockholm:...)
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).split(';')[0].toUpperCase();
    const fullKey = line.slice(0, colonIdx).toUpperCase(); // with params
    const val = extractValue(line);
    current[key] = val;
    // Also store full key (with params) for DTSTART/DTEND timezone handling
    if (fullKey !== key) current[fullKey] = val;
  }

  return events;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body ?? {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url' });
  }

  let icsText: string;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Vardagshub/1.0 iCal-importer' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    icsText = await response.text();
  } catch (err: any) {
    return res.status(502).json({ error: `Could not fetch ICS: ${err.message}` });
  }

  if (!icsText.includes('BEGIN:VCALENDAR')) {
    return res.status(422).json({ error: 'Not a valid iCal file' });
  }

  const events = parseIcs(icsText);
  return res.status(200).json({ events });
}
