import type { VercelRequest, VercelResponse } from '@vercel/node';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Preferred Yahoo Finance exchange suffixes by ISIN country prefix
const PREFERRED_SUFFIXES: Record<string, string[]> = {
  SE: ['.ST'],
  NO: ['.OL'],
  FI: ['.HE'],
  DK: ['.CO'],
  GB: ['.L'],
  DE: ['.DE', '.F'],
  US: ['', '.NYSE', '.NASDAQ'],
  LU: ['.ST', '.PA', '.L', '.DE', '.F', ''],
  IE: ['.L', '.AS', '.ST', ''],
  JE: ['.L'],  // Jersey-domiciled (WisdomTree etc.)
  FR: ['.PA'],
};

export interface SearchResult {
  symbol: string;
  shortname: string;
  quoteType: string;
  typeDisp: string;
  exchDisp: string;
  score: number;
}

// GET /api/search-ticker?q=AuAg+Silver+Bullet&country=SE
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = String(req.query.q ?? '').trim();
  const country = String(req.query.country ?? 'SE').toUpperCase();
  if (!q) return res.status(400).json({ error: 'q required' });

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-US&region=SE&quotesCount=8&newsCount=0&enableFuzzyQuery=false&enableCb=false&enableNavLinks=false`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
    });
    if (!resp.ok) return res.status(502).json({ error: `Yahoo search returned ${resp.status}` });

    const json = await resp.json() as any;
    const quotes: any[] = json?.quotes ?? [];

    const preferred = PREFERRED_SUFFIXES[country] ?? ['.ST'];

    const scored: SearchResult[] = quotes
      .filter((q: any) => q.symbol && q.isYahooFinance !== false)
      .map((q: any): SearchResult => {
        const sym: string = q.symbol ?? '';
        let score = 0;
        for (let i = 0; i < preferred.length; i++) {
          if (sym.endsWith(preferred[i])) { score += (10 - i); break; }
        }
        if (q.quoteType === 'MUTUALFUND') score += 4;
        else if (q.quoteType === 'ETF') score += 3;
        else if (q.quoteType === 'EQUITY') score += 2;
        // Penalise futures, options, indices, currencies
        if (['FUTURE', 'OPTION', 'INDEX', 'CURRENCY'].includes(q.quoteType ?? '')) score -= 10;
        return {
          symbol: sym,
          shortname: q.shortname ?? q.longname ?? sym,
          quoteType: q.quoteType ?? '',
          typeDisp: q.typeDisp ?? '',
          exchDisp: q.exchDisp ?? '',
          score,
        };
      })
      .sort((a: SearchResult, b: SearchResult) => b.score - a.score);

    return res.status(200).json(scored.slice(0, 5));
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
