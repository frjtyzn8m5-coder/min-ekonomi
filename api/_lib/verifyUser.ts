import type { VercelRequest } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// ── Server-side Firebase auth ────────────────────────────────────────────────────
// Verifies the caller's Firebase ID token so unauthenticated clients cannot write
// to our Redis-backed endpoints. Requires a service-account credential in the
// FIREBASE_SERVICE_ACCOUNT env var (the full JSON key, as a single string).
//
// Fails closed: if the credential is missing or the token is invalid, the caller
// is treated as unauthenticated.

/** True once a service-account credential is configured; auth is enforced only then. */
export function isAuthConfigured(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
}

function ensureApp() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  const serviceAccount = JSON.parse(raw);
  initializeApp({ credential: cert(serviceAccount) });
}

/**
 * Returns the authenticated user's uid, or null if the request has no valid
 * Firebase ID token (Authorization: Bearer <token>).
 */
export async function getUid(req: VercelRequest): Promise<string | null> {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;

  try {
    ensureApp();
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
