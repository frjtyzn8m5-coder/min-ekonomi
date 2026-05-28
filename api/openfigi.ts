import type { VercelRequest, VercelResponse } from '@vercel/node';

// Map ISINs to Yahoo Finance tickers via OpenFIGI (free tier, no key needed)
// GET /api/openfigi?isins=SE0013358181,NO0010196140
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const isinsParam = String(req.query.isins ?? '');
  const isins = isinsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (isins.length === 0) return res.status(400).json({ error: 'No ISINs provided' });

  // OpenFIGI allows max 10 per request on free tier
  const chunks: string[][] = [];
  for (let i = 0; i < isins.length; i += 10) chunks.push(isins.slice(i, i + 10));

  // Map OpenFIGI exchange code → Yahoo Finance suffix
  const EXCH_SUFFIX: Record<string, string> = {
    SS: '.ST',  // Nasdaq Stockholm
    ST: '.ST',
    NO: '.OL',  // Oslo
    OL: '.OL',
    LN: '.L',   // London
    GF: '.F',   // Frankfurt
    US: '',     // NYSE/NASDAQ (no suffix)
  };

  const result: Record<string, { ticker: string; name: string }> = {};

  for (const chunk of chunks) {
    try {
      const body = chunk.map(isin => ({ idType: 'ID_ISIN', idValue: isin }));
      const resp = await fetch('https://api.openfigi.com/v3/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await resp.json() as any[];

      chunk.forEach((isin, i) => {
        const items: any[] = json[i]?.data ?? [];
        if (!items.length) return;

        // Prefer equity/ETF over fund units, and prefer the main exchange listing
        const preferred = items.find(x =>
          x.securityType2 === 'Common Stock' || x.securityType2 === 'ETP'
        ) ?? items[0];

        const suffix = EXCH_SUFFIX[preferred.exchCode ?? ''] ?? '';
        const ticker = `${preferred.ticker}${suffix}`;
        result[isin] = { ticker, name: preferred.name ?? isin };
      });
    } catch {
      // If OpenFIGI fails for a chunk, just skip – caller handles missing mappings
    }
  }

  return res.status(200).json(result);
}
