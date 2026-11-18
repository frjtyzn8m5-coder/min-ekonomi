import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// ── SSRF guard ─────────────────────────────────────────────────────────────────
// Validates a user-supplied URL before the server fetches it, so an attacker
// cannot point our serverless function at internal services or the cloud
// metadata endpoint (169.254.169.254) and read the response back.

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true;                       // 10.0.0.0/8
    if (a === 127) return true;                      // loopback
    if (a === 0) return true;                        // 0.0.0.0/8
    if (a === 169 && b === 254) return true;         // link-local / metadata
    if (a === 172 && b >= 16 && b <= 31) return true;// 172.16.0.0/12
    if (a === 192 && b === 168) return true;         // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;// CGNAT 100.64.0.0/10
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;                // loopback
    if (lower.startsWith('fe80')) return true;       // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
    if (lower === '::' ) return true;
    // IPv4-mapped (::ffff:a.b.c.d)
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return false;
}

/**
 * Throws if the URL is not a public http(s) address.
 * Resolves DNS and rejects when any resolved address is private/loopback/link-local.
 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('Host not allowed');
  }

  // If the host is a literal IP, check it directly; otherwise resolve it.
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Host not allowed');
    return url;
  }

  const results = await lookup(host, { all: true });
  if (results.some(r => isPrivateIp(r.address))) {
    throw new Error('Host resolves to a private address');
  }

  return url;
}
