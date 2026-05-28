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
    UN: '',     // NYSE
    UQ: '',     // NASDAQ
    UA: '',     // NYSE American
  };

  // Preferred exchange codes by ISIN country prefix
  const ISIN_PREFERRED_EXCH: Record<string, string[]> = {
    SE: ['SS', 'ST'],
    NO: ['NO', 'OL'],
    FI: ['HE'],
    DK: ['DC'],
    DE: ['GF', 'GS'],
    GB: ['LN'],
    US: ['US', 'UN', 'UQ', 'UA'],
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

        const countryCode = isin.slice(0, 2).toUpperCase();
        const preferredExchs = ISIN_PREFERRED_EXCH[countryCode] ?? [];

        // Score items: prefer correct exchange + equity/ETP type + reasonable ticker length
        const scored = items
          .filter(x => EXCH_SUFFIX[x.exchCode ?? ''] !== undefined) // only known exchanges
          .map(x => {
            const tickerStr: string = x.ticker ?? '';
            let score = 0;
            if (preferredExchs.includes(x.exchCode)) score += 10;
            if (x.securityType2 === 'Common Stock') score += 5;
            if (x.securityType2 === 'ETP') score += 4;
            if (x.marketSector === 'Equity') score += 3;
            // Penalise very long tickers (>8 chars) – likely internal codes, not exchange tickers
            if (tickerStr.length <= 8) score += 2;
            if (tickerStr.length > 10) score -= 5;
            // Penalise tickers containing spaces or lower-case (not typical exchange tickers)
            if (/\s/.test(tickerStr) || /[a-z]/.test(tickerStr)) score -= 10;
            return { item: x, score };
          })
          .sort((a, b) => b.score - a.score);

        // Fall back to any item if nothing passed the filter
        const allScored = items.map(x => {
          const tickerStr: string = x.ticker ?? '';
          let score = 0;
          if (preferredExchs.includes(x.exchCode)) score += 10;
          if (x.securityType2 === 'Common Stock') score += 5;
          if (x.securityType2 === 'ETP') score += 4;
          if (x.marketSector === 'Equity') score += 3;
          if (tickerStr.length <= 8) score += 2;
          if (tickerStr.length > 10) score -= 5;
          if (/\s/.test(tickerStr) || /[a-z]/.test(tickerStr)) score -= 10;
          return { item: x, score };
        }).sort((a, b) => b.score - a.score);

        const best = (scored[0] ?? allScored[0])?.item;
        if (!best) return;

        const suffix = EXCH_SUFFIX[best.exchCode ?? ''] ?? '';
        const ticker = `${best.ticker}${suffix}`;
        // Only store if ticker looks usable (not empty, not too long)
        if (ticker && ticker.length <= 15) {
          result[isin] = { ticker, name: best.name ?? isin };
        }
      });
    } catch {
      // If OpenFIGI fails for a chunk, just skip – caller handles missing mappings
    }
  }

  return res.status(200).json(result);
}
