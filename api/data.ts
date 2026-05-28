import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const DATA_KEY = 'app_data_v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const data = await redis.get(DATA_KEY);
      return res.status(200).json(data ?? null);
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid body' });
      }
      // Store with last-modified timestamp
      const payload = { ...body, _savedAt: Date.now() };
      await redis.set(DATA_KEY, JSON.stringify(payload));
      return res.status(200).json({ ok: true, savedAt: payload._savedAt });
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  }

  return res.status(405).end();
}
