import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { getUid, isAuthConfigured } from './_lib/verifyUser';

// Mirrors the user's notification settings (channels, telegramChatId, email,
// phone, quietHours) into Redis so a future delivery job can read them server-
// side — same pattern as api/sync-reminders.ts. NOTE: this endpoint only stores
// the settings; it does NOT itself deliver anything. Web push already works via
// api/cron/check.ts. Delivery via Telegram / email / SMS still needs a serverless
// sender + provider secret (see report). No secrets are stored here.
const redis = Redis.fromEnv();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Enforce auth only once a service-account credential is configured (progressive hardening).
  if (isAuthConfigured()) {
    const uid = await getUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  }

  const { settings } = req.body ?? {};
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'Invalid' });

  await redis.set('notification_settings', JSON.stringify(settings));
  return res.status(200).json({ ok: true });
}
