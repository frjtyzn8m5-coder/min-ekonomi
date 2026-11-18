import { useState } from 'react';
import { useStore } from '../store/useStore';
import { auth } from '../lib/firebase';
import type { Reminder } from '../types';
import { Bell, BellOff, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

// Attach the signed-in user's Firebase ID token so the push endpoints can verify
// the caller server-side (they reject unauthenticated requests).
async function authedJsonHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Fire-and-forget sync of the reminder list to the server (used from sync handlers).
function syncReminders(reminders: Reminder[]): void {
  authedJsonHeaders()
    .then(headers =>
      fetch('/api/sync-reminders', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reminders }),
      }),
    )
    .catch(console.error);
}

function dayLabel(day: number): string {
  if (day === -1) return 'Sista vardagen i månaden';
  if (day === -2) return 'Näst sista vardagen i månaden';
  return `Dag ${day} varje månad`;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export default function Reminders() {
  const { reminders, addReminder, updateReminder, deleteReminder, setPushSubscription, pushSubscription } = useStore();
  const [pushStatus, setPushStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newEmoji, setNewEmoji] = useState('🔔');
  const [newDay, setNewDay] = useState<number>(1);

  const subscribeToPush = async () => {
    setPushStatus('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const subJson = JSON.stringify(sub);
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: await authedJsonHeaders(),
        body: subJson,
      });
      // Synka påminnelser till KV
      await fetch('/api/sync-reminders', {
        method: 'POST',
        headers: await authedJsonHeaders(),
        body: JSON.stringify({ reminders }),
      });
      setPushSubscription(subJson);
      setPushStatus('ok');
    } catch (e) {
      console.error(e);
      setPushStatus('error');
    }
  };

  const handleAddReminder = () => {
    if (!newTitle.trim()) return;
    const r: Reminder = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      emoji: newEmoji,
      dayOfMonth: newDay,
      time: '08:00',
      active: true,
    };
    addReminder(r);
    setNewTitle('');
    setNewEmoji('🔔');
    setNewDay(1);
    setShowAdd(false);
    // Synka om vi redan har subscription
    if (pushSubscription) {
      syncReminders([...reminders, r]);
    }
  };

  const handleToggle = (r: Reminder) => {
    updateReminder(r.id, { active: !r.active });
    if (pushSubscription) {
      const updated = reminders.map(x => x.id === r.id ? { ...x, active: !r.active } : x);
      syncReminders(updated);
    }
  };

  const hasPush = !!pushSubscription;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl text-ink">Påminnelser</h1>
        <p className="text-sm text-faint mt-0.5">Push-notiser till din iPhone vid rätt tidpunkt</p>
      </div>

      {/* Push-status banner */}
      <div className="vh-card p-4 flex items-center gap-4"
        style={{ border: `1px solid ${hasPush ? 'rgba(95,224,208,.25)' : 'rgba(233,193,120,.25)'}` }}>
        <div className={`vh-tile w-10 h-10 text-[#2a1d08] ${hasPush ? 'vh-tile--cyan' : 'vh-tile--gold'}`}>
          {hasPush ? <Bell size={20} /> : <BellOff size={20} />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">
            {hasPush ? 'Push-notiser aktiverade' : 'Aktivera push-notiser'}
          </p>
          <p className="text-xs text-mut mt-0.5">
            {hasPush
              ? 'Du får notiser på iPhone enligt schemat nedan.'
              : 'Klicka för att börja ta emot notiser. Kräver iOS 16.4+ och att appen är tillagd på hemskärmen.'}
          </p>
        </div>
        {!hasPush && (
          <button
            onClick={subscribeToPush}
            disabled={pushStatus === 'loading'}
            className="flex-shrink-0 px-4 py-2 text-[#2a1d08] text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
          >
            {pushStatus === 'loading' ? 'Aktiverar...' : 'Aktivera'}
          </button>
        )}
        {pushStatus === 'error' && (
          <p className="text-xs text-coral">Kunde inte aktivera – är du på hemskärmen?</p>
        )}
      </div>

      {/* Reminder list */}
      <div className="space-y-2">
        <AnimatePresence>
          {reminders.map(r => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className={`vh-card p-4 flex items-center gap-4 transition-opacity ${r.active ? '' : 'opacity-50'}`}
            >
              <span className="text-2xl">{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">{r.title}</p>
                <p className="text-xs text-faint">{dayLabel(r.dayOfMonth)} · {r.time}</p>
              </div>
              <button onClick={() => handleToggle(r)} className="text-mut hover:text-gold transition-colors">
                {r.active ? <ToggleRight size={24} className="text-gold" /> : <ToggleLeft size={24} />}
              </button>
              <button onClick={() => deleteReminder(r.id)} className="text-faint hover:text-coral transition-colors">
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add reminder */}
      <AnimatePresence>
        {showAdd ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="vh-card p-4 space-y-3"
          >
            <p className="text-sm font-semibold text-ink">Ny påminnelse</p>
            <div className="flex gap-2">
              <input
                value={newEmoji}
                onChange={e => setNewEmoji(e.target.value)}
                className="w-12 bg-soft text-ink border border-line rounded-lg text-center text-lg outline-none focus:border-gold/50"
                maxLength={2}
              />
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Titel, t.ex. Betala faktura"
                className="flex-1 bg-soft text-ink border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-gold/50"
              />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-mut">Dag i månaden:</label>
              <select
                value={newDay}
                onChange={e => setNewDay(Number(e.target.value))}
                className="flex-1 bg-soft text-ink border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-gold/50"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Dag {d}</option>
                ))}
                <option value={-2}>Näst sista vardagen</option>
                <option value={-1}>Sista vardagen</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-mut hover:text-ink">Avbryt</button>
              <button onClick={handleAddReminder} disabled={!newTitle.trim()} className="px-4 py-2 text-[#2a1d08] text-sm font-semibold rounded-lg disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>Spara</button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowAdd(true)}
            className="w-full py-3 border-2 border-dashed border-line rounded-xl text-sm text-faint hover:border-gold/40 hover:text-gold transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Lägg till påminnelse
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
