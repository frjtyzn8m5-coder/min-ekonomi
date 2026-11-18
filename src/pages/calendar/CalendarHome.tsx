import { useEffect, useState } from 'react';
import {
  collection, getDocs, setDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import type { CalendarEvent, CalendarSource, CalendarSourceType } from '../../types';
import CalendarView from '../../components/calendar/CalendarView';
import { nanoid } from 'nanoid';
import {
  Plus, Settings, X, Trash2,
  Globe, Link, Loader2,
} from 'lucide-react';
import { ICalendar } from '../../components/ui/Icons';
import { motion } from 'framer-motion';

// ── Standardkälla "Egna events" ───────────────────────────────────────────────

const OWN_SOURCE: CalendarSource = {
  id: 'own',
  type: 'own',
  name: 'Egna events',
  color: '#6366f1',
  enabled: true,
};

// ── Färgval ───────────────────────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#ec4899', '#8b5cf6',
];

// ── EventModal – skapa / visa event ──────────────────────────────────────────

interface EventModalProps {
  initialDate?: string;
  event?: CalendarEvent;
  onSave: (e: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

function EventModal({ initialDate, event, onSave, onDelete, onClose }: EventModalProps) {
  const todayStr = new Date().toISOString().slice(0, 16);
  const [title, setTitle] = useState(event?.title ?? '');
  const [start, setStart] = useState(event?.start?.slice(0, 16) ?? (initialDate ? `${initialDate}T08:00` : todayStr));
  const [end, setEnd] = useState(event?.end?.slice(0, 16) ?? (initialDate ? `${initialDate}T09:00` : ''));
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [color, setColor] = useState(event?.color ?? '#6366f1');

  function handleSave() {
    if (!title.trim()) return;
    const e: CalendarEvent = {
      id: event?.id ?? nanoid(),
      title: title.trim(),
      start: allDay ? start.slice(0, 10) + 'T00:00:00' : new Date(start).toISOString(),
      end: allDay ? (end || start).slice(0, 10) + 'T23:59:59' : (end ? new Date(end).toISOString() : new Date(new Date(start).getTime() + 3600000).toISOString()),
      allDay,
      source: 'own',
      sourceId: 'own',
      color,
      location: location || undefined,
      description: description || undefined,
    };
    onSave(e);
  }

  const isView = !!event && event.source !== 'own';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="vh-card w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-display text-ink">
            {isView ? 'Event' : event ? 'Redigera event' : 'Nytt event'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-mut hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        {isView ? (
          // Read-only view for external events
          <div className="p-5 space-y-3">
            <h3 className="font-display text-ink text-lg">{event.title}</h3>
            <p className="text-sm text-mut">
              {event.allDay ? 'Heldag' : `${new Date(event.start).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })} – ${new Date(event.end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
            {event.location && <p className="text-sm text-mut">📍 {event.location}</p>}
            {event.description && <p className="text-sm text-mut whitespace-pre-line">{event.description}</p>}
            {event.url && <a href={event.url} target="_blank" rel="noreferrer" className="text-sm text-gold hover:underline flex items-center gap-1"><Link size={12} />Öppna länk</a>}
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <input
              className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
              placeholder="Titel *"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAllDay(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${allDay ? 'text-[#2a1d08] border-transparent' : 'border-line text-mut'}`}
                style={allDay ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}
              >
                Heldag
              </button>
            </div>
            {allDay ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-faint mb-1 block">Startdatum</label>
                  <input type="date" className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40" value={start.slice(0, 10)} onChange={e => setStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-faint mb-1 block">Slutdatum</label>
                  <input type="date" className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40" value={(end || start).slice(0, 10)} onChange={e => setEnd(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-faint mb-1 block">Start</label>
                  <input type="datetime-local" className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40" value={start} onChange={e => setStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-faint mb-1 block">Slut</label>
                  <input type="datetime-local" className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold/40" value={end} onChange={e => setEnd(e.target.value)} />
                </div>
              </div>
            )}
            <input
              className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
              placeholder="Plats (valfritt)"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
            <textarea
              rows={2}
              className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40 resize-none"
              placeholder="Beskrivning (valfritt)"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            {/* Color */}
            <div>
              <label className="text-xs text-faint mb-2 block">Färg</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: color === c ? 'var(--gold)' : 'transparent' }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="px-5 pb-5 flex gap-3">
          {event && !isView && onDelete && (
            <button onClick={() => onDelete(event.id)}
              className="px-4 py-2.5 rounded-xl border border-coral/40 text-coral text-sm font-medium hover:bg-coral/10">
              <Trash2 size={14} />
            </button>
          )}
          {!isView && (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-sm font-medium text-mut hover:bg-white/5">Avbryt</button>
              <button
                onClick={handleSave}
                disabled={!title.trim()}
                className="flex-1 py-2.5 rounded-xl text-[#2a1d08] text-sm font-semibold disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
              >
                Spara
              </button>
            </>
          )}
          {isView && (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-soft text-sm font-medium text-ink">Stäng</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SourceSettingsModal ───────────────────────────────────────────────────────

interface SourceSettingsProps {
  sources: CalendarSource[];
  onAdd: (s: CalendarSource) => void;
  onUpdate: (s: CalendarSource) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function SourceSettingsModal({ sources, onAdd, onUpdate, onDelete, onClose }: SourceSettingsProps) {
  const [tab, setTab] = useState<'list' | 'add'>('list');
  const [addType, setAddType] = useState<CalendarSourceType>('ics');
  const [name, setName] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAddICS() {
    if (!name.trim() || !icsUrl.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/fetch-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: icsUrl }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? 'Fel vid hämtning');
      }
      onAdd({
        id: nanoid(),
        type: 'ics',
        name: name.trim(),
        color,
        enabled: true,
        icsUrl: icsUrl.trim(),
        lastFetched: new Date().toISOString(),
      });
      setTab('list');
      setName(''); setIcsUrl(''); setColor('#6366f1');
    } catch (err: any) {
      setError(err.message ?? 'Okänt fel');
    }
    setLoading(false);
  }

  const externalSources = sources.filter(s => s.id !== 'own');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="vh-card w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
          <h2 className="font-display text-ink">Kalenderkällor</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-mut hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {tab === 'list' && (
            <div className="p-5 space-y-3">
              {/* Own events source */}
              <div className="flex items-center gap-3 p-3 bg-soft rounded-xl">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: OWN_SOURCE.color }} />
                <span className="flex-1 text-sm font-medium text-ink">Egna events</span>
                <span className="text-xs text-faint">Inbyggt</span>
              </div>

              {externalSources.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-soft rounded-xl">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{s.name}</p>
                    <p className="text-xs text-faint">{s.type === 'ics' ? 'iCal/ICS' : s.type}</p>
                  </div>
                  <button
                    onClick={() => onUpdate({ ...s, enabled: !s.enabled })}
                    className="w-8 h-5 rounded-full transition-colors relative flex-shrink-0"
                    style={{ background: s.enabled ? 'var(--gold)' : 'rgba(244,241,234,.15)' }}
                  >
                    <span className={`block w-3.5 h-3.5 bg-bg rounded-full absolute top-0.5 transition-all ${s.enabled ? 'left-4' : 'left-0.5'}`} />
                  </button>
                  <button onClick={() => onDelete(s.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-coral/10 text-faint hover:text-coral flex-shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {externalSources.length === 0 && (
                <p className="text-xs text-faint text-center py-4">Inga externa kalendrar tillagda</p>
              )}

              <button
                onClick={() => setTab('add')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-line text-sm text-mut hover:border-gold/50 hover:text-gold transition-colors"
              >
                <Plus size={16} />
                Lägg till kalender
              </button>

              {/* OAuth integrations (stubs) */}
              <div className="pt-2">
                <p className="text-xs text-faint font-medium mb-2">Kalenderintegrationer (kräver konfiguration)</p>
                {[
                  { label: 'Google Calendar', color: '#EA4335', note: 'Kräver Google OAuth-app i Firebase Console' },
                  { label: 'Microsoft Outlook/Teams', color: '#0078D4', note: 'Kräver Azure AD-app med Calendars.Read' },
                  { label: 'Apple iCloud', color: '#555555', note: 'Kräver app-lösenord från appleid.apple.com' },
                ].map(({ label, color: c, note }) => (
                  <div key={label} className="flex items-start gap-3 p-3 border border-line rounded-xl mb-2 opacity-60">
                    <div className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: c }} />
                    <div>
                      <p className="text-sm font-medium text-ink">{label}</p>
                      <p className="text-[11px] text-faint">{note}</p>
                    </div>
                    <span className="ml-auto text-[10px] bg-soft text-faint px-2 py-0.5 rounded-full flex-shrink-0">Snart</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'add' && (
            <div className="p-5 space-y-4">
              <button onClick={() => setTab('list')} className="text-sm text-gold hover:underline flex items-center gap-1">
                ← Tillbaka
              </button>

              <div>
                <label className="text-xs text-mut mb-1 block">Typ</label>
                <div className="flex gap-2">
                  <button onClick={() => setAddType('ics')}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${addType === 'ics' ? 'text-[#2a1d08] border-transparent' : 'border-line text-mut'}`}
                    style={addType === 'ics' ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}>
                    <Globe size={14} className="inline mr-1" />iCal/ICS URL
                  </button>
                </div>
              </div>

              <input
                className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
                placeholder="Namn *"
                value={name}
                onChange={e => setName(e.target.value)}
              />

              {addType === 'ics' && (
                <div>
                  <input
                    className="w-full bg-soft border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-gold/40"
                    placeholder="iCal URL (webcal:// eller https://)"
                    value={icsUrl}
                    onChange={e => setIcsUrl(e.target.value.replace('webcal://', 'https://'))}
                  />
                  <p className="text-[11px] text-faint mt-1">Klistra in iCal-prenumerationslänk. Google Calendar → Inställningar → Exportera.</p>
                </div>
              )}

              <div>
                <label className="text-xs text-faint mb-2 block">Färg</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: color === c ? 'var(--gold)' : 'transparent' }} />
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-coral">{error}</p>}

              <button
                onClick={handleAddICS}
                disabled={!name.trim() || !icsUrl.trim() || loading}
                className="w-full py-2.5 rounded-xl text-[#2a1d08] text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
              >
                {loading ? <><Loader2 size={14} className="animate-spin" />Hämtar…</> : 'Lägg till'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Huvud-komponent ───────────────────────────────────────────────────────────

export default function CalendarHome() {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sources, setSources] = useState<CalendarSource[]>([OWN_SOURCE]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [icsEvents, setIcsEvents] = useState<CalendarEvent[]>([]);

  // Load own events + sources from Firestore
  useEffect(() => {
    if (!user) return;

    // Own events
    getDocs(collection(db, 'users', user.uid, 'calendar', 'own', 'events'))
      .then(snap => {
        const loaded = snap.docs.map(d => d.data() as CalendarEvent);
        setEvents(loaded);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Calendar sources
    getDocs(collection(db, 'users', user.uid, 'calendarSources'))
      .then(snap => {
        if (!snap.empty) {
          const loaded = snap.docs.map(d => d.data() as CalendarSource);
          setSources([OWN_SOURCE, ...loaded.filter(s => s.id !== 'own')]);
        }
      })
      .catch(console.error);
  }, [user]);

  // Fetch ICS events whenever ICS sources change
  useEffect(() => {
    const icsSources = sources.filter(s => s.type === 'ics' && s.enabled && s.icsUrl);
    if (icsSources.length === 0) { setIcsEvents([]); return; }

    Promise.all(icsSources.map(async s => {
      try {
        const res = await fetch('/api/fetch-ical', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: s.icsUrl }),
        });
        if (!res.ok) return [];
        const { events: fetched } = await res.json();
        return (fetched as any[]).map(e => ({
          ...e,
          source: 'ics' as const,
          sourceId: s.id,
          color: s.color,
        })) as CalendarEvent[];
      } catch { return []; }
    })).then(groups => setIcsEvents(groups.flat()));
  }, [sources]);

  async function handleSaveEvent(e: CalendarEvent) {
    if (!user) return;
    try {
      const clean = JSON.parse(JSON.stringify(e));
      await setDoc(doc(db, 'users', user.uid, 'calendar', 'own', 'events', e.id), clean);
      setEvents(prev => {
        const exists = prev.find(ev => ev.id === e.id);
        return exists ? prev.map(ev => ev.id === e.id ? e : ev) : [e, ...prev];
      });
    } catch (err) { console.error(err); }
    setShowEventModal(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  }

  async function handleDeleteEvent(id: string) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'calendar', 'own', 'events', id));
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) { console.error(err); }
    setShowEventModal(false);
    setSelectedEvent(null);
  }

  async function handleAddSource(s: CalendarSource) {
    if (!user) return;
    const clean = JSON.parse(JSON.stringify(s));
    await setDoc(doc(db, 'users', user.uid, 'calendarSources', s.id), clean);
    setSources(prev => [...prev, s]);
  }

  async function handleUpdateSource(s: CalendarSource) {
    if (!user) return;
    const clean = JSON.parse(JSON.stringify(s));
    await setDoc(doc(db, 'users', user.uid, 'calendarSources', s.id), clean);
    setSources(prev => prev.map(src => src.id === s.id ? s : src));
  }

  async function handleDeleteSource(id: string) {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'calendarSources', id));
    setSources(prev => prev.filter(s => s.id !== id));
    setIcsEvents(prev => prev.filter(e => e.sourceId !== id));
  }

  function handleDayClick(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedEvent(null);
    setShowEventModal(true);
  }

  function handleEventClick(e: CalendarEvent) {
    setSelectedEvent(e);
    setSelectedDate(null);
    setShowEventModal(true);
  }

  const allEvents = [...events, ...icsEvents];

  return (
    <div className="min-h-full bg-bg text-ink">
      {/* Header */}
      <div className="bg-panel border-b border-line px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="vh-tile vh-tile--gold w-8 h-8"><ICalendar size={16} /></span>
            <h1 className="font-display text-lg text-ink">Kalender</h1>
          </div>
          <div className="flex gap-2">
            {/* Source layer toggles */}
            <div className="flex gap-1 items-center">
              {sources.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleUpdateSource({ ...s, enabled: !s.enabled })}
                  title={s.name}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${s.enabled ? 'border-transparent' : 'border-line opacity-40'}`}
                  style={{ backgroundColor: s.enabled ? s.color : 'rgba(244,241,234,.15)' }}
                />
              ))}
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-mut hover:bg-white/5"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={() => { setSelectedDate(null); setSelectedEvent(null); setShowEventModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#2a1d08] text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
            >
              <Plus size={15} />
              Nytt
            </button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gold" />
          </div>
        ) : (
          <CalendarView
            events={allEvents}
            sources={sources}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Modals */}
      {showEventModal && (
        <EventModal
          initialDate={selectedDate ?? undefined}
          event={selectedEvent ?? undefined}
          onSave={handleSaveEvent}
          onDelete={selectedEvent?.source === 'own' ? handleDeleteEvent : undefined}
          onClose={() => { setShowEventModal(false); setSelectedEvent(null); setSelectedDate(null); }}
        />
      )}

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
