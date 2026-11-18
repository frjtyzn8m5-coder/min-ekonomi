import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { getUid, isAuthConfigured } from './_lib/verifyUser';

const redis = Redis.fromEnv();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Enforce auth only once a service-account credential is configured (progressive hardening).
  if (isAuthConfigured()) {
    const uid = await getUid(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  }

  const { reminders } = req.body;
  if (!Array.isArray(reminders)) return res.status(400).json({ error: 'Invalid' });
  await redis.set('reminders', JSON.stringify(reminders));
  return res.status(200).json({ ok: true });
}
