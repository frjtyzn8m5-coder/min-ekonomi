import { useEffect, useMemo, useState } from 'react';
import type { ReactNode, ChangeEvent } from 'react';
import {
  collection, getDocs, setDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  CalendarEvent, CalendarSource, RecurrenceRule, RecurrenceFreq,
} from '../../types';
import {
  loadCalendarEvents, loadLegacyOwnEvents, saveCalendarEvent,
  saveCalendarEventsBatch, deleteCalendarEvent, deleteLegacyOwnEvent,
} from '../../lib/calendarDb';
import { expandOccurrences, describeRecurrence } from '../../utils/recurrence';
import { parseICS } from '../../utils/ics';
import PageBanner from '../../components/ui/PageBanner';
import { nanoid } from 'nanoid';
import {
  Plus, Settings, X, Trash2, Globe, Loader2, ChevronLeft, ChevronRight,
  Upload, Repeat, MapPin, Download, CalendarDays, Power,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ── Källor ─────────────────────────────────────────────────────────────────────

const OWN_SOURCE: CalendarSource = {
  id: 'own', type: 'own', name: 'Egna events', color: '#e9c178', enabled: true,
};
const IMPORTED_SOURCE: CalendarSource = {
  id: 'imported', type: 'ics', name: 'Importerat', color: '#9b8cff', enabled: true,
};

// v4-palett för event-färger
const COLORS = ['#e9c178', '#9b8cff', '#5fe0d0', '#ff8f7a', '#bfe26a', '#f4d79a'];

const SV_MONTHS = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];
const SV_DAYS_SHORT = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const SV_DAYS_LETTER = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

// ── Datum-hjälpare (allt lokalt, undviker UTC-off-by-one) ───────────────────────

function pad(n: number): string { return String(n).padStart(2, '0'); }
function ymd(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function toLocalInput(d: Date): string { return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function dateFromYmd(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); }
function isoWeekday(d: Date): number { return (d.getDay() + 6) % 7; }
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}
function formatDateLong(d: Date): string {
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Render-tillfälle ────────────────────────────────────────────────────────────

interface Occ {
  key: string;
  ev: CalendarEvent;
  start: string;
  end: string;
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Recurrence-editor
// ═══════════════════════════════════════════════════════════════════════════════

function RecurrenceEditor({
  freq, setFreq, interval, setInterval, weekdays, toggleWeekday,
  monthDay, setMonthDay, lastDay, setLastDay, endMode, setEndMode,
  count, setCount, until, setUntil,
}: {
  freq: RecurrenceFreq; setFreq: (f: RecurrenceFreq) => void;
  interval: number; setInterval: (n: number) => void;
  weekdays: Set<number>; toggleWeekday: (d: number) => void;
  monthDay: number; setMonthDay: (n: number) => void;
  lastDay: boolean; setLastDay: (b: boolean) => void;
  endMode: 'never' | 'count' | 'until'; setEndMode: (m: 'never' | 'count' | 'until') => void;
  count: number; setCount: (n: number) => void;
  until: string; setUntil: (s: string) => void;
}) {
  const FREQS: { v: RecurrenceFreq; label: string }[] = [
    { v: 'none', label: 'Ingen' },
    { v: 'daily', label: 'Dagligen' },
    { v: 'weekly', label: 'Veckovis' },
    { v: 'monthly', label: 'Månadsvis' },
    { v: 'yearly', label: 'Årligen' },
  ];
  const unitLabel: Record<RecurrenceFreq, string> = {
    none: '', daily: 'dag', weekly: 'vecka', monthly: 'månad', yearly: 'år',
  };

  return (
    <div className="rounded-xl border border-line bg-soft/60 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs text-mut">
        <Repeat size={13} className="text-gold" /> Upprepning
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FREQS.map(f => (
          <button
            key={f.v}
            type="button"
            onClick={() => setFreq(f.v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${freq === f.v ? 'text-[#2a1d08] border-transparent' : 'border-line text-mut hover:bg-white/5'}`}
            style={freq === f.v ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {freq !== 'none' && (
        <>
          <div className="flex items-center gap-2 text-sm text-mut">
            <span>Var</span>
            <input
              type="number" min={1} value={interval}
              onChange={e => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-16 bg-soft border border-line rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
            <span>{unitLabel[freq]}{interval > 1 ? (freq === 'monthly' ? ':e månad' : freq === 'yearly' ? ':e år' : freq === 'weekly' ? ':e vecka' : ':e dag') : ''}</span>
          </div>

          {freq === 'weekly' && (
            <div className="flex gap-1.5">
              {SV_DAYS_LETTER.map((d, i) => (
                <button
                  key={i} type="button" onClick={() => toggleWeekday(i)}
                  title={SV_DAYS_SHORT[i]}
                  className={`w-8 h-8 rounded-full text-xs font-semibold border transition-colors ${weekdays.has(i) ? 'text-[#2a1d08] border-transparent' : 'border-line text-mut hover:bg-white/5'}`}
                  style={weekdays.has(i) ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {freq === 'monthly' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-mut">
                <span>Den</span>
                <input
                  type="number" min={1} max={31} value={monthDay} disabled={lastDay}
                  onChange={e => setMonthDay(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 bg-soft border border-line rounded-lg px-2 py-1.5 text-sm text-ink disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
                <span>i månaden</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-mut cursor-pointer">
                <input type="checkbox" checked={lastDay} onChange={e => setLastDay(e.target.checked)} className="accent-[#cf9a3f]" />
                Sista dagen i månaden
              </label>
            </div>
          )}

          {/* Slut */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap gap-1.5">
              {([['never', 'Aldrig'], ['count', 'Efter antal'], ['until', 'Till datum']] as const).map(([v, l]) => (
                <button
                  key={v} type="button" onClick={() => setEndMode(v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${endMode === v ? 'text-[#2a1d08] border-transparent' : 'border-line text-mut hover:bg-white/5'}`}
                  style={endMode === v ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
                >
                  {l}
                </button>
              ))}
            </div>
            {endMode === 'count' && (
              <div className="flex items-center gap-2 text-sm text-mut">
                <input
                  type="number" min={1} value={count}
                  onChange={e => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-20 bg-soft border border-line rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
                <span>tillfällen</span>
              </div>
            )}
            {endMode === 'until' && (
              <input
                type="date" value={until} onChange={e => setUntil(e.target.value)}
                className="bg-soft border border-line rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EventModal – skapa / redigera event + påminnelse
// ═══════════════════════════════════════════════════════════════════════════════

interface EventModalProps {
  initialDate?: string;
  event?: CalendarEvent;
  onSave: (e: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

function EventModal({ initialDate, event, onSave, onDelete, onClose }: EventModalProps) {
  const now = new Date();
  const defStart = initialDate ? new Date(`${initialDate}T08:00`) : now;
  const evStart = event ? new Date(event.start) : defStart;
  const evEnd = event ? new Date(event.end) : new Date(defStart.getTime() + 3600000);

  const [title, setTitle] = useState(event?.title ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startStr, setStartStr] = useState(toLocalInput(evStart));
  const [endStr, setEndStr] = useState(toLocalInput(evEnd));
  const [startDate, setStartDate] = useState(ymd(evStart));
  const [endDate, setEndDate] = useState(ymd(evEnd));
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [color, setColor] = useState(event?.color ?? '#e9c178');
  const [active, setActive] = useState(event?.active ?? true);

  // Recurrence state
  const r = event?.recurrence;
  const [freq, setFreq] = useState<RecurrenceFreq>(r?.freq ?? 'none');
  const [interval, setInterval] = useState(r?.interval ?? 1);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set(r?.byWeekday ?? []));
  const [monthDay, setMonthDay] = useState(r?.byMonthDay && r.byMonthDay > 0 ? r.byMonthDay : evStart.getDate());
  const [lastDay, setLastDay] = useState(r?.byMonthDay === -1);
  const [endMode, setEndMode] = useState<'never' | 'count' | 'until'>(r?.count ? 'count' : r?.until ? 'until' : 'never');
  const [count, setCount] = useState(r?.count ?? 10);
  const [until, setUntil] = useState(r?.until ?? '');

  const readOnly = !!event && event.source !== 'own' && !event.imported;

  function toggleWeekday(d: number) {
    setWeekdays(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  }

  function buildRecurrence(baseStart: Date): RecurrenceRule | undefined {
    if (freq === 'none') return undefined;
    const rule: RecurrenceRule = { freq };
    if (interval > 1) rule.interval = interval;
    if (freq === 'weekly') {
      const wd = weekdays.size ? [...weekdays].sort((a, b) => a - b) : [isoWeekday(baseStart)];
      rule.byWeekday = wd;
    }
    if (freq === 'monthly') rule.byMonthDay = lastDay ? -1 : monthDay;
    if (endMode === 'count') rule.count = Math.max(1, count);
    else if (endMode === 'until' && until) rule.until = until;
    return rule;
  }

  function handleSave() {
    if (!title.trim()) return;
    let start: Date, end: Date;
    if (allDay) {
      start = dateFromYmd(startDate);
      const e = dateFromYmd(endDate < startDate ? startDate : endDate);
      end = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59);
    } else {
      start = new Date(startStr);
      end = endStr ? new Date(endStr) : new Date(start.getTime() + 3600000);
      if (end < start) end = new Date(start.getTime() + 3600000);
    }
    const recurrence = buildRecurrence(start);
    const e: CalendarEvent = {
      id: event?.id ?? nanoid(),
      title: title.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      source: event?.source ?? 'own',
      sourceId: event?.sourceId ?? 'own',
      color,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      recurrence,
      active,
      imported: event?.imported,
      uid: event?.uid,
      createdAt: event?.createdAt ?? Date.now(),
    };
    onSave(e);
  }

  if (readOnly) {
    return (
      <Backdrop onClose={onClose}>
        <div className="p-5 space-y-3">
          <h3 className="font-display text-ink text-xl">{event!.title}</h3>
          <p className="text-sm text-mut">
            {event!.allDay ? 'Heldag' : `${new Date(event!.start).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })} – ${formatTime(event!.end)}`}
          </p>
          {event!.recurrence && <p className="text-sm text-violet flex items-center gap-1.5"><Repeat size={13} />{describeRecurrence(event!.recurrence)}</p>}
          {event!.location && <p className="text-sm text-mut flex items-center gap-1.5"><MapPin size={13} />{event!.location}</p>}
          {event!.description && <p className="text-sm text-mut whitespace-pre-line">{event!.description}</p>}
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-soft text-sm font-medium text-ink">Stäng</button>
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={onClose} title={event ? 'Redigera' : 'Nytt event / påminnelse'}>
      <div className="p-5 space-y-3 overflow-y-auto">
        <input
          className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
          placeholder="Titel *" value={title} onChange={e => setTitle(e.target.value)} autoFocus
        />

        <div className="flex items-center gap-2">
          <button
            type="button" onClick={() => setAllDay(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${allDay ? 'text-[#2a1d08] border-transparent' : 'border-line text-mut'}`}
            style={allDay ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
          >
            Heldag
          </button>
          <label className="flex items-center gap-2 text-xs text-mut cursor-pointer ml-auto">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="accent-[#cf9a3f]" />
            Aktiv
          </label>
        </div>

        {allDay ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-faint mb-1 block">Startdatum</label>
              <input type="date" className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-faint mb-1 block">Slutdatum</label>
              <input type="date" className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-faint mb-1 block">Start</label>
              <input type="datetime-local" className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40" value={startStr} onChange={e => setStartStr(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-faint mb-1 block">Slut</label>
              <input type="datetime-local" className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40" value={endStr} onChange={e => setEndStr(e.target.value)} />
            </div>
          </div>
        )}

        <RecurrenceEditor
          freq={freq} setFreq={setFreq} interval={interval} setInterval={setInterval}
          weekdays={weekdays} toggleWeekday={toggleWeekday}
          monthDay={monthDay} setMonthDay={setMonthDay} lastDay={lastDay} setLastDay={setLastDay}
          endMode={endMode} setEndMode={setEndMode} count={count} setCount={setCount}
          until={until} setUntil={setUntil}
        />

        <input
          className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
          placeholder="Plats (valfritt)" value={location} onChange={e => setLocation(e.target.value)}
        />
        <textarea
          rows={2}
          className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
          placeholder="Beskrivning (valfritt)" value={description} onChange={e => setDescription(e.target.value)}
        />

        <div>
          <label className="text-xs text-faint mb-2 block">Färg</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-all"
                style={{ backgroundColor: c, borderColor: color === c ? 'var(--gold)' : 'transparent' }} />
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 flex gap-3 flex-shrink-0 border-t border-line pt-4">
        {event && onDelete && (
          <button onClick={() => onDelete(event.id)}
            className="px-4 py-2.5 rounded-xl border border-coral/40 text-coral text-sm font-medium hover:bg-coral/10">
            <Trash2 size={14} />
          </button>
        )}
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-sm font-medium text-mut hover:bg-white/5">Avbryt</button>
        <button
          onClick={handleSave} disabled={!title.trim()}
          className="flex-1 py-2.5 rounded-xl text-[#2a1d08] text-sm font-semibold disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
        >
          Spara
        </button>
      </div>
    </Backdrop>
  );
}

// ── Modal-skal ───────────────────────────────────────────────────────────────────

function Backdrop({ children, onClose, title }: { children: ReactNode; onClose: () => void; title?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="vh-card w-full max-w-lg max-h-[90vh] flex flex-col"
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
            <h2 className="font-display text-ink text-lg">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-mut hover:bg-white/5"><X size={16} /></button>
          </div>
        )}
        {children}
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ImportModal – ICS-import (klistra in / fil / URL)
// ═══════════════════════════════════════════════════════════════════════════════

function ImportModal({ onImport, onClose }: {
  onImport: (events: CalendarEvent[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<CalendarEvent[] | null>(null);

  function textToEvents(raw: string): CalendarEvent[] {
    const parsed = parseICS(raw);
    return parsed.map(p => ({
      id: nanoid(),
      title: p.title,
      start: p.start,
      end: p.end,
      allDay: p.allDay,
      source: 'ics' as const,
      sourceId: 'imported',
      color: IMPORTED_SOURCE.color,
      location: p.location,
      description: p.description,
      url: p.url,
      uid: p.uid,
      recurrence: p.recurrence,
      imported: true,
      active: true,
      createdAt: Date.now(),
    }));
  }

  function doParse(raw: string) {
    setError('');
    try {
      const evs = textToEvents(raw);
      if (evs.length === 0) { setError('Hittade inga event (VEVENT) i filen.'); setPreview(null); return; }
      setPreview(evs);
    } catch {
      setError('Kunde inte tolka ICS-innehållet.');
      setPreview(null);
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const t = String(reader.result ?? ''); setText(t); doParse(t); };
    reader.onerror = () => setError('Kunde inte läsa filen.');
    reader.readAsText(file);
  }

  async function handleUrl() {
    if (!url.trim()) return;
    setBusy(true); setError('');
    try {
      // Browsern blockerar oftast direkt fetch (CORS). Försök via ev. backend-proxy,
      // fall tillbaka till ett hjälpsamt meddelande.
      const normalized = url.replace(/^webcal:\/\//i, 'https://');
      let raw = '';
      try {
        const res = await fetch('/api/fetch-ical', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalized, raw: true }),
        });
        if (res.ok) {
          const data = await res.json() as { ics?: string };
          if (data.ics) raw = data.ics;
        }
      } catch { /* ignore, try direct */ }
      if (!raw) {
        const res = await fetch(normalized);
        raw = await res.text();
      }
      setText(raw);
      doParse(raw);
    } catch {
      setError('Kunde inte hämta URL:en (ofta blockerat av CORS). Ladda ner .ics-filen och ladda upp den, eller klistra in innehållet.');
    }
    setBusy(false);
  }

  return (
    <Backdrop onClose={onClose} title="Importera kalender (ICS)">
      <div className="p-5 space-y-4 overflow-y-auto">
        <div>
          <label className="text-xs text-faint mb-1.5 block">Ladda upp .ics-fil</label>
          <label className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-line text-sm text-mut hover:border-gold/50 hover:text-gold transition-colors cursor-pointer">
            <Upload size={16} /> Välj fil
            <input type="file" accept=".ics,text/calendar" className="hidden" onChange={handleFile} />
          </label>
        </div>

        <div>
          <label className="text-xs text-faint mb-1.5 block">…eller klistra in ICS-text</label>
          <textarea
            rows={5} value={text}
            onChange={e => setText(e.target.value)}
            onBlur={() => text.trim() && doParse(text)}
            placeholder="BEGIN:VCALENDAR…"
            className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-xs font-mono text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
          />
          {text.trim() && (
            <button onClick={() => doParse(text)} className="mt-2 text-xs text-gold hover:underline">Tolka text</button>
          )}
        </div>

        <div>
          <label className="text-xs text-faint mb-1.5 block">…eller från URL (kan blockeras av CORS)</label>
          <div className="flex gap-2">
            <input
              value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://… eller webcal://…"
              className="flex-1 bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
            <button onClick={handleUrl} disabled={!url.trim() || busy}
              className="px-3 py-2.5 rounded-xl border border-line text-sm text-mut hover:bg-white/5 disabled:opacity-40 flex items-center gap-1.5">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />} Hämta
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}

        {preview && (
          <div className="rounded-xl border border-line bg-soft/60 p-3">
            <p className="text-sm text-ink mb-2 font-medium">{preview.length} event hittades</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {preview.slice(0, 20).map(e => (
                <div key={e.id} className="text-xs text-mut flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: IMPORTED_SOURCE.color }} />
                  <span className="truncate">{e.title}</span>
                  {e.recurrence && <Repeat size={10} className="text-violet flex-shrink-0" />}
                </div>
              ))}
              {preview.length > 20 && <p className="text-[11px] text-faint">+{preview.length - 20} till…</p>}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-5 flex gap-3 flex-shrink-0 border-t border-line pt-4">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-sm font-medium text-mut hover:bg-white/5">Avbryt</button>
        <button
          onClick={() => preview && onImport(preview)} disabled={!preview || preview.length === 0}
          className="flex-1 py-2.5 rounded-xl text-[#2a1d08] text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
        >
          <Download size={14} /> Importera{preview ? ` ${preview.length}` : ''}
        </button>
      </div>
    </Backdrop>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SourceSettingsModal – externa prenumerationer (behåller /api/fetch-ical)
// ═══════════════════════════════════════════════════════════════════════════════

function SourceSettingsModal({ sources, onAdd, onUpdate, onDelete, onClose }: {
  sources: CalendarSource[];
  onAdd: (s: CalendarSource) => void;
  onUpdate: (s: CalendarSource) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'list' | 'add'>('list');
  const [name, setName] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const [color, setColor] = useState('#5fe0d0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAddICS() {
    if (!name.trim() || !icsUrl.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/fetch-ical', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: icsUrl }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        throw new Error(j.error ?? 'Fel vid hämtning');
      }
      onAdd({
        id: nanoid(), type: 'ics', name: name.trim(), color, enabled: true,
        icsUrl: icsUrl.trim(), lastFetched: new Date().toISOString(),
      });
      setTab('list'); setName(''); setIcsUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel');
    }
    setLoading(false);
  }

  const subs = sources.filter(s => s.id !== 'own' && s.id !== 'imported' && s.type === 'ics' && s.icsUrl);

  return (
    <Backdrop onClose={onClose} title="Kalenderprenumerationer">
      <div className="overflow-y-auto flex-1">
        {tab === 'list' && (
          <div className="p-5 space-y-3">
            <p className="text-xs text-faint">Prenumerera på externa kalendrar via iCal/ICS-länk (synkas från servern vid laddning).</p>
            {subs.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-soft rounded-xl">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{s.name}</p>
                  <p className="text-xs text-faint truncate">{s.icsUrl}</p>
                </div>
                <button onClick={() => onUpdate({ ...s, enabled: !s.enabled })}
                  className="w-8 h-5 rounded-full transition-colors relative flex-shrink-0"
                  style={{ background: s.enabled ? 'var(--gold)' : 'rgba(244,241,234,.15)' }}>
                  <span className={`block w-3.5 h-3.5 bg-bg rounded-full absolute top-0.5 transition-all ${s.enabled ? 'left-4' : 'left-0.5'}`} />
                </button>
                <button onClick={() => onDelete(s.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-coral/10 text-faint hover:text-coral flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {subs.length === 0 && <p className="text-xs text-faint text-center py-4">Inga prenumerationer</p>}
            <button onClick={() => setTab('add')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-line text-sm text-mut hover:border-gold/50 hover:text-gold transition-colors">
              <Plus size={16} /> Lägg till prenumeration
            </button>
          </div>
        )}
        {tab === 'add' && (
          <div className="p-5 space-y-4">
            <button onClick={() => setTab('list')} className="text-sm text-gold hover:underline">← Tillbaka</button>
            <input className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
              placeholder="Namn *" value={name} onChange={e => setName(e.target.value)} />
            <input className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
              placeholder="iCal URL (webcal:// eller https://)" value={icsUrl}
              onChange={e => setIcsUrl(e.target.value.replace(/^webcal:\/\//i, 'https://'))} />
            <div>
              <label className="text-xs text-faint mb-2 block">Färg</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: color === c ? 'var(--gold)' : 'transparent' }} />
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-coral">{error}</p>}
            <button onClick={handleAddICS} disabled={!name.trim() || !icsUrl.trim() || loading}
              className="w-full py-2.5 rounded-xl text-[#2a1d08] text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
              {loading ? <><Loader2 size={14} className="animate-spin" />Hämtar…</> : 'Lägg till'}
            </button>
          </div>
        )}
      </div>
    </Backdrop>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Månadsrutnät (full bredd)
// ═══════════════════════════════════════════════════════════════════════════════

function MonthGrid({ year, month, todayKey, occByDay, onDayClick, onEventClick }: {
  year: number; month: number; todayKey: string;
  occByDay: Map<string, Occ[]>;
  onDayClick: (ds: string) => void;
  onEventClick: (o: Occ) => void;
}) {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(new Date(year, month, 1 - startOffset + i));

  return (
    <div className="vh-card p-3 sm:p-4">
      <div className="grid grid-cols-7 mb-2">
        {SV_DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold tracking-wide text-faint uppercase py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          const ds = ymd(d);
          const isCurrentMonth = d.getMonth() === month;
          const isToday = ds === todayKey;
          const dayOccs = occByDay.get(ds) ?? [];
          return (
            <div
              key={i}
              onClick={() => onDayClick(ds)}
              className={`group relative rounded-xl border p-1.5 cursor-pointer transition-colors min-h-[84px] lg:min-h-[116px] flex flex-col
                ${isToday ? 'border-gold/50' : 'border-line hover:border-white/20'}
                ${isCurrentMonth ? 'bg-card' : 'bg-card/40'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold tabular-nums
                  ${isToday ? 'text-[#2a1d08]' : isCurrentMonth ? 'text-ink' : 'text-faint'}`}
                  style={isToday ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}>
                  {d.getDate()}
                </span>
                <Plus size={13} className="text-faint opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="space-y-0.5 overflow-hidden flex-1">
                {dayOccs.slice(0, 4).map(o => (
                  <div
                    key={o.key}
                    onClick={ev => { ev.stopPropagation(); onEventClick(o); }}
                    title={o.ev.title}
                    className="flex items-center gap-1 text-[10px] leading-tight px-1 py-0.5 rounded font-medium truncate hover:opacity-80"
                    style={{ backgroundColor: o.color + '26', color: o.color }}
                  >
                    {o.ev.recurrence && <Repeat size={8} className="flex-shrink-0 opacity-80" />}
                    <span className="truncate">{o.ev.allDay ? '' : formatTime(o.start) + ' '}{o.ev.title}</span>
                  </div>
                ))}
                {dayOccs.length > 4 && <div className="text-[9px] text-faint px-1">+{dayOccs.length - 4} till</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Huvudkomponent
// ═══════════════════════════════════════════════════════════════════════════════

export default function CalendarHome() {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<CalendarEvent[]>([]);     // egna + importerade (base, med recurrence)
  const [sources, setSources] = useState<CalendarSource[]>([OWN_SOURCE, IMPORTED_SOURCE]);
  const [icsEvents, setIcsEvents] = useState<CalendarEvent[]>([]); // externa prenumerationer (konkreta)
  const [loading, setLoading] = useState(true);

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());

  const [showEventModal, setShowEventModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const todayKey = useMemo(() => ymd(new Date()), []);

  // ── Ladda ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [fresh, legacy] = await Promise.all([
          loadCalendarEvents(user.uid),
          loadLegacyOwnEvents(user.uid),
        ]);
        if (cancelled) return;
        // Merge: nya vinner, legacy fyller på (så gamla events inte försvinner).
        const byId = new Map<string, CalendarEvent>();
        for (const e of legacy) byId.set(e.id, { ...e, active: e.active ?? true });
        for (const e of fresh) byId.set(e.id, e);
        setEvents([...byId.values()]);
      } catch (err) { console.error(err); }
      finally { if (!cancelled) setLoading(false); }
    })();

    getDocs(collection(db, 'users', user.uid, 'calendarSources'))
      .then(snap => {
        if (cancelled || snap.empty) return;
        const loaded = snap.docs.map(d => d.data() as CalendarSource);
        setSources([OWN_SOURCE, IMPORTED_SOURCE, ...loaded.filter(s => s.id !== 'own' && s.id !== 'imported')]);
      })
      .catch(console.error);

    return () => { cancelled = true; };
  }, [user]);

  // ── Hämta externa prenumerationer ──────────────────────────────────────────────
  useEffect(() => {
    const subs = sources.filter(s => s.type === 'ics' && s.enabled && s.icsUrl && s.id !== 'imported');
    if (subs.length === 0) { setIcsEvents([]); return; }
    Promise.all(subs.map(async s => {
      try {
        const res = await fetch('/api/fetch-ical', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: s.icsUrl }),
        });
        if (!res.ok) return [];
        const data = await res.json() as { events?: CalendarEvent[] };
        return (data.events ?? []).map(e => ({ ...e, source: 'ics' as const, sourceId: s.id, color: s.color }));
      } catch { return []; }
    })).then(groups => setIcsEvents(groups.flat()));
  }, [sources]);

  // ── Expandera tillfällen för synligt fönster ───────────────────────────────────
  const enabledIds = useMemo(() => new Set(sources.filter(s => s.enabled).map(s => s.id)), [sources]);

  function colorFor(e: CalendarEvent): string {
    return sources.find(s => s.id === e.sourceId)?.color ?? e.color ?? OWN_SOURCE.color;
  }

  const { occByDay, agenda } = useMemo(() => {
    const gridStart = new Date(year, month, 1);
    const gridStartMonday = new Date(gridStart);
    gridStartMonday.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));
    const gridEnd = new Date(gridStartMonday);
    gridEnd.setDate(gridStartMonday.getDate() + 42);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const agendaEnd = new Date(today); agendaEnd.setDate(today.getDate() + 120);

    const rangeStart = gridStartMonday < today ? gridStartMonday : today;
    const rangeEnd = gridEnd > agendaEnd ? gridEnd : agendaEnd;

    const base = [...events, ...icsEvents].filter(e =>
      enabledIds.has(e.sourceId) && e.active !== false,
    );

    const all: Occ[] = [];
    for (const e of base) {
      const col = colorFor(e);
      const occs = expandOccurrences(e, rangeStart, rangeEnd);
      for (const o of occs) {
        all.push({ key: `${e.id}@${o.start}`, ev: e, start: o.start, end: o.end, color: col });
      }
    }
    all.sort((a, b) => a.start.localeCompare(b.start));

    const map = new Map<string, Occ[]>();
    for (const o of all) {
      const k = ymd(new Date(o.start));
      const arr = map.get(k); if (arr) arr.push(o); else map.set(k, [o]);
    }

    const agendaList = all.filter(o => new Date(o.end) >= today).slice(0, 60);
    return { occByDay: map, agenda: agendaList };
  }, [events, icsEvents, enabledIds, year, month, sources]);

  // Gruppera agenda per dag
  const agendaGroups = useMemo(() => {
    const g: { key: string; label: string; items: Occ[] }[] = [];
    const idx = new Map<string, number>();
    for (const o of agenda) {
      const k = ymd(new Date(o.start));
      if (!idx.has(k)) {
        idx.set(k, g.length);
        g.push({ key: k, label: formatDateLong(new Date(o.start)), items: [] });
      }
      g[idx.get(k)!].items.push(o);
    }
    return g;
  }, [agenda]);

  // Regelbundna påminnelser (för hanteringslistan)
  const recurring = useMemo(
    () => events.filter(e => e.recurrence && e.recurrence.freq !== 'none'),
    [events],
  );

  // ── CRUD ───────────────────────────────────────────────────────────────────────
  async function handleSaveEvent(e: CalendarEvent) {
    setEvents(prev => prev.find(x => x.id === e.id) ? prev.map(x => x.id === e.id ? e : x) : [e, ...prev]);
    if (user) {
      try {
        await saveCalendarEvent(user.uid, e);
        // migrera ev. legacy-kopia
        await deleteLegacyOwnEvent(user.uid, e.id);
      } catch (err) { console.error(err); }
    }
    setShowEventModal(false); setSelectedEvent(null); setSelectedDate(null);
  }

  async function handleDeleteEvent(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (user) {
      try {
        await deleteCalendarEvent(user.uid, id);
        await deleteLegacyOwnEvent(user.uid, id);
      } catch (err) { console.error(err); }
    }
    setShowEventModal(false); setSelectedEvent(null);
  }

  async function handleToggleActive(e: CalendarEvent) {
    const next = { ...e, active: e.active === false };
    setEvents(prev => prev.map(x => x.id === e.id ? next : x));
    if (user) { try { await saveCalendarEvent(user.uid, next); } catch (err) { console.error(err); } }
  }

  async function handleImport(imported: CalendarEvent[]) {
    // De-dupe mot befintliga via uid.
    const existingUids = new Set(events.filter(e => e.uid).map(e => e.uid));
    const fresh = imported.filter(e => !e.uid || !existingUids.has(e.uid));
    setEvents(prev => [...fresh, ...prev]);
    if (user) { try { await saveCalendarEventsBatch(user.uid, fresh); } catch (err) { console.error(err); } }
    setShowImport(false);
  }

  async function handleAddSource(s: CalendarSource) {
    if (!user) { setSources(prev => [...prev, s]); return; }
    try { await setDoc(doc(db, 'users', user.uid, 'calendarSources', s.id), JSON.parse(JSON.stringify(s))); } catch (err) { console.error(err); }
    setSources(prev => [...prev, s]);
  }
  async function handleUpdateSource(s: CalendarSource) {
    setSources(prev => prev.map(x => x.id === s.id ? s : x));
    if (user && s.id !== 'own' && s.id !== 'imported') {
      try { await setDoc(doc(db, 'users', user.uid, 'calendarSources', s.id), JSON.parse(JSON.stringify(s))); } catch (err) { console.error(err); }
    }
  }
  async function handleDeleteSource(id: string) {
    setSources(prev => prev.filter(s => s.id !== id));
    setIcsEvents(prev => prev.filter(e => e.sourceId !== id));
    if (user) { try { await deleteDoc(doc(db, 'users', user.uid, 'calendarSources', id)); } catch (err) { console.error(err); } }
  }

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); }
  function goToday() { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth()); }

  function openNew(date?: string) { setSelectedEvent(null); setSelectedDate(date ?? null); setShowEventModal(true); }
  function openEvent(e: CalendarEvent) { setSelectedEvent(e); setSelectedDate(null); setShowEventModal(true); }

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-bg text-ink">
      <PageBanner
        img="/img/f-cal.jpg"
        eyebrow="Vardagshub"
        title="Kalender"
        subtitle="Din månad, regelbundna påminnelser och importerade kalendrar – samlat på ett ställe."
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 text-white/90 text-sm font-medium hover:bg-white/10 backdrop-blur-sm">
              <Upload size={15} /> Importera
            </button>
            <button onClick={() => setShowSettings(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/20 text-white/90 hover:bg-white/10 backdrop-blur-sm">
              <Settings size={16} />
            </button>
            <button onClick={() => openNew()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[#2a1d08] text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
              <Plus size={16} /> Nytt
            </button>
          </div>
        }
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-gold" /></div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_minmax(320px,380px)] gap-6">
            {/* Vänster: månadsvy */}
            <div className="min-w-0 space-y-4">
              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl border border-line text-mut hover:bg-white/5"><ChevronLeft size={18} /></button>
                  <h2 className="font-display text-ink min-w-[180px] text-center" style={{ fontSize: 'clamp(20px,2.4vw,30px)' }}>
                    {SV_MONTHS[month]} <span className="text-gold">{year}</span>
                  </h2>
                  <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl border border-line text-mut hover:bg-white/5"><ChevronRight size={18} /></button>
                  <button onClick={goToday} className="ml-1 text-xs px-3 py-2 rounded-xl border border-line text-mut hover:bg-white/5">Idag</button>
                </div>
                {/* Källfärger / lager */}
                <div className="flex items-center gap-1.5">
                  {sources.filter(s => s.id !== 'imported' || events.some(e => e.imported)).map(s => (
                    <button key={s.id} onClick={() => handleUpdateSource({ ...s, enabled: !s.enabled })} title={s.name}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-medium transition-all ${s.enabled ? 'border-transparent text-ink' : 'border-line text-faint opacity-60'}`}
                      style={{ background: s.enabled ? s.color + '22' : undefined }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.enabled ? s.color : 'rgba(244,241,234,.2)' }} />
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rutnät – döljs under md, agendan tar över */}
              <div className="hidden md:block">
                <MonthGrid
                  year={year} month={month} todayKey={todayKey}
                  occByDay={occByDay}
                  onDayClick={openNew}
                  onEventClick={o => openEvent(o.ev)}
                />
              </div>

              {/* Mobil: hänvisning till kommande-listan */}
              <div className="md:hidden">
                <button onClick={() => openNew(todayKey)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-line text-sm text-mut hover:border-gold/50 hover:text-gold">
                  <Plus size={16} /> Nytt event idag
                </button>
              </div>

              {/* Regelbundna påminnelser */}
              {recurring.length > 0 && (
                <div className="vh-card p-4">
                  <h3 className="font-display text-ink mb-3 flex items-center gap-2"><Repeat size={16} className="text-violet" /> Regelbundna påminnelser</h3>
                  <div className="space-y-2">
                    {recurring.map(e => (
                      <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-soft/60">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorFor(e) }} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${e.active === false ? 'text-faint line-through' : 'text-ink'}`}>{e.title}</p>
                          <p className="text-[11px] text-faint truncate">{describeRecurrence(e.recurrence)}</p>
                        </div>
                        <button onClick={() => handleToggleActive(e)} title={e.active === false ? 'Aktivera' : 'Pausa'}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg ${e.active === false ? 'text-faint hover:bg-white/5' : 'text-lime hover:bg-lime/10'}`}>
                          <Power size={14} />
                        </button>
                        <button onClick={() => openEvent(e)} className="text-xs text-gold hover:underline">Ändra</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Höger: agenda */}
            <aside className="min-w-0">
              <div className="vh-card p-4 lg:sticky lg:top-4">
                <h3 className="font-display text-ink mb-3 flex items-center gap-2"><CalendarDays size={16} className="text-gold" /> Kommande</h3>
                {agendaGroups.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarDays size={28} className="mx-auto mb-3 text-faint" />
                    <p className="text-sm text-mut">Inga kommande event</p>
                    <button onClick={() => openNew()} className="mt-3 text-sm text-gold hover:underline">Skapa ett</button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    {agendaGroups.map(g => (
                      <div key={g.key}>
                        <h4 className="text-[11px] font-semibold text-faint uppercase tracking-wide mb-2 capitalize">{g.label}</h4>
                        <div className="space-y-1.5">
                          {g.items.map(o => (
                            <button key={o.key} onClick={() => openEvent(o.ev)}
                              className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 text-left transition-colors">
                              <span className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: o.color, minHeight: 28 }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-ink truncate flex items-center gap-1.5">
                                  {o.ev.title}
                                  {o.ev.recurrence && <Repeat size={11} className="text-violet flex-shrink-0" />}
                                  {o.ev.imported && <span className="text-[9px] px-1 rounded bg-violet/20 text-violet">ICS</span>}
                                </p>
                                <p className="text-[11px] text-faint mt-0.5">
                                  {o.ev.allDay ? 'Heldag' : `${formatTime(o.start)} – ${formatTime(o.end)}`}
                                  {o.ev.location ? ` · ${o.ev.location}` : ''}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Mobil: importknapp */}
                <button onClick={() => setShowImport(true)}
                  className="sm:hidden mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-line text-sm text-mut hover:bg-white/5">
                  <Upload size={15} /> Importera kalender
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Modaler */}
      {showEventModal && (
        <EventModal
          initialDate={selectedDate ?? undefined}
          event={selectedEvent ?? undefined}
          onSave={handleSaveEvent}
          onDelete={selectedEvent ? handleDeleteEvent : undefined}
          onClose={() => { setShowEventModal(false); setSelectedEvent(null); setSelectedDate(null); }}
        />
      )}
      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}
      {showSettings && (
        <SourceSettingsModal
          sources={sources}
          onAdd={handleAddSource}
          onUpdate={handleUpdateSource}
          onDelete={handleDeleteSource}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
