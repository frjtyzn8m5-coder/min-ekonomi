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

export interface PortfolioValuation {
  /** Best-effort total: live market value where available, cost basis otherwise. */
  totalSEK: number;
  /** Sum of holdings valued at a live market price. */
  marketSEK: number;
  /** Sum of cost basis for holdings that lack a live price (counted so nothing vanishes). */
  costFallbackSEK: number;
  pricedCount: number;
  unpricedCount: number;
  totalCount: number;
}

/** SEK cost basis of a holding (what was actually paid), used as a fallback value. */
function holdingCostSEK(h: Holding, priceCache: Record<string, PriceData>): number {
  if (h.totalCostSEK != null && h.totalCostSEK > 0) return h.totalCostSEK;
  // Last resort: avgBuyPrice is in the instrument currency — convert if we can.
  const rate = fxRateFromCache(h.currency, priceCache) ?? 1;
  return Math.max(0, h.avgBuyPrice * h.shares * rate);
}

/**
 * Value the WHOLE portfolio, never silently dropping a holding. Holdings with a
 * live price use market value; the rest fall back to their SEK cost basis so the
 * total reflects every holding the user owns (with coverage reported for honesty).
 */
export function valuePortfolio(
  holdings: Holding[],
  priceCache: Record<string, PriceData>,
  tickerMappings: TickerMapping[],
): PortfolioValuation {
  let marketSEK = 0, costFallbackSEK = 0, pricedCount = 0, unpricedCount = 0;
  for (const h of holdings) {
    const tm = tickerMappings.find(x => x.isin === h.isin);
    const pd = tm ? priceCache[tm.ticker] : undefined;
    if (pd) {
      const rate = fxRateFromCache(h.currency, priceCache) ?? fxRateFromCache(pd.currency, priceCache) ?? 1;
      marketSEK += h.shares * pd.price * rate;
      pricedCount++;
    } else {
      costFallbackSEK += holdingCostSEK(h, priceCache);
      unpricedCount++;
    }
  }
  return {
    totalSEK: marketSEK + costFallbackSEK,
    marketSEK, costFallbackSEK, pricedCount, unpricedCount,
    totalCount: holdings.length,
  };
}

/**
 * Best available current portfolio value in SEK.
 * Prefers the most recent portfolio snapshot (persisted + computed with full FX
 * conversion by Portfolio.tsx) and falls back to a full holdings valuation
 * (market price where known, cost basis otherwise) so every holding is counted.
 */
export function latestPortfolioValueSEK(
  snapshots: PortfolioSnapshot[],
  holdings: Holding[],
  priceCache: Record<string, PriceData>,
  tickerMappings: TickerMapping[],
): number {
  if (snapshots.length) {
    const latest = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))[snapshots.length - 1];
    if (latest && latest.totalValueSEK > 0) {
      // The snapshot is FX-correct but may predate holdings added since. Add the
      // cost basis of any currently-held ISIN the snapshot didn't cover so nothing
      // the user owns is missing from the total.
      const covered = new Set(latest.holdings.map(h => h.isin));
      let extra = 0;
      for (const h of holdings) if (!covered.has(h.isin)) extra += holdingCostSEK(h, priceCache);
      return latest.totalValueSEK + extra;
    }
  }
  return valuePortfolio(holdings, priceCache, tickerMappings).totalSEK;
}
