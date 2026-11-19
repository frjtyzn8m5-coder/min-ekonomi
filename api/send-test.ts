import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import webpush from 'web-push';
import { getUid, isAuthConfigured } from './_lib/verifyUser';

// Sends a single test web-push to the stored subscription, so the user can
// confirm notifications actually arrive on their phone. Reuses the same VAPID
// details and Redis key as the cron job (api/cron/check.ts) — no new secrets.
const redis = Redis.fromEnv();

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Enforce auth only once a service-account credential is configured (progressive hardening).
  if (isAuthConfigured()) {
    const uid = await getUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  }

  const subJson = await redis.get<string>('push_subscription');
  if (!subJson) return res.status(400).json({ error: 'no subscription' });

  const subscription = JSON.parse(subJson);
  try {
    await webpush.sendNotification(subscription, JSON.stringify({
      title: '🔔 Testnotis',
      body: 'Dina push-notiser fungerar – du får påminnelser här.',
      icon: '/icon-192.png',
    }));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'send failed' });
  }
}
