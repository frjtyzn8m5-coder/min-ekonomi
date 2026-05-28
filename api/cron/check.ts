import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// Beräknar sista och näst sista vardag i en given månad
function businessDays(year: number, month: number): number[] {
  const days: number[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) days.push(d);
  }
  return days;
}

function shouldSendToday(dayOfMonth: number, today: Date): boolean {
  const d = today.getDate();
  const bdays = businessDays(today.getFullYear(), today.getMonth());

  if (dayOfMonth === -1) return d === bdays[bdays.length - 1];
  if (dayOfMonth === -2) return d === bdays[bdays.length - 2];
  return d === dayOfMonth;
}

interface Reminder {
  id: string;
  title: string;
  emoji: string;
  dayOfMonth: number;
  time: string;
  active: boolean;
  lastSentMonth?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verifiera att anropet kommer från Vercel Cron
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const subJson = await kv.get<string>('push_subscription');
  if (!subJson) return res.status(200).json({ skipped: 'no subscription' });

  const remindersJson = await kv.get<string>('reminders');
  if (!remindersJson) return res.status(200).json({ skipped: 'no reminders' });

  const reminders: Reminder[] = JSON.parse(remindersJson);
  const today = new Date();
  const yyyyMM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const toSend = reminders.filter(r =>
    r.active &&
    r.lastSentMonth !== yyyyMM &&
    shouldSendToday(r.dayOfMonth, today)
  );

  const subscription = JSON.parse(subJson);
  const sent: string[] = [];

  for (const r of toSend) {
    await webpush.sendNotification(subscription, JSON.stringify({
      title: `${r.emoji} ${r.title}`,
      body: `Påminnelse för idag, ${today.toLocaleDateString('sv-SE')}`,
      icon: '/icon-192.png',
    }));
    r.lastSentMonth = yyyyMM;
    sent.push(r.id);
  }

  if (sent.length > 0) {
    // Uppdatera lastSentMonth i KV
    const updated = reminders.map(r => sent.includes(r.id) ? { ...r, lastSentMonth: yyyyMM } : r);
    await kv.set('reminders', JSON.stringify(updated));
  }

  return res.status(200).json({ sent });
}
