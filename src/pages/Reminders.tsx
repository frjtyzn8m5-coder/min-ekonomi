import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { Reminder } from '../types';
import { Bell, BellOff, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

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
        headers: { 'Content-Type': 'application/json' },
        body: subJson,
      });
      // Synka påminnelser till KV
      await fetch('/api/sync-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      fetch('/api/sync-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders: [...reminders, r] }),
      });
    }
  };

  const handleToggle = (r: Reminder) => {
    updateReminder(r.id, { active: !r.active });
    if (pushSubscription) {
      const updated = reminders.map(x => x.id === r.id ? { ...x, active: !r.active } : x);
      fetch('/api/sync-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders: updated }),
      });
    }
  };

  const hasPush = !!pushSubscription;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Påminnelser</h1>
        <p className="text-sm text-gray-400 mt-0.5">Push-notiser till din iPhone vid rätt tidpunkt</p>
      </div>

      {/* Push-status banner */}
      <div className={`rounded-xl p-4 flex items-center gap-4 ${hasPush ? 'bg-green-50 border border-green-100' : 'bg-blue-50 border border-blue-100'}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${hasPush ? 'bg-green-100' : 'bg-blue-100'}`}>
          {hasPush ? <Bell size={20} className="text-green-600" /> : <BellOff size={20} className="text-blue-500" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {hasPush ? 'Push-notiser aktiverade' : 'Aktivera push-notiser'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {hasPush
              ? 'Du får notiser på iPhone enligt schemat nedan.'
              : 'Klicka för att börja ta emot notiser. Kräver iOS 16.4+ och att appen är tillagd på hemskärmen.'}
          </p>
        </div>
        {!hasPush && (
          <button
            onClick={subscribeToPush}
            disabled={pushStatus === 'loading'}
            className="flex-shrink-0 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {pushStatus === 'loading' ? 'Aktiverar...' : 'Aktivera'}
          </button>
        )}
        {pushStatus === 'error' && (
          <p className="text-xs text-red-500">Kunde inte aktivera – är du på hemskärmen?</p>
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
              className={`bg-white rounded-xl border p-4 flex items-center gap-4 transition-opacity ${r.active ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}
            >
              <span className="text-2xl">{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                <p className="text-xs text-gray-400">{dayLabel(r.dayOfMonth)} · {r.time}</p>
              </div>
              <button onClick={() => handleToggle(r)} className="text-gray-400 hover:text-blue-500 transition-colors">
                {r.active ? <ToggleRight size={24} className="text-blue-500" /> : <ToggleLeft size={24} />}
              </button>
              <button onClick={() => deleteReminder(r.id)} className="text-gray-300 hover:text-red-400 transition-colors">
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
            className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
          >
            <p className="text-sm font-semibold text-gray-900">Ny påminnelse</p>
            <div className="flex gap-2">
              <input
                value={newEmoji}
                onChange={e => setNewEmoji(e.target.value)}
                className="w-12 border border-gray-200 rounded-lg text-center text-lg outline-none focus:border-blue-400"
                maxLength={2}
              />
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Titel, t.ex. Betala faktura"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-gray-500">Dag i månaden:</label>
              <select
                value={newDay}
                onChange={e => setNewDay(Number(e.target.value))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Dag {d}</option>
                ))}
                <option value={-2}>Näst sista vardagen</option>
                <option value={-1}>Sista vardagen</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Avbryt</button>
              <button onClick={handleAddReminder} disabled={!newTitle.trim()} className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-40">Spara</button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowAdd(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Lägg till påminnelse
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
