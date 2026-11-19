import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { auth } from '../lib/firebase';
import { saveNotificationSettings } from '../lib/db';
import { isDemoMode } from '../lib/demoData';
import type { NotificationSettings, NotificationChannel } from '../types';
import {
  Bell, Send, Mail, MessageCircle, Smartphone, Check, Moon, ShieldCheck,
} from 'lucide-react';
import PageBanner from '../components/ui/PageBanner';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

// Fyll i din bots användarnamn här (eller låt dev göra det). Format: utan @.
const TELEGRAM_BOT_USERNAME = 'DittBott_bot';

// ── Hjälpfunktioner (delade med Reminders) ───────────────────────────────────
async function authedJsonHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

// Ta bort undefined-fält innan vi skriver till Firestore (Firestore tillåter ej undefined).
function stripUndefined(obj: NotificationSettings): NotificationSettings {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as NotificationSettings;
}

const CHANNEL_META: { key: NotificationChannel; label: string; icon: typeof Bell }[] = [
  { key: 'push',     label: 'Push',     icon: Smartphone },
  { key: 'telegram', label: 'Telegram', icon: MessageCircle },
  { key: 'email',    label: 'E-post',   icon: Mail },
  { key: 'sms',      label: 'SMS',      icon: Send },
];

export default function Notifications() {
  const { notificationSettings, setNotificationSettings, pushSubscription, setPushSubscription, reminders } = useStore();
  const { user } = useAuthStore();

  const [pushStatus, setPushStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [savedFlash, setSavedFlash] = useState(false);

  // Lokala textfält (synkas till store vid onBlur/spara)
  const [telegramId, setTelegramId] = useState(notificationSettings.telegramChatId ?? '');
  const [email, setEmail] = useState(notificationSettings.email ?? '');
  const [phone, setPhone] = useState(notificationSettings.phone ?? '');

  const pushSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const permission: NotificationPermission | 'unsupported' =
    pushSupported ? Notification.permission : 'unsupported';

  const hasPush = !!pushSubscription && notificationSettings.webPushEnabled !== false;

  // ── Spara-hjälpare ──────────────────────────────────────────────────────────
  const persist = async (partial: Partial<NotificationSettings>) => {
    const next: NotificationSettings = {
      ...useStore.getState().notificationSettings,
      ...partial,
      updatedAt: Date.now(),
    };
    setNotificationSettings(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);

    // Demo-läge: bara lokalt, ingen nätverkstrafik.
    if (isDemoMode() || !user) return;
    const clean = stripUndefined(next);
    try {
      await saveNotificationSettings(user.uid, clean);
      await fetch('/api/sync-notification-settings', {
        method: 'POST',
        headers: await authedJsonHeaders(),
        body: JSON.stringify({ settings: clean }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // ── Web push ────────────────────────────────────────────────────────────────
  const enablePush = async () => {
    setPushStatus('loading');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushStatus('error'); return; }

      // Demo: hoppa över nätverk, flagga bara lokalt.
      if (isDemoMode()) {
        await persist({ webPushEnabled: true });
        setPushStatus('ok');
        return;
      }

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
      // Synka påminnelser till KV så cron kan leverera dem.
      await fetch('/api/sync-reminders', {
        method: 'POST',
        headers: await authedJsonHeaders(),
        body: JSON.stringify({ reminders }),
      });
      setPushSubscription(subJson);

      const channels = notificationSettings.channels ?? [];
      await persist({
        webPushEnabled: true,
        channels: channels.includes('push') ? channels : [...channels, 'push'],
      });
      setPushStatus('ok');
    } catch (e) {
      console.error(e);
      setPushStatus('error');
    }
  };

  const sendTest = async () => {
    setTestStatus('loading');
    try {
      const res = await fetch('/api/send-test', {
        method: 'POST',
        headers: await authedJsonHeaders(),
      });
      setTestStatus(res.ok ? 'ok' : 'error');
    } catch (e) {
      console.error(e);
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  // ── Kanaler ──────────────────────────────────────────────────────────────────
  const channels = notificationSettings.channels ?? [];
  const toggleChannel = (ch: NotificationChannel) => {
    const next = channels.includes(ch)
      ? channels.filter(c => c !== ch)
      : [...channels, ch];
    void persist({ channels: next });
  };

  // ── Stör ej ──────────────────────────────────────────────────────────────────
  const quiet = notificationSettings.quietHours;
  const toggleQuiet = () => {
    void persist({ quietHours: quiet ? undefined : { start: '22:00', end: '07:00' } });
  };
  const setQuiet = (field: 'start' | 'end', value: string) => {
    void persist({ quietHours: { start: quiet?.start ?? '22:00', end: quiet?.end ?? '07:00', [field]: value } });
  };

  const pushStatusLabel =
    permission === 'unsupported' ? 'Stöds ej i denna webbläsare'
    : hasPush ? 'På'
    : permission === 'denied' ? 'Blockerad i webbläsaren'
    : 'Av';

  return (
    <div className="min-h-full bg-bg text-ink">
      <PageBanner
        img="/img/f-cal.jpg"
        eyebrow="Ekonomi"
        title="Notiser"
        subtitle="Ett ställe för alla gratis-kanaler – välj hur dina påminnelser når din telefon"
        action={
          savedFlash ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-cyan bg-black/30 px-3 py-1.5 rounded-full">
              <Check size={13} /> Sparat
            </span>
          ) : undefined
        }
      />

      <div className="max-w-[1600px] mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Integritets-notis */}
        <div className="vh-card p-4 flex items-start gap-3" style={{ border: '1px solid rgba(95,224,208,.2)' }}>
          <div className="vh-tile vh-tile--cyan w-9 h-9 text-[#06251f] flex-shrink-0"><ShieldCheck size={18} /></div>
          <p className="text-xs text-mut leading-relaxed">
            Den här sidan innehåller <span className="text-ink font-medium">inga hemligheter eller API-nycklar</span>.
            Du fyller bara i ditt eget Telegram-id, din e-post och ditt telefonnummer – de sparas i din profil.
            Utkast: granska gärna innan du förlitar dig på leveransen.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Web push ── */}
          <div className="vh-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`vh-tile w-10 h-10 text-[#2a1d08] ${hasPush ? 'vh-tile--cyan' : 'vh-tile--gold'}`}>
                <Smartphone size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">Push till telefon/webbläsare</p>
                <p className="text-xs text-faint mt-0.5">Status: <span className={hasPush ? 'text-cyan' : 'text-mut'}>{pushStatusLabel}</span></p>
              </div>
            </div>

            <p className="text-xs text-mut leading-relaxed">
              Helt gratis och utan app. På iPhone krävs iOS 16.4+ och att appen är tillagd på hemskärmen
              (dela → Lägg till på hemskärmen), öppna den därifrån och aktivera sedan här.
            </p>

            <div className="flex flex-wrap gap-2">
              {!hasPush ? (
                <button
                  onClick={enablePush}
                  disabled={pushStatus === 'loading' || permission === 'unsupported' || permission === 'denied'}
                  className="px-4 py-2 text-[#2a1d08] text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
                >
                  {pushStatus === 'loading' ? 'Aktiverar…' : 'Aktivera push'}
                </button>
              ) : (
                <button
                  onClick={sendTest}
                  disabled={testStatus === 'loading'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-soft border border-line text-ink text-xs font-semibold rounded-lg hover:border-gold/40 transition-colors disabled:opacity-60"
                >
                  <Send size={13} />
                  {testStatus === 'loading' ? 'Skickar…' : 'Skicka testnotis'}
                </button>
              )}
            </div>

            {permission === 'denied' && (
              <p className="text-xs text-coral">Notiser är blockerade – tillåt dem i webbläsarens inställningar för sidan.</p>
            )}
            {pushStatus === 'error' && permission !== 'denied' && (
              <p className="text-xs text-coral">Kunde inte aktivera – är appen öppnad från hemskärmen?</p>
            )}
            {testStatus === 'ok' && <p className="text-xs text-cyan">Testnotis skickad – kolla din telefon.</p>}
            {testStatus === 'error' && <p className="text-xs text-coral">Kunde inte skicka testnotis.</p>}
          </div>

          {/* ── Telegram ── */}
          <div className="vh-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="vh-tile vh-tile--violet w-10 h-10 text-[#120a2e]"><MessageCircle size={20} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">Telegram</p>
                <p className="text-xs text-faint mt-0.5">Gratis, pålitligt – funkar på alla telefoner</p>
              </div>
            </div>

            <ol className="text-xs text-mut leading-relaxed list-decimal pl-4 space-y-1">
              <li>
                Öppna boten:{' '}
                <a
                  href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                  target="_blank" rel="noreferrer"
                  className="text-violet underline break-all"
                >
                  t.me/{TELEGRAM_BOT_USERNAME}
                </a>
              </li>
              <li>Skicka <code className="text-ink bg-soft px-1 rounded">/start</code> i chatten.</li>
              <li>Boten svarar med ditt <span className="text-ink">chat-id</span> – klistra in det nedan.</li>
            </ol>

            <div>
              <label className="text-xs text-mut">Telegram chat-id</label>
              <div className="flex gap-2 mt-1">
                <input
                  value={telegramId}
                  onChange={e => setTelegramId(e.target.value)}
                  onBlur={() => persist({ telegramChatId: telegramId.trim() || undefined })}
                  placeholder="t.ex. 123456789"
                  inputMode="numeric"
                  className="flex-1 bg-soft text-ink border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-gold/50"
                />
              </div>
            </div>

            <p className="text-[11px] text-faint leading-relaxed">
              Kräver en serverless-del som skickar via Telegram Bot-API (secret <code>TELEGRAM_BOT_TOKEN</code>).
              Se rapporten – ditt id sparas redan, leveransen behöver kopplas på.
            </p>
          </div>

          {/* ── E-post / SMS ── */}
          <div className="vh-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="vh-tile vh-tile--gold w-10 h-10 text-[#2a1d08]"><Mail size={20} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">E-post & SMS</p>
                <p className="text-xs text-faint mt-0.5">E-post är gratis · SMS kräver betald leverantör</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-mut">E-postadress</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => persist({ email: email.trim() || undefined })}
                placeholder="namn@exempel.se"
                className="w-full mt-1 bg-soft text-ink border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-gold/50"
              />
            </div>

            <div>
              <label className="text-xs text-mut flex items-center gap-2">
                Telefonnummer (SMS)
                <span className="text-[10px] uppercase tracking-wide text-faint border border-line rounded px-1.5 py-0.5">Kommande</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onBlur={() => persist({ phone: phone.trim() || undefined })}
                placeholder="+4670…"
                className="w-full mt-1 bg-soft text-ink border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-gold/50"
              />
            </div>

            <p className="text-[11px] text-faint leading-relaxed">
              E-post behöver en serverless-del + gratis leverantör (t.ex. Resend). SMS kräver en betald tjänst
              (t.ex. Twilio/46elks) och är därför valfritt/kommande. Dina uppgifter sparas redan.
            </p>
          </div>

          {/* ── Kanaler + Stör ej ── */}
          <div className="vh-card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="vh-tile vh-tile--lime w-10 h-10 text-[#16230a]"><Bell size={20} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">Leverans av påminnelser</p>
                <p className="text-xs text-faint mt-0.5">Välj vilka kanaler dina påminnelser skickas till</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CHANNEL_META.map(({ key, label, icon: Icon }) => {
                const on = channels.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleChannel(key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      on ? 'text-ink' : 'text-mut border-line hover:border-gold/30'
                    }`}
                    style={on ? { background: 'rgba(233,193,120,.12)', borderColor: 'rgba(233,193,120,.4)' } : undefined}
                  >
                    <Icon size={16} className={on ? 'text-gold' : 'text-faint'} />
                    <span className="flex-1 text-left">{label}</span>
                    {on && <Check size={14} className="text-gold" />}
                  </button>
                );
              })}
            </div>

            {/* Stör ej */}
            <div className="border-t border-line pt-4 space-y-3">
              <button onClick={toggleQuiet} className="flex items-center gap-3 w-full text-left">
                <div className={`vh-tile w-9 h-9 ${quiet ? 'vh-tile--violet text-[#120a2e]' : 'bg-soft text-faint'}`}>
                  <Moon size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-ink font-medium">Stör ej</p>
                  <p className="text-xs text-faint">{quiet ? `Tyst ${quiet.start}–${quiet.end}` : 'Avstängt'}</p>
                </div>
                <span className={`text-xs font-semibold ${quiet ? 'text-violet' : 'text-mut'}`}>{quiet ? 'På' : 'Av'}</span>
              </button>

              {quiet && (
                <div className="flex items-center gap-3 pl-12">
                  <input
                    type="time"
                    value={quiet.start}
                    onChange={e => setQuiet('start', e.target.value)}
                    className="bg-soft text-ink border border-line rounded-lg px-2 py-1.5 text-sm outline-none focus:border-gold/50"
                  />
                  <span className="text-xs text-faint">till</span>
                  <input
                    type="time"
                    value={quiet.end}
                    onChange={e => setQuiet('end', e.target.value)}
                    className="bg-soft text-ink border border-line rounded-lg px-2 py-1.5 text-sm outline-none focus:border-gold/50"
                  />
                </div>
              )}
            </div>

            <p className="text-[11px] text-faint leading-relaxed">
              Idag levereras påminnelser via <span className="text-ink">push</span> (cron-jobbet). Övriga kanaler
              sparas och väntar på sin serverless-del innan de skickar – se rapporten.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
