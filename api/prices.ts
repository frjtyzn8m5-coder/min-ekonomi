import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const CRUMB_KEY = 'yf_crumb_v1';
const COOKIE_KEY = 'yf_cookie_v1';
const CRUMB_TTL = 3600; // 1 hour

// Yahoo Finance now requires a crumb + cookie obtained from a prior session.
// We cache both in Redis to avoid refetching on every price request.
async function getYahooCrumb(): Promise<{ crumb: string; cookie: string }> {
  // Try cache first
  const [cachedCrumb, cachedCookie] = await Promise.all([
    redis.get<string>(CRUMB_KEY),
    redis.get<string>(COOKIE_KEY),
  ]);
  if (cachedCrumb && cachedCookie) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }

  // Fetch Yahoo Finance to get a session cookie
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  const pageResp = await fetch('https://finance.yahoo.com/quote/AAPL/', {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
  });

  // Collect all Set-Cookie values
  const rawCookies: string[] = [];
  pageResp.headers.forEach((val, key) => {
    if (key.toLowerCase() === 'set-cookie') rawCookies.push(val);
  });
  const cookie = rawCookies.map(c => c.split(';')[0]).join('; ');

  // Fetch crumb using the cookie
  const crumbResp = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'User-Agent': UA,
      'Cookie': cookie,
      'Accept': 'text/plain',
    },
  });
  const crumb = (await crumbResp.text()).trim();
  if (!crumb || crumb.includes('<')) {
    throw new Error('Failed to obtain Yahoo Finance crumb');
  }

  // Cache both
  await Promise.all([
    redis.set(CRUMB_KEY, crumb, { ex: CRUMB_TTL }),
    redis.set(COOKIE_KEY, cookie, { ex: CRUMB_TTL }),
  ]);

  return { crumb, cookie };
}

// Fetch live prices + FX rates from Yahoo Finance
// GET /api/prices?tickers=AFRY.ST,NAS.OL,NOKSEK=X,EURSEK=X
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tickersParam = String(req.query.tickers ?? '');
  const allSymbols = [...new Set(
    tickersParam.split(',').map(s => s.trim()).filter(Boolean)
  )];

  if (allSymbols.length === 0) return res.status(400).json({ error: 'No tickers provided' });

  try {
    const { crumb, cookie } = await getYahooCrumb();
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

    const url = `https://query2.finance.yahoo.com/v7/finance/quote?crumb=${encodeURIComponent(crumb)}&symbols=${encodeURIComponent(allSymbols.join(','))}&fields=regularMarketPrice,regularMarketChangePercent,currency,shortName`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Cookie': cookie,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const json = await response.json() as any;
    const quotes: any[] = json?.quoteResponse?.result ?? [];

    // If crumb was stale (Yahoo returns 0 results), bust cache and retry once
    if (quotes.length === 0 && allSymbols.length > 0) {
      await Promise.all([redis.del(CRUMB_KEY), redis.del(COOKIE_KEY)]);
      const fresh = await getYahooCrumb();
      const retryUrl = `https://query2.finance.yahoo.com/v7/finance/quote?crumb=${encodeURIComponent(fresh.crumb)}&symbols=${encodeURIComponent(allSymbols.join(','))}&fields=regularMarketPrice,regularMarketChangePercent,currency,shortName`;
      const retryResp = await fetch(retryUrl, {
        headers: {
          'User-Agent': UA,
          'Cookie': fresh.cookie,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      const retryJson = await retryResp.json() as any;
      quotes.push(...(retryJson?.quoteResponse?.result ?? []));
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

    return res.status(200).json(result);
  } catch (e: any) {
    // Bust crumb cache on error so next call retries fresh
    await Promise.all([redis.del(CRUMB_KEY), redis.del(COOKIE_KEY)]).catch(() => {});
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
