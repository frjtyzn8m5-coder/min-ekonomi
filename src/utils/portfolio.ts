import type { Holding, PriceData, TickerMapping, PortfolioSnapshot } from '../types';

// FX pairs available from the price API (mirror of Portfolio.tsx).
const FX_PAIRS: Record<string, string> = {
  NOK: 'NOKSEK=X',
  EUR: 'EURSEK=X',
  USD: 'USDSEK=X',
  GBP: 'GBPSEK=X',
};

function fxRateFromCache(currency: string | undefined, priceCache: Record<string, PriceData>): number | undefined {
  if (!currency || currency === 'SEK') return 1;
  const pair = FX_PAIRS[currency];
  if (pair && priceCache[pair]) return priceCache[pair].price;
  return undefined;
}

/**
 * Live total portfolio value in SEK, derived from holdings × cached prices.
 * Mirrors Portfolio.tsx's computeTotalSEK. FX conversion uses rates found in the
 * price cache (stored under e.g. "USDSEK=X") when present, otherwise falls back
 * to 1 (price cache does not persist FX pairs, so prefer latestPortfolioValueSEK
 * which uses the FX-correct persisted snapshot).
 */
export function portfolioValueSEK(
  holdings: Holding[],
  priceCache: Record<string, PriceData>,
  tickerMappings: TickerMapping[],
): number {
  return holdings.reduce((sum, h) => {
    const tm = tickerMappings.find(x => x.isin === h.isin);
    if (!tm) return sum;
    const pd = priceCache[tm.ticker];
    if (!pd) return sum;
    const rate = fxRateFromCache(h.currency, priceCache) ?? fxRateFromCache(pd.currency, priceCache) ?? 1;
    return sum + h.shares * pd.price * rate;
  }, 0);
}

/**
 * Best available current portfolio value in SEK.
 * Prefers the most recent portfolio snapshot (persisted + computed with full FX
 * conversion by Portfolio.tsx) and falls back to a live holdings × priceCache
 * computation when no snapshot exists yet.
 */
export function latestPortfolioValueSEK(
  snapshots: PortfolioSnapshot[],
  holdings: Holding[],
  priceCache: Record<string, PriceData>,
  tickerMappings: TickerMapping[],
): number {
  if (snapshots.length) {
    const latest = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))[snapshots.length - 1];
    if (latest && latest.totalValueSEK > 0) return latest.totalValueSEK;
  }
  return portfolioValueSEK(holdings, priceCache, tickerMappings);
}
