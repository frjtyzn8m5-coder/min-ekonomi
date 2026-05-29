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

// Morningstar exchange → Yahoo Finance suffix mapping
const MS_EXCHANGE_SUFFIX: Record<string, string> = {
  XSTO: '.ST',  // Stockholm
  XOSL: '.OL',  // Oslo
  XHEL: '.HE',  // Helsinki
  XCSE: '.CO',  // Copenhagen
  XLON: '.L',   // London
  XETR: '.DE',  // Frankfurt
  XPAR: '.PA',  // Paris
  XAMS: '.AS',  // Amsterdam
};

// Morningstar security type → Yahoo quoteType
const MS_TYPE_MAP: Record<string, string> = {
  FO: 'MUTUALFUND',
  ET: 'ETF',
  ST: 'EQUITY',
  CE: 'ETF',
};

export interface SearchResult {
  symbol: string;
  shortname: string;
  quoteType: string;
  typeDisp: string;
  exchDisp: string;
  score: number;
  source?: 'morningstar' | 'yahoo';
}

// ── Morningstar ISIN lookup ────────────────────────────────────────────────────
// Returns a high-confidence SearchResult when the ISIN maps directly to a
// Morningstar fund/security. Morningstar IDs are exactly what Yahoo Finance
// uses as tickers for Swedish/Nordic mutual funds (e.g. "0P0001IMY7.ST").

async function lookupMorningstar(isin: string, countryCode: string): Promise<SearchResult | null> {
  try {
    const url = `https://www.morningstar.se/api/rest.svc/jsonp/security/search?term=${encodeURIComponent(isin)}&page=1&pageSize=5`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/javascript, application/json, */*',
        'Referer': 'https://www.morningstar.se/',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      },
    });
    if (!resp.ok) return null;

    const text = await resp.text();

    // Strip JSONP wrapper – matches any callback name: someFunc({...})
    const jsonMatch = text.match(/\w[\w.]*\s*\(\s*(\{[\s\S]*\})\s*\)/);
    if (!jsonMatch) return null;

    const data = JSON.parse(jsonMatch[1]);
    const rows: any[] = data?.rows ?? [];
    if (!rows.length) return null;

    const first = rows[0];
    const msId: string = first.i ?? '';
    if (!msId) return null;

    // Determine Yahoo Finance suffix from Morningstar exchange/country
    const exchange: string = first.e ?? '';
    const msCountry: string = first.r ?? countryCode;
    let suffix = MS_EXCHANGE_SUFFIX[exchange] ?? PREFERRED_SUFFIXES[msCountry]?.[0] ?? '.ST';

    const ticker = `${msId}${suffix}`;
    const msType: string = first.t ?? '';
    const quoteType = MS_TYPE_MAP[msType] ?? 'MUTUALFUND';

    return {
      symbol: ticker,
      shortname: first.n ?? '',
      quoteType,
      typeDisp: first.et ?? msType,
      exchDisp: exchange,
      score: 15,  // Direct ISIN match → highest confidence
      source: 'morningstar',
    };
  } catch {
    return null;
  }
}

// ── Yahoo Finance text search ──────────────────────────────────────────────────

async function searchYahoo(q: string, country: string): Promise<SearchResult[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-US&region=SE&quotesCount=8&newsCount=0&enableFuzzyQuery=false&enableCb=false&enableNavLinks=false`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!resp.ok) return [];

  const json = await resp.json() as any;
  const quotes: any[] = json?.quotes ?? [];

  const preferred = PREFERRED_SUFFIXES[country] ?? ['.ST'];

  return quotes
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
      if (['FUTURE', 'OPTION', 'INDEX', 'CURRENCY'].includes(q.quoteType ?? '')) score -= 10;
      return {
        symbol: sym,
        shortname: q.shortname ?? q.longname ?? sym,
        quoteType: q.quoteType ?? '',
        typeDisp: q.typeDisp ?? '',
        exchDisp: q.exchDisp ?? '',
        score,
        source: 'yahoo',
      };
    })
    .sort((a: SearchResult, b: SearchResult) => b.score - a.score);
}

// ── Handler ────────────────────────────────────────────────────────────────────
// GET /api/search-ticker?q=AuAg+Silver+Bullet&country=SE&isin=SE0003883888

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = String(req.query.q ?? '').trim();
  const isin = String(req.query.isin ?? '').trim().toUpperCase();
  const country = String(req.query.country ?? 'SE').toUpperCase();

  if (!q && !isin) return res.status(400).json({ error: 'q or isin required' });

  try {
    // 1. Try Morningstar first when we have an ISIN (most reliable for Nordic funds)
    if (isin) {
      const msResult = await lookupMorningstar(isin, country);
      if (msResult) {
        // Return Morningstar hit + any Yahoo results merged, Morningstar first
        const yahooResults = await searchYahoo(q || isin, country).catch(() => []);
        const combined = [msResult, ...yahooResults.filter(r => r.symbol !== msResult.symbol)];
        return res.status(200).json(combined.slice(0, 5));
      }
    }

    // 2. Fall back to Yahoo Finance text search
    if (!q) return res.status(200).json([]);
    const yahooResults = await searchYahoo(q, country);
    return res.status(200).json(yahooResults.slice(0, 5));
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
