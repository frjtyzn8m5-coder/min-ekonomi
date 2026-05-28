import type { VercelRequest, VercelResponse } from '@vercel/node';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Try to fetch Yahoo Finance quotes; returns array of quote objects (may be empty)
async function fetchQuotes(symbols: string[], crumb?: string, cookie?: string): Promise<any[]> {
  const base = 'https://query2.finance.yahoo.com/v7/finance/quote';
  const params = new URLSearchParams({
    symbols: symbols.join(','),
    fields: 'regularMarketPrice,regularMarketChangePercent,currency,shortName',
  });
  if (crumb) params.set('crumb', crumb);

  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (cookie) headers['Cookie'] = cookie;

  const resp = await fetch(`${base}?${params}`, { headers });
  if (!resp.ok) return [];
  const json = await resp.json() as any;
  return json?.quoteResponse?.result ?? [];
}

// Fetch a crumb + cookie from Yahoo Finance (needed when direct access is blocked)
async function fetchCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    // Step 1: hit any Yahoo Finance page to get a session cookie
    const pageResp = await fetch('https://finance.yahoo.com/quote/AAPL/', {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
    });

    // Node 18+ fetch (undici): getSetCookie() returns all Set-Cookie headers as array
    let cookies: string[] = [];
    if (typeof (pageResp.headers as any).getSetCookie === 'function') {
      cookies = (pageResp.headers as any).getSetCookie() as string[];
    } else {
      // Fallback for older runtimes
      const raw = pageResp.headers.get('set-cookie') ?? '';
      if (raw) cookies = [raw];
    }
    const cookie = cookies.map((c: string) => c.split(';')[0]).join('; ');

    // Step 2: fetch crumb
    const crumbResp = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Cookie': cookie, 'Accept': 'text/plain' },
    });
    const crumb = (await crumbResp.text()).trim();

    if (!crumb || crumb.startsWith('<') || crumb.length > 50) return null;
    return { crumb, cookie };
  } catch {
    return null;
  }
}

// Try Redis cache for crumb (optional – skip gracefully if Redis unavailable)
async function getCachedCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();
    const [crumb, cookie] = await Promise.all([
      redis.get<string>('yf_crumb_v2'),
      redis.get<string>('yf_cookie_v2'),
    ]);
    if (crumb && cookie) return { crumb, cookie };
  } catch { /* Redis not available */ }
  return null;
}

async function cacheCrumb(crumb: string, cookie: string): Promise<void> {
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();
    await Promise.all([
      redis.set('yf_crumb_v2', crumb, { ex: 3600 }),
      redis.set('yf_cookie_v2', cookie, { ex: 3600 }),
    ]);
  } catch { /* Redis not available */ }
}

// GET /api/prices?tickers=AFRY.ST,NAS.OL,NOKSEK=X,EURSEK=X
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tickersParam = String(req.query.tickers ?? '');
  const symbols = [...new Set(tickersParam.split(',').map(s => s.trim()).filter(Boolean))];
  if (symbols.length === 0) return res.status(400).json({ error: 'No tickers provided' });

  try {
    // 1. Try direct (no crumb) – works sometimes depending on Vercel region/IP
    let quotes = await fetchQuotes(symbols);

    // 2. If empty, use crumb from cache or fetch fresh
    if (quotes.length === 0) {
      let creds = await getCachedCrumb();
      if (!creds) {
        creds = await fetchCrumb();
        if (creds) await cacheCrumb(creds.crumb, creds.cookie);
      }
      if (creds) {
        quotes = await fetchQuotes(symbols, creds.crumb, creds.cookie);
        // If still empty, crumb may be stale – refetch once
        if (quotes.length === 0) {
          creds = await fetchCrumb();
          if (creds) {
            await cacheCrumb(creds.crumb, creds.cookie);
            quotes = await fetchQuotes(symbols, creds.crumb, creds.cookie);
          }
        }
      }
    }

    const result: Record<string, { price: number; currency: string; changePercent: number; name: string }> = {};
    for (const q of quotes) {
      result[q.symbol] = {
        price: q.regularMarketPrice ?? 0,
        currency: q.currency ?? 'SEK',
        changePercent: q.regularMarketChangePercent ?? 0,
        name: q.shortName ?? q.symbol,
      };
    }

    // Log how many we resolved (visible in Vercel function logs)
    console.log(`[prices] requested=${symbols.length} resolved=${quotes.length} symbols=${symbols.join(',')}`);

    return res.status(200).json(result);
  } catch (e: any) {
    console.error('[prices] error:', e?.message ?? e);
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
