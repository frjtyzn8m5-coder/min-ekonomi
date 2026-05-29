import type { VercelRequest, VercelResponse } from '@vercel/node';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Fetches daily closing prices for a Yahoo Finance symbol over the past 2 years.
// Returns an array of { date: "YYYY-MM-DD", close: number } sorted ascending.
async function fetchHistory(symbol: string): Promise<{ date: string; close: number }[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
    });
    if (!resp.ok) return [];
    const json = await resp.json() as any;
    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

    const out: { date: string; close: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (!close || !timestamps[i]) continue;
      const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      out.push({ date, close });
    }
    return out;
  } catch {
    return [];
  }
}

// Normalise a series to % return from the first data point on or after `fromDate`.
function normalise(data: { date: string; close: number }[], fromDate: string): { date: string; pct: number }[] {
  const filtered = data.filter(d => d.date >= fromDate);
  if (!filtered.length) return [];
  const base = filtered[0].close;
  return filtered.map(d => ({ date: d.date, pct: ((d.close - base) / base) * 100 }));
}

// GET /api/index-history?from=2024-01-15
// Returns { omxs30: [{date,pct}], nasdaq: [{date,pct}] } normalised from `from`.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const from = String(req.query.from ?? '').slice(0, 10);
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return res.status(400).json({ error: 'from date required (YYYY-MM-DD)' });
  }

  const [omxRaw, nasdaqRaw] = await Promise.all([
    fetchHistory('^OMX'),   // OMXS30
    fetchHistory('^IXIC'),  // Nasdaq Composite
  ]);

  return res.status(200).json({
    omxs30:  normalise(omxRaw, from),
    nasdaq:  normalise(nasdaqRaw, from),
  });
}
