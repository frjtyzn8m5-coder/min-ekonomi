import type { VercelRequest, VercelResponse } from '@vercel/node';

// Fetch live prices + FX rates from Yahoo Finance
// GET /api/prices?tickers=AFRY.ST,NAS.OL&fx=NOKSEK=X,EURSEK=X
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tickersParam = String(req.query.tickers ?? '');
  const fxParam = String(req.query.fx ?? '');
  const allSymbols = [...new Set([
    ...tickersParam.split(',').map(s => s.trim()),
    ...fxParam.split(',').map(s => s.trim()),
  ])].filter(Boolean);

  if (allSymbols.length === 0) return res.status(400).json({ error: 'No tickers provided' });

  try {
    const symbols = allSymbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice,regularMarketChangePercent,currency,shortName`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const json = await response.json() as any;
    const quotes = json?.quoteResponse?.result ?? [];

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
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
