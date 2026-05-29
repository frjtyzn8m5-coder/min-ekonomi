import type { VercelRequest, VercelResponse } from '@vercel/node';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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
  JE: ['.L'],
  FR: ['.PA'],
};

const MS_EXCHANGE_SUFFIX: Record<string, string> = {
  XSTO: '.ST',
  XOSL: '.OL',
  XHEL: '.HE',
  XCSE: '.CO',
  XLON: '.L',
  XETR: '.DE',
  XPAR: '.PA',
  XAMS: '.AS',
};

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

    // Morningstar sometimes returns plain JSON, sometimes JSONP – handle both
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // Strip JSONP wrapper: anyFuncName({...}) or anyFuncName ({...})
      const m = text.match(/\w[\w$.]*\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/);
      if (m) {
        try { data = JSON.parse(m[1]); } catch { /* give up */ }
      }
    }

    if (!data) return null;

    const rows: any[] = data?.rows ?? [];
    if (!rows.length) return null;

    const first = rows[0];
    const msId: string = first.i ?? '';
    if (!msId) return null;

    const exchange: string = first.e ?? '';
    const msCountry: string = first.r ?? countryCode;
    const suffix = MS_EXCHANGE_SUFFIX[exchange] ?? PREFERRED_SUFFIXES[msCountry]?.[0] ?? '.ST';

    const ticker = `${msId}${suffix}`;
    const msType: string = first.t ?? '';

    return {
      symbol: ticker,
      shortname: first.n ?? '',
      quoteType: MS_TYPE_MAP[msType] ?? 'MUTUALFUND',
      typeDisp: first.et ?? msType,
      exchDisp: exchange,
      score: 15,
      source: 'morningstar',
    };
  } catch {
    return null;
  }
}

// ── Yahoo Finance search ───────────────────────────────────────────────────────

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
    .sort((a, b) => b.score - a.score);
}

// ── Yahoo v7/finance/quote – gets detailed fund category ──────────────────────
// The chart API (v8) often returns empty category for Morningstar-ID tickers.
// The quote API reliably returns e.g. "Equity Precious Metals", "Sweden Equity".

async function fetchYahooCategory(ticker: string): Promise<string> {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}&fields=category,quoteType`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
    });
    if (!resp.ok) return '';
    const json = await resp.json() as any;
    return json?.quoteResponse?.result?.[0]?.category ?? '';
  } catch {
    return '';
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────
// GET /api/search-ticker?q=SEB+Sverige+Indexnära&country=SE&isin=SE0002593673
//
// Priority:
//  1. Morningstar ISIN lookup     – most reliable for Nordic funds
//  2. Yahoo search by ISIN        – catches stocks/ETFs Morningstar misses
//  3. Yahoo search by name        – general fallback

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q      = String(req.query.q      ?? '').trim();
  const isin   = String(req.query.isin   ?? '').trim().toUpperCase();
  const country = String(req.query.country ?? 'SE').toUpperCase();

  if (!q && !isin) return res.status(400).json({ error: 'q or isin required' });

  try {
    const results: SearchResult[] = [];

    // 1. Morningstar (primary for Nordic mutual funds)
    if (isin) {
      const ms = await lookupMorningstar(isin, country);
      if (ms) {
        // Enrich with detailed Yahoo category (chart API often returns empty)
        const yahooCat = await fetchYahooCategory(ms.symbol);
        if (yahooCat) ms.typeDisp = yahooCat;
        results.push(ms);
      }
    }

    // 2. Yahoo search by ISIN – good for stocks/ETFs on Yahoo but not Morningstar
    if (isin && results.length === 0) {
      const byIsin = await searchYahoo(isin, country);
      // Only accept if the result has the correct exchange suffix (strong match)
      const preferred = PREFERRED_SUFFIXES[country] ?? ['.ST'];
      const good = byIsin.filter(r =>
        r.score >= 5 && preferred.some(sfx => r.symbol.endsWith(sfx))
      );
      results.push(...good.slice(0, 3));
    }

    // 3. Yahoo search by name (always run, merge after Morningstar result)
    if (q) {
      const byName = await searchYahoo(q, country);
      for (const r of byName) {
        if (!results.find(x => x.symbol === r.symbol)) results.push(r);
      }
    }

    // Sort: Morningstar first (score 15), then by score desc
    results.sort((a, b) => b.score - a.score);

    return res.status(200).json(results.slice(0, 5));
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}
