import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── DISABLED ────────────────────────────────────────────────────────────────────
// This endpoint previously stored the entire app dataset in a single, GLOBALLY
// read/writable Upstash Redis key ('app_data_v1') with no authentication and
// `Access-Control-Allow-Origin: *` — meaning anyone on the internet could read or
// overwrite all app data. The client no longer calls it (data lives in Firestore,
// scoped per user under users/{uid}/…), so it is permanently disabled.
//
// Safe to delete this file entirely.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({ error: 'This endpoint has been removed.' });
}
