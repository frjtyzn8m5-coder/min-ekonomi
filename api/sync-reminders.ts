import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { reminders } = req.body;
  if (!Array.isArray(reminders)) return res.status(400).json({ error: 'Invalid' });
  await kv.set('reminders', JSON.stringify(reminders));
  return res.status(200).json({ ok: true });
}
