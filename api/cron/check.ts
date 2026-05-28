import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const redis = Redis.fromEnv();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

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
  id: string; title: string; emoji: string;
  dayOfMonth: number; time: string; active: boolean; lastSentMonth?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const subJson = await redis.get<string>('push_subscription');
  if (!subJson) return res.status(200).json({ skipped: 'no subscription' });

  const remindersRaw = await redis.get<string>('reminders');
  if (!remindersRaw) return res.status(200).json({ skipped: 'no reminders' });

  const reminders: Reminder[] = JSON.parse(remindersRaw);
  const today = new Date();
  const yyyyMM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const toSend = reminders.filter(r =>
    r.active && r.lastSentMonth !== yyyyMM && shouldSendToday(r.dayOfMonth, today)
  );

  const subscription = JSON.parse(subJson);
  const sent: string[] = [];

  for (const r of toSend) {
    await webpush.sendNotification(subscription, JSON.stringify({
      title: `${r.emoji} ${r.title}`,
      body: `Påminnelse för ${today.toLocaleDateString('sv-SE')}`,
      icon: '/icon-192.png',
    }));
    sent.push(r.id);
  }

  if (sent.length > 0) {
    const updated = reminders.map(r => sent.includes(r.id) ? { ...r, lastSentMonth: yyyyMM } : r);
    await redis.set('reminders', JSON.stringify(updated));
  }

  return res.status(200).json({ sent });
}
