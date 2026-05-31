// ── CalendarView – månadsvy + agendavy ───────────────────────────────────────
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, List } from 'lucide-react';
import type { CalendarEvent, CalendarSource } from '../../types';

// ── Hjälpare ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
}

const SV_MONTHS = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];
const SV_DAYS_SHORT = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  events: CalendarEvent[];
  sources: CalendarSource[];
  onDayClick: (dateStr: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}

type ViewMode = 'month' | 'agenda';

// ── Månadsvy ──────────────────────────────────────────────────────────────────

function MonthView({ events, sources, year, month, today, onDayClick, onEventClick }: {
  events: CalendarEvent[];
  sources: CalendarSource[];
  year: number;
  month: number;
  today: string;
  onDayClick: (d: string) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const enabledSources = new Set(sources.filter(s => s.enabled).map(s => s.id));
  const visibleEvents = events.filter(e => enabledSources.has(e.sourceId));

  // Build 6-row × 7-col grid (ISO week: Monday first)
  const firstDay = new Date(year, month, 1);
  // Monday-first: getDay() returns 0=Sun,1=Mon..6=Sat → shift
  const startOffset = (firstDay.getDay() + 6) % 7; // days before 1st
  const totalCells = 42;
  const cells: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month, 1 - startOffset + i);
    cells.push(d);
  }

  function eventsForDay(d: Date): CalendarEvent[] {
    const ds = isoDate(d);
    return visibleEvents.filter(e => sameDay(e.start, ds)).slice(0, 3);
  }

  function sourceColor(e: CalendarEvent): string {
    return sources.find(s => s.id === e.sourceId)?.color ?? e.color ?? '#6366f1';
  }

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {SV_DAYS_SHORT.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
        {cells.map((d, i) => {
          const ds = isoDate(d);
          const isCurrentMonth = d.getMonth() === month;
          const isToday = ds === today;
          const dayEvents = eventsForDay(d);

          return (
            <div
              key={i}
              onClick={() => onDayClick(ds)}
              className={`bg-white min-h-[72px] p-1 cursor-pointer hover:bg-gray-50 transition-colors ${!isCurrentMonth ? 'opacity-40' : ''}`}
            >
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 mx-auto
                ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.map(e => (
                  <div
                    key={e.id}
                    onClick={ev => { ev.stopPropagation(); onEventClick(e); }}
                    title={e.title}
                    className="text-[10px] leading-tight px-1 py-0.5 rounded font-medium truncate text-white cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: sourceColor(e) }}
                  >
                    {e.allDay ? '' : formatTime(e.start) + ' '}{e.title}
                  </div>
                ))}
                {visibleEvents.filter(e => sameDay(e.start, ds)).length > 3 && (
                  <div className="text-[9px] text-gray-400 px-1">
                    +{visibleEvents.filter(e => sameDay(e.start, ds)).length - 3} till
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Agendavy ──────────────────────────────────────────────────────────────────

function AgendaView({ events, sources, onEventClick }: {
  events: CalendarEvent[];
  sources: CalendarSource[];
  onEventClick: (e: CalendarEvent) => void;
}) {
  const enabledSources = new Set(sources.filter(s => s.enabled).map(s => s.id));
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  const upcoming = events
    .filter(e => enabledSources.has(e.sourceId) && new Date(e.start) >= cutoff)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 60);

  // Group by date
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const e of upcoming) {
    const key = e.start.slice(0, 10);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  function sourceColor(e: CalendarEvent): string {
    return sources.find(s => s.id === e.sourceId)?.color ?? e.color ?? '#6366f1';
  }

  if (upcoming.length === 0) {
    return (
      <div className="text-center py-16">
        <Calendar size={32} className="mx-auto mb-3 text-gray-300" />
        <p className="text-gray-400 text-sm">Inga kommande events</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([dateStr, dayEvents]) => (
        <div key={dateStr}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">
            {formatDate(dateStr)}
          </h3>
          <div className="bg-white rounded-2xl divide-y divide-gray-50 overflow-hidden shadow-sm">
            {dayEvents.map(e => (
              <button
                key={e.id}
                onClick={() => onEventClick(e)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
              >
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: sourceColor(e), minHeight: '16px' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{e.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {e.allDay ? 'Heldag' : `${formatTime(e.start)} – ${formatTime(e.end)}`}
                    {e.location ? ` · ${e.location}` : ''}
                  </p>
                  {e.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{e.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Huvud-komponent ───────────────────────────────────────────────────────────

export default function CalendarView({ events, sources, onDayClick, onEventClick }: Props) {
  const today = useMemo(() => isoDate(new Date()), []);
  const [view, setView] = useState<ViewMode>('month');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <h2 className="text-base font-bold text-gray-900 min-w-[160px] text-center">
            {SV_MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <ChevronRight size={16} className="text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Idag
          </button>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView('month')}
              className={`px-2.5 py-1.5 ${view === 'month' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Calendar size={14} />
            </button>
            <button
              onClick={() => setView('agenda')}
              className={`px-2.5 py-1.5 ${view === 'agenda' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {view === 'month' ? (
        <MonthView
          events={events}
          sources={sources}
          year={year}
          month={month}
          today={today}
          onDayClick={onDayClick}
          onEventClick={onEventClick}
        />
      ) : (
        <AgendaView
          events={events}
          sources={sources}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
}
