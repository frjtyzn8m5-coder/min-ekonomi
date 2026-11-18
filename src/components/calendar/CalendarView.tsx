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
          <div key={d} className="text-center text-[11px] font-semibold text-faint py-1">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-px bg-line rounded-xl overflow-hidden border border-line">
        {cells.map((d, i) => {
          const ds = isoDate(d);
          const isCurrentMonth = d.getMonth() === month;
          const isToday = ds === today;
          const dayEvents = eventsForDay(d);

          return (
            <div
              key={i}
              onClick={() => onDayClick(ds)}
              className={`bg-card min-h-[72px] p-1 cursor-pointer hover:bg-white/5 transition-colors ${!isCurrentMonth ? 'opacity-40' : ''}`}
            >
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 mx-auto tabular-nums
                ${isToday ? 'text-[#2a1d08]' : 'text-mut'}`}
                style={isToday ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.map(e => (
                  <div
                    key={e.id}
                    onClick={ev => { ev.stopPropagation(); onEventClick(e); }}
                    title={e.title}
                    className="text-[10px] leading-tight px-1 py-0.5 rounded font-medium truncate cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: sourceColor(e) + '26', color: sourceColor(e) }}
                  >
                    {e.allDay ? '' : formatTime(e.start) + ' '}{e.title}
                  </div>
                ))}
                {visibleEvents.filter(e => sameDay(e.start, ds)).length > 3 && (
                  <div className="text-[9px] text-faint px-1">
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
        <Calendar size={32} className="mx-auto mb-3 text-faint" />
        <p className="text-mut text-sm">Inga kommande events</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([dateStr, dayEvents]) => (
        <div key={dateStr}>
          <h3 className="text-xs font-semibold text-faint uppercase tracking-wide mb-2 capitalize">
            {formatDate(dateStr)}
          </h3>
          <div className="vh-card divide-y divide-line overflow-hidden">
            {dayEvents.map(e => (
              <button
                key={e.id}
                onClick={() => onEventClick(e)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 text-left transition-colors"
              >
                <div
                  className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: sourceColor(e), minHeight: '16px' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{e.title}</p>
                  <p className="text-xs text-faint mt-0.5">
                    {e.allDay ? 'Heldag' : `${formatTime(e.start)} – ${formatTime(e.end)}`}
                    {e.location ? ` · ${e.location}` : ''}
                  </p>
                  {e.description && (
                    <p className="text-xs text-faint mt-0.5 truncate">{e.description}</p>
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
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-mut hover:bg-white/5">
            <ChevronLeft size={16} />
          </button>
          <h2 className="font-display text-base text-ink min-w-[160px] text-center">
            {SV_MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-mut hover:bg-white/5">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-line text-mut hover:bg-white/5"
          >
            Idag
          </button>
          <div className="flex rounded-lg border border-line overflow-hidden">
            <button
              onClick={() => setView('month')}
              className={`px-2.5 py-1.5 ${view === 'month' ? 'text-[#2a1d08]' : 'bg-card text-mut hover:bg-white/5'}`}
              style={view === 'month' ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
            >
              <Calendar size={14} />
            </button>
            <button
              onClick={() => setView('agenda')}
              className={`px-2.5 py-1.5 ${view === 'agenda' ? 'text-[#2a1d08]' : 'bg-card text-mut hover:bg-white/5'}`}
              style={view === 'agenda' ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
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
