import type { VercelRequest, VercelResponse } from '@vercel/node';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Use Yahoo Finance v8/finance/chart per symbol – works without crumb/cookie auth.
// For FX pairs (e.g. NOKSEK=X) the same endpoint works fine.
async function fetchSingleQuote(symbol: string): Promise<{
  price: number; currency: string; changePercent: number; name: string;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!resp.ok) return null;
    const json = await resp.json() as any;
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price: number = meta.regularMarketPrice ?? meta.previousClose ?? 0;
    if (!price) return null;

    // regularMarketChangePercent is usually in meta for recent trading days
    const changePercent: number = meta.regularMarketChangePercent
      ?? (meta.chartPreviousClose && price
        ? ((price - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
        : 0);

    return {
      price,
      currency: meta.currency ?? 'SEK',
      changePercent,
      name: meta.shortName ?? meta.longName ?? symbol,
    };
  } catch {
    return null;
  }
}

// GET /api/prices?tickers=0P0001IMY7.ST,NAS.OL,NOKSEK=X,EURSEK=X
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tickersParam = String(req.query.tickers ?? '');
  const symbols = [...new Set(tickersParam.split(',').map(s => s.trim()).filter(Boolean))];
  if (symbols.length === 0) return res.status(400).json({ error: 'No tickers provided' });

  // Fetch all symbols in parallel
  const results = await Promise.all(symbols.map(async (sym) => ({ sym, data: await fetchSingleQuote(sym) })));

  const result: Record<string, { price: number; currency: string; changePercent: number; name: string }> = {};
  let resolved = 0;
  for (const { sym, data } of results) {
    if (data) {
      result[sym] = data;
      resolved++;
    }
  }

  console.log(`[prices] requested=${symbols.length} resolved=${resolved} symbols=${symbols.join(',')}`);
  return res.status(200).json(result);
}
