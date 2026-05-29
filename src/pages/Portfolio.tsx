import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  saveHoldings, loadHoldings, saveTickerMappings, loadTickerMappings,
  savePriceCache, loadPriceCache, savePortfolioSnapshot, loadPortfolioSnapshots,
} from '../lib/db';
import { formatSEK } from '../utils/calculations';
import { Card } from '../components/ui/Card';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { RefreshCw, Edit2, Check, X, TrendingUp, TrendingDown, AlertCircle, Plus, Settings2, Pencil } from 'lucide-react';
import type { TickerMapping, PriceData, PortfolioSnapshot } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#007aff', '#34c759', '#ff9f0a', '#ff375f', '#bf5af2',
  '#5e5ce6', '#64d2ff', '#ff6b35', '#30d158', '#ffd60a',
  '#ff6961', '#0071e3', '#a2845e',
];

const PRICE_TTL_MS = 4 * 60 * 60 * 1000; // 4h
const PIE_MAX_SLICES = 7;

const FX_PAIRS: Record<string, string> = {
  NOK: 'NOKSEK=X',
  EUR: 'EURSEK=X',
  USD: 'USDSEK=X',
  GBP: 'GBPSEK=X',
};

// ── Auto-categorisation ────────────────────────────────────────────────────────
// Maps Yahoo Finance category strings → the user's Swedish asset class names.
// Matching is fuzzy (substring) so it works with minor wording variations.

function suggestAssetClass(category: string | undefined, userClasses: string[]): string | undefined {
  if (!category) return undefined;
  const cat = category.toLowerCase();
  const find = (keywords: string[]) =>
    userClasses.find(c => keywords.some(kw => c.toLowerCase().includes(kw)));

  if (cat.includes('precious metal') || cat.includes('gold') || cat.includes('silver'))
    return find(['ädelmetall', 'guld', 'silver']) ?? find(['råvara', 'commodity']);

  if (cat.includes('commodit') || cat.includes('natural resource') || cat.includes('energy equity') || cat.includes('agriculture'))
    return find(['råvara', 'commodity']);

  if (cat.includes('real estate') || cat.includes('property') || cat.includes('fastighet') || cat.includes('reit'))
    return find(['fastighet', 'real estate']);

  if (cat.includes('bond') || cat.includes('fixed income') || cat.includes('ränta') || cat.includes('obligation') || cat.includes('money market'))
    return find(['ränte', 'obligation', 'bond', 'ränta']);

  if (cat.includes('equity') || cat.includes('stock') || cat.includes('blend') || cat.includes('growth') || cat.includes('value') || cat.includes('small cap'))
    return find(['aktie', 'equity', 'stock']);

  if (cat.includes('alloc') || cat.includes('balanced') || cat.includes('mix'))
    return find(['bland', 'alloc', 'mix']);

  return undefined;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

// ── Asset class manager ────────────────────────────────────────────────────────

function ClassManager({ assetClasses, onSetClasses }: { assetClasses: string[]; onSetClasses: (c: string[]) => void }) {
  const [newCls, setNewCls] = useState('');
  const add = () => { const v = newCls.trim(); if (!v || assetClasses.includes(v)) return; onSetClasses([...assetClasses, v]); setNewCls(''); };
  const remove = (cls: string) => onSetClasses(assetClasses.filter(c => c !== cls));
  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {assetClasses.map(cls => (
          <span key={cls} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-0.5 text-xs text-gray-700">
            {cls}
            <button onClick={() => remove(cls)} className="text-gray-300 hover:text-red-400 ml-0.5"><X size={9} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={newCls} onChange={e => setNewCls(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Ny klass, t.ex. Ädelmetaller…"
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-300" />
        <button onClick={add} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600">
          <Plus size={11} /> Lägg till
        </button>
      </div>
    </div>
  );
}

// ── Breakdown bar ──────────────────────────────────────────────────────────────

function ClassBreakdown({ enriched, assetClasses, selectedClass, onSelect }: {
  enriched: any[]; assetClasses: string[]; selectedClass: string | null; onSelect: (c: string | null) => void;
}) {
  const totalSEK = enriched.reduce((s, h) => s + h.valueSEK, 0);
  if (totalSEK === 0) return <p className="text-xs text-gray-400 text-center py-2">Uppdatera kurser för att se fördelning.</p>;

  const bars: { name: string; value: number; pct: number }[] = [];
  for (const cls of assetClasses) {
    const value = enriched.filter(h => h.assetClass === cls).reduce((s, h) => s + h.valueSEK, 0);
    if (value > 0) bars.push({ name: cls, value, pct: (value / totalSEK) * 100 });
  }
  const untagged = enriched.filter(h => !h.assetClass && h.valueSEK > 0).reduce((s, h) => s + h.valueSEK, 0);
  if (untagged > 0) bars.push({ name: 'Ej klassad', value: untagged, pct: (untagged / totalSEK) * 100 });
  bars.sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-1.5">
      {bars.map((bar, i) => (
        <button key={bar.name} onClick={() => onSelect(selectedClass === bar.name ? null : bar.name)}
          className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${selectedClass === bar.name ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}>
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
          <span className="text-xs font-medium text-gray-700 w-32 flex-shrink-0 truncate">{bar.name}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${bar.pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0 text-right w-36">
            {formatSEK(bar.value)} <span className="text-gray-400">({bar.pct.toFixed(1)}%)</span>
          </span>
        </button>
      ))}
      {selectedClass && (
        <button onClick={() => onSelect(null)} className="text-xs text-blue-500 hover:text-blue-700 pt-1 pl-2">
          Visa alla innehav
        </button>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const { user } = useAuthStore();
  const {
    holdings, tickerMappings, priceCache, portfolioSnapshots, assetClasses,
    setHoldings, setTickerMappings, upsertTickerMapping,
    setPriceCache, setPortfolioSnapshots, addPortfolioSnapshot, setAssetClasses,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [editTicker, setEditTicker] = useState<string | null>(null); // isin::account
  const [editValue, setEditValue] = useState('');
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [showClassManager, setShowClassManager] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'done'>('idle');
  const [remapCount, setRemapCount] = useState<number | null>(null);
  const [indexHistory, setIndexHistory] = useState<{
    omxs30: { date: string; pct: number }[];
    nasdaq: { date: string; pct: number }[];
  } | null>(null);

  // Account filter & rename
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]); // empty = all
  const [accountNames, setAccountNames] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('portfolio_account_names') ?? '{}'); } catch { return {}; }
  });
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editAccountValue, setEditAccountValue] = useState('');

  // Refs for interval/auto-refresh
  const hasAutoRefreshed = useRef(false);
  const refreshingRef = useRef(false);
  const refreshPricesRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);
  useEffect(() => { hasAutoRefreshed.current = false; }, [user?.uid]);

  // ── Load from Firebase ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [h, t, p, s] = await Promise.all([
          loadHoldings(user.uid),
          loadTickerMappings(user.uid),
          loadPriceCache(user.uid),
          loadPortfolioSnapshots(user.uid),
        ]);
        if (h.length) setHoldings(h);
        if (t.length) setTickerMappings(t);
        if (Object.keys(p).length) setPriceCache(p);
        if (s.length) setPortfolioSnapshots(s);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Auto-search for unmapped holdings ───────────────────────────────────────

  useEffect(() => {
    if (!holdings.length || !user) return;
    const unmapped = holdings.filter(h => h.isin && !tickerMappings.find(m => m.isin === h.isin));
    if (!unmapped.length) return;

    setSearchStatus('searching');
    // Deduplicate by ISIN (same security in multiple accounts only needs one search)
    const uniqueByIsin = [...new Map(unmapped.map(h => [h.isin, h])).values()];

    Promise.all(
      uniqueByIsin.map(async (h) => {
        const country = h.isin.slice(0, 2).toUpperCase();
        try {
          const resp = await fetch(`/api/search-ticker?q=${encodeURIComponent(h.name)}&country=${country}&isin=${encodeURIComponent(h.isin)}`);
          if (!resp.ok) return null;
          const results = await resp.json() as { symbol: string; shortname: string; quoteType: string; typeDisp: string; score: number }[];
          if (!results.length || results[0].score < 3) return null;
          const best = results[0];
          const mapping: TickerMapping = {
            isin: h.isin,
            ticker: best.symbol,
            name: best.shortname || h.name,
            manual: false,
            quoteType: best.quoteType,
            category: best.typeDisp,
          };
          // Auto-suggest asset class
          const suggested = suggestAssetClass(best.typeDisp, assetClasses);
          if (suggested) mapping.assetClass = suggested;
          return mapping;
        } catch { return null; }
      })
    ).then(async (newMappings) => {
      const valid = newMappings.filter(Boolean) as TickerMapping[];
      if (!valid.length) { setSearchStatus('done'); return; }
      const merged = [...tickerMappings];
      for (const m of valid) {
        if (!merged.find(x => x.isin === m.isin)) merged.push(m);
      }
      setTickerMappings(merged);
      await saveTickerMappings(user.uid, merged).catch(() => {});
      setSearchStatus('done');
    }).catch(() => setSearchStatus('done'));
  }, [holdings]);

  // ── Refresh prices ───────────────────────────────────────────────────────────

  const refreshPrices = async (mappingsOverride?: TickerMapping[]) => {
    if (!user) return;
    const currentMappings = mappingsOverride ?? tickerMappings;
    if (!currentMappings.length) return;
    setRefreshing(true);
    setError('');
    try {
      const tickers = [...new Set(currentMappings.map(m => m.ticker).filter(Boolean))];
      const neededFx = [...new Set(
        holdings.map(h => h.currency).filter(c => c !== 'SEK' && FX_PAIRS[c]).map(c => FX_PAIRS[c])
      )];
      const allSymbols = [...tickers, ...neededFx];
      const resp = await fetch(`/api/prices?tickers=${encodeURIComponent(allSymbols.join(','))}`);
      const data: Record<string, { price: number; currency: string; changePercent: number; name: string; category?: string; quoteType?: string }> = await resp.json();
      if (!resp.ok) throw new Error((data as any).error ?? `HTTP ${resp.status}`);

      const newFx: Record<string, number> = { SEK: 1 };
      for (const [cur, pair] of Object.entries(FX_PAIRS)) {
        if (data[pair]) newFx[cur] = data[pair].price;
      }
      setFxRates(newFx);

      const now = Date.now();
      const newCache: Record<string, PriceData> = { ...priceCache };
      let updatedMappings = [...currentMappings];
      let mappingsChanged = false;
      const fxSymbols = new Set(Object.values(FX_PAIRS));

      for (const [symbol, q] of Object.entries(data)) {
        if (fxSymbols.has(symbol)) continue;
        newCache[symbol] = { ticker: symbol, price: q.price, currency: q.currency, changePercent: q.changePercent, fetchedAt: now, category: q.category, quoteType: q.quoteType };

        const idx = updatedMappings.findIndex(m => m.ticker === symbol);
        if (idx >= 0) {
          const m = updatedMappings[idx];
          let changed = false;
          const patch: Partial<TickerMapping> = {};
          if (q.category && !m.category) { patch.category = q.category; changed = true; }
          if (q.quoteType && !m.quoteType) { patch.quoteType = q.quoteType; changed = true; }
          // Auto-apply asset class if not yet set
          if (!m.assetClass && q.category) {
            const suggested = suggestAssetClass(q.category, assetClasses);
            if (suggested) { patch.assetClass = suggested; changed = true; }
          }
          if (changed) { updatedMappings[idx] = { ...m, ...patch }; mappingsChanged = true; }
        }
      }

      // Phase 2: re-map tickers that returned no price
      const failed = updatedMappings.filter(m => m.ticker && !m.manual && !data[m.ticker] && !fxSymbols.has(m.ticker));
      if (failed.length) {
        const remapped = await Promise.all(
          failed.map(async (tm) => {
            const holding = holdings.find(h => h.isin === tm.isin);
            if (!holding) return null;
            const country = tm.isin.slice(0, 2).toUpperCase();
            try {
              const r = await fetch(`/api/search-ticker?q=${encodeURIComponent(holding.name)}&country=${country}&isin=${encodeURIComponent(tm.isin)}`);
              if (!r.ok) return null;
              const results = await r.json() as { symbol: string; shortname: string; quoteType: string; typeDisp: string; score: number }[];
              if (!results.length || results[0].score < 3) return null;
              const best = results[0];
              if (best.symbol === tm.ticker) return null;
              const updated = { ...tm, ticker: best.symbol, name: best.shortname || tm.name, quoteType: best.quoteType, category: best.typeDisp };
              const suggested = suggestAssetClass(best.typeDisp, assetClasses);
              if (suggested && !updated.assetClass) updated.assetClass = suggested;
              return updated as TickerMapping;
            } catch { return null; }
          })
        );
        const valid = remapped.filter(Boolean) as TickerMapping[];
        if (valid.length) {
          for (const v of valid) {
            const idx = updatedMappings.findIndex(m => m.isin === v.isin);
            if (idx >= 0) updatedMappings[idx] = v;
          }
          mappingsChanged = true;
          // Retry prices for new tickers
          const newSymbols = valid.map(v => v.ticker).filter(Boolean);
          try {
            const r2 = await fetch(`/api/prices?tickers=${encodeURIComponent(newSymbols.join(','))}`);
            if (r2.ok) {
              const data2: Record<string, any> = await r2.json();
              for (const [sym, q] of Object.entries(data2)) {
                newCache[sym] = { ticker: sym, price: q.price, currency: q.currency, changePercent: q.changePercent, fetchedAt: now, category: q.category, quoteType: q.quoteType };
              }
            }
          } catch { /* best-effort */ }
        }
      }

      setPriceCache(newCache);
      await savePriceCache(user.uid, newCache);
      if (mappingsChanged) {
        setTickerMappings(updatedMappings);
        await saveTickerMappings(user.uid, updatedMappings).catch(() => {});
      }

      const totalSEK = computeTotalSEK(newCache, newFx);
      if (totalSEK > 0) {
        const snap: PortfolioSnapshot = {
          date: new Date().toISOString().slice(0, 10),
          totalValueSEK: totalSEK,
          holdings: holdings.map(h => {
            const tm = updatedMappings.find(x => x.isin === h.isin);
            const pd = tm ? newCache[tm.ticker] : undefined;
            const rate = newFx[h.currency] ?? 1;
            return { isin: h.isin, name: h.name, valueSEK: pd ? h.shares * pd.price * rate : 0, shares: h.shares };
          }),
        };
        addPortfolioSnapshot(snap);
        await savePortfolioSnapshot(user.uid, snap);
      }
    } catch (e: any) {
      setError('Kunde inte hämta kurser: ' + (e?.message ?? 'okänt fel'));
    } finally {
      setRefreshing(false);
    }
  };

  // ── Re-map all non-manual tickers ────────────────────────────────────────────

  const remapAllTickers = async () => {
    if (!user || refreshing || searchStatus === 'searching') return;
    setSearchStatus('searching');
    setRemapCount(null);
    try {
      const uniqueIsins = [...new Map(holdings.map(h => [h.isin, h])).values()];
      const toSearch = uniqueIsins.filter(h => {
        const tm = tickerMappings.find(m => m.isin === h.isin);
        return !tm?.manual;
      });
      if (!toSearch.length) return;

      const found = await Promise.all(
        toSearch.map(async (h) => {
          const country = h.isin.slice(0, 2).toUpperCase();
          try {
            const resp = await fetch(`/api/search-ticker?q=${encodeURIComponent(h.name)}&country=${country}&isin=${encodeURIComponent(h.isin)}`);
            if (!resp.ok) return null;
            const results = await resp.json() as { symbol: string; shortname: string; quoteType: string; typeDisp: string; score: number }[];
            if (!results.length || results[0].score < 3) return null;
            const best = results[0];
            const m: TickerMapping = { isin: h.isin, ticker: best.symbol, name: best.shortname || h.name, manual: false, quoteType: best.quoteType, category: best.typeDisp };
            const suggested = suggestAssetClass(best.typeDisp, assetClasses);
            if (suggested) m.assetClass = suggested;
            return m;
          } catch { return null; }
        })
      );

      const valid = found.filter(Boolean) as TickerMapping[];
      setRemapCount(valid.length);
      if (!valid.length) return;

      const updated = [...tickerMappings];
      for (const m of valid) {
        const idx = updated.findIndex(x => x.isin === m.isin);
        if (idx >= 0) updated[idx] = m;
        else updated.push(m);
      }
      setTickerMappings(updated);
      await saveTickerMappings(user.uid, updated).catch(() => {});
    } finally {
      setSearchStatus('done');
    }
  };

  // ── Keep ref pointing at latest refreshPrices ─────────────────────────────

  useEffect(() => { refreshPricesRef.current = refreshPrices; });

  // Auto-refresh on login when data is ready and prices are stale
  useEffect(() => {
    if (!user || !holdings.length || !tickerMappings.length) return;
    if (hasAutoRefreshed.current || refreshingRef.current) return;
    const now = Date.now();
    const needsRefresh = tickerMappings.some(m => { const pd = priceCache[m.ticker]; return !pd || (now - pd.fetchedAt) > PRICE_TTL_MS; });
    if (needsRefresh) { hasAutoRefreshed.current = true; refreshPricesRef.current(); }
  }, [tickerMappings, holdings, user]);

  // Periodic 15-minute refresh
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => { if (!refreshingRef.current) refreshPricesRef.current(); }, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  // Fetch index history for comparison chart
  const earliestSnapshotDate = portfolioSnapshots.length >= 2 ? portfolioSnapshots[0]?.date : undefined;
  useEffect(() => {
    if (!earliestSnapshotDate) return;
    fetch(`/api/index-history?from=${earliestSnapshotDate}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setIndexHistory(data); })
      .catch(() => {});
  }, [earliestSnapshotDate]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function computeTotalSEK(cache: Record<string, PriceData>, fx: Record<string, number>) {
    return holdings.reduce((sum, h) => {
      const tm = tickerMappings.find(x => x.isin === h.isin);
      if (!tm) return sum;
      const pd = cache[tm.ticker];
      if (!pd) return sum;
      const rate = fx[h.currency] ?? fx[pd.currency] ?? 1;
      return sum + h.shares * pd.price * rate;
    }, 0);
  }

  const handleSetAssetClass = async (isin: string, assetClass: string) => {
    if (!user) return;
    const existing = tickerMappings.find(m => m.isin === isin);
    if (!existing) return;
    const updated = { ...existing, assetClass: assetClass || undefined };
    upsertTickerMapping(updated);
    const newMappings = [...tickerMappings.filter(x => x.isin !== isin), updated];
    await saveTickerMappings(user.uid, newMappings).catch(() => {});
  };

  const saveTicker = async (isin: string) => {
    if (!user || !editValue.trim()) return;
    const holding = holdings.find(h => h.isin === isin);
    const existing = tickerMappings.find(m => m.isin === isin);
    const mapping: TickerMapping = { ...(existing ?? {}), isin, ticker: editValue.trim().toUpperCase(), name: holding?.name ?? isin, manual: true };
    upsertTickerMapping(mapping);
    const updated = [...tickerMappings.filter(x => x.isin !== isin), mapping];
    await saveTickerMappings(user.uid, updated);
    setEditTicker(null);
    setEditValue('');
  };

  const saveAccountName = (account: string) => {
    const val = editAccountValue.trim();
    const next = { ...accountNames };
    if (val) next[account] = val; else delete next[account];
    setAccountNames(next);
    localStorage.setItem('portfolio_account_names', JSON.stringify(next));
    setEditingAccount(null);
  };

  const toggleAccount = (account: string) =>
    setSelectedAccounts(prev => prev.includes(account) ? prev.filter(a => a !== account) : [...prev, account]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const allAccounts = useMemo(() => [...new Set(holdings.map(h => h.account))].sort(), [holdings]);

  // Per-account enriched holdings (each row = one account's position in a security)
  const enriched = useMemo(() => {
    return holdings.map(h => {
      const tm = tickerMappings.find(x => x.isin === h.isin);
      const pd = tm ? priceCache[tm.ticker] : undefined;
      const rate = fxRates[h.currency] ?? fxRates[pd?.currency ?? ''] ?? 1;
      const currentPrice = pd?.price ?? 0;
      const valueSEK = h.shares * currentPrice * rate;
      const costSEK = h.shares * h.avgBuyPrice * rate;
      const gainSEK = valueSEK - costSEK;
      const gainPct = costSEK > 0 ? (gainSEK / costSEK) * 100 : 0;
      return {
        ...h,
        ticker: tm?.ticker ?? '–',
        category: tm?.category ?? pd?.category ?? '',
        quoteType: tm?.quoteType ?? pd?.quoteType ?? '',
        assetClass: tm?.assetClass ?? '',
        currentPrice,
        valueSEK,
        costSEK,
        gainSEK,
        gainPct,
        changePercent: pd?.changePercent ?? 0,
        priceStale: pd ? Date.now() - pd.fetchedAt > PRICE_TTL_MS : true,
        hasTicker: !!tm?.ticker,
      };
    }).sort((a, b) => b.valueSEK - a.valueSEK);
  }, [holdings, tickerMappings, priceCache, fxRates]);

  // Aggregated by ISIN (for totals / pie chart, not for table when viewing all)
  const aggregatedEnriched = useMemo(() => {
    const map = new Map<string, any>();
    for (const h of enriched) {
      if (map.has(h.isin)) {
        const e = map.get(h.isin)!;
        e.shares += h.shares;
        e.valueSEK += h.valueSEK;
        e.costSEK += h.costSEK;
        e.gainSEK += h.gainSEK;
      } else {
        map.set(h.isin, { ...h });
      }
    }
    const arr = [...map.values()];
    arr.forEach(h => { h.gainPct = h.costSEK > 0 ? (h.gainSEK / h.costSEK) * 100 : 0; });
    return arr.sort((a, b) => b.valueSEK - a.valueSEK);
  }, [enriched]);

  // Table data: aggregate by ISIN when "All accounts" selected, per-account when filtered
  const filteredEnriched = useMemo(() => {
    // Use aggregated (no duplicate ISINs) when no account filter is active
    let r: any[] = selectedAccounts.length === 0 ? aggregatedEnriched : enriched.filter(h => selectedAccounts.includes(h.account));
    if (selectedClass) r = r.filter(h => h.assetClass === selectedClass || (selectedClass === 'Ej klassad' && !h.assetClass));
    return r;
  }, [enriched, aggregatedEnriched, selectedAccounts, selectedClass]);

  // Use aggregated enriched for class breakdown (no double-counting)
  const enrichedForClass = useMemo(() => {
    if (selectedAccounts.length === 0) return aggregatedEnriched;
    return enriched.filter(h => selectedAccounts.includes(h.account));
  }, [aggregatedEnriched, enriched, selectedAccounts]);

  const totalValueSEK = filteredEnriched.reduce((s, h) => s + h.valueSEK, 0);
  const totalCostSEK  = filteredEnriched.reduce((s, h) => s + h.costSEK, 0);
  const totalGainSEK  = totalValueSEK - totalCostSEK;
  const totalGainPct  = totalCostSEK > 0 ? (totalGainSEK / totalCostSEK) * 100 : 0;

  // Pie: top PIE_MAX_SLICES from aggregated, rest as "Övriga"
  const pieData = useMemo(() => {
    const data = aggregatedEnriched.filter(h => h.valueSEK > 0);
    if (data.length <= PIE_MAX_SLICES) return data.map(h => ({ name: h.name.length > 20 ? h.name.slice(0, 20) + '…' : h.name, value: h.valueSEK }));
    const top = data.slice(0, PIE_MAX_SLICES);
    const othersValue = data.slice(PIE_MAX_SLICES).reduce((s: number, h: any) => s + h.valueSEK, 0);
    return [
      ...top.map((h: any) => ({ name: h.name.length > 20 ? h.name.slice(0, 20) + '…' : h.name, value: h.valueSEK })),
      { name: `Övriga (${data.length - PIE_MAX_SLICES} st)`, value: othersValue },
    ];
  }, [aggregatedEnriched]);

  const historyData = portfolioSnapshots.map(s => ({ date: formatDate(s.date), value: s.totalValueSEK }));

  // % return series for comparison chart
  const portfolioPctData = useMemo(() => {
    if (portfolioSnapshots.length < 2) return [];
    const sorted = [...portfolioSnapshots].sort((a, b) => a.date.localeCompare(b.date));
    const base = sorted[0].totalValueSEK;
    if (!base) return [];
    return sorted.map(s => ({ date: s.date, portfolio: parseFloat(((s.totalValueSEK - base) / base * 100).toFixed(2)) }));
  }, [portfolioSnapshots]);

  const comparisonChartData = useMemo(() => {
    if (!portfolioPctData.length) return [];
    const map = new Map<string, { date: string; portfolio?: number; omxs30?: number; nasdaq?: number }>();
    for (const p of portfolioPctData) map.set(p.date, { date: p.date, portfolio: p.portfolio });
    if (indexHistory) {
      for (const d of indexHistory.omxs30) {
        const e = map.get(d.date) ?? { date: d.date };
        e.omxs30 = parseFloat(d.pct.toFixed(2));
        map.set(d.date, e);
      }
      for (const d of indexHistory.nasdaq) {
        const e = map.get(d.date) ?? { date: d.date };
        e.nasdaq = parseFloat(d.pct.toFixed(2));
        map.set(d.date, e);
      }
    }
    return [...map.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, date: formatDate(d.date) }));
  }, [portfolioPctData, indexHistory]);

  const priceAgeMinutes = (() => {
    const first = enriched[0];
    if (!first || first.priceStale) return null;
    const pd = priceCache[first.ticker];
    return pd ? Math.floor((Date.now() - pd.fetchedAt) / 60000) : null;
  })();

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!holdings.length) return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-2">
        <p className="text-gray-500 text-sm">Inga innehav ännu.</p>
        <p className="text-gray-400 text-xs">Ladda upp en Avanza-fil under <strong>Importera</strong> för att komma igång.</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto">
    <div className="p-4 lg:p-6 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Portfölj</h1>
            {priceAgeMinutes !== null && (
              <p className="text-[11px] text-gray-400">Kurser uppdaterade för {priceAgeMinutes} min sedan</p>
            )}
            {searchStatus === 'searching' && (
              <p className="text-[11px] text-blue-400 flex items-center gap-1">
                <span className="w-2.5 h-2.5 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                Söker tickers…
              </p>
            )}
            {searchStatus === 'done' && remapCount !== null && (
              <p className="text-[11px] text-green-600">{remapCount} ticker{remapCount !== 1 ? 's' : ''} uppdaterade</p>
            )}
          </div>

          {/* Account filter pills */}
          {allAccounts.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <button
                onClick={() => setSelectedAccounts([])}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedAccounts.length === 0 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Alla
              </button>
              {allAccounts.map(acc => (
                <div key={acc} className="flex items-center group">
                  <button
                    onClick={() => toggleAccount(acc)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedAccounts.includes(acc) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {accountNames[acc] || acc}
                  </button>
                  {/* Rename inline */}
                  {editingAccount === acc ? (
                    <div className="flex items-center gap-1 ml-1">
                      <input autoFocus value={editAccountValue} onChange={e => setEditAccountValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveAccountName(acc); if (e.key === 'Escape') setEditingAccount(null); }}
                        className="w-24 text-xs border border-blue-300 rounded px-1.5 py-0.5 outline-none" />
                      <button onClick={() => saveAccountName(acc)} className="text-green-500"><Check size={11} /></button>
                      <button onClick={() => setEditingAccount(null)} className="text-gray-400"><X size={11} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingAccount(acc); setEditAccountValue(accountNames[acc] || acc); }}
                      className="ml-0.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity">
                      <Pencil size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={remapAllTickers}
            disabled={refreshing || searchStatus === 'searching'}
            title="Söker om alla automatiska tickers via Morningstar och Yahoo"
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-40 transition-all">
            {searchStatus === 'searching'
              ? <><span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" /> Söker…</>
              : 'Återsök tickers'}
          </button>
          <button
            onClick={() => refreshPrices()}
            disabled={refreshing || !tickerMappings.length}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40 transition-all">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Uppdatera kurser
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Value card */}
        <Card className="p-4 lg:col-span-2">
          <p className="text-xs text-gray-400 mb-1">Totalt värde {selectedAccounts.length > 0 ? `· ${selectedAccounts.map(a => accountNames[a] || a).join(', ')}` : ''}</p>
          <p className="text-2xl font-bold text-gray-900">{formatSEK(totalValueSEK)}</p>
          <p className={`text-xs mt-1 font-medium ${totalGainSEK >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {totalGainSEK >= 0 ? <TrendingUp size={11} className="inline mr-0.5" /> : <TrendingDown size={11} className="inline mr-0.5" />}
            {formatSEK(totalGainSEK)} ({formatPct(totalGainPct)}) vs inköpspris
          </p>
          {allAccounts.length > 1 && selectedAccounts.length === 0 && (
            <div className="mt-3 space-y-1">
              {allAccounts.map(acc => {
                const accVal = enriched.filter(h => h.account === acc).reduce((s, h) => s + h.valueSEK, 0);
                return accVal > 0 ? (
                  <div key={acc} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{accountNames[acc] || acc}</span>
                    <span className="font-medium text-gray-700">{formatSEK(accVal)}</span>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </Card>

        {/* Pie chart */}
        <Card className="p-4 lg:col-span-3">
          <p className="text-xs text-gray-400 mb-2">Fördelning per innehav (top {PIE_MAX_SLICES})</p>
          {pieData.length > 0 ? (
            <div className="flex gap-4 items-center">
              <div className="flex-shrink-0" style={{ width: 140, height: 140 }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatSEK(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-gray-600 truncate flex-1">{item.name}</span>
                    <span className="text-gray-400 flex-shrink-0">{((item.value / (aggregatedEnriched.reduce((s: number, h: any) => s + h.valueSEK, 0))) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-8 text-center">Uppdatera kurser för att se fördelning</p>
          )}
        </Card>
      </div>

      {/* ── Asset class breakdown ─────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Tillgångsklasser</h2>
          <button onClick={() => setShowClassManager(v => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
            <Settings2 size={12} /> {showClassManager ? 'Stäng' : 'Hantera klasser'}
          </button>
        </div>
        {showClassManager && <ClassManager assetClasses={assetClasses} onSetClasses={setAssetClasses} />}
        <div className={showClassManager ? 'mt-3' : ''}>
          <ClassBreakdown enriched={enrichedForClass} assetClasses={assetClasses} selectedClass={selectedClass} onSelect={setSelectedClass} />
        </div>
        {totalValueSEK > 0 && enrichedForClass.some(h => !h.assetClass) && (
          <p className="text-[11px] text-orange-500 mt-2 flex items-center gap-1">
            <AlertCircle size={10} />
            {enrichedForClass.filter(h => !h.assetClass).length} innehav saknar tillgångsklass — välj i tabellen nedan.
          </p>
        )}
      </Card>

      {/* ── Holdings table ───────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Innehav
            {(selectedClass || selectedAccounts.length > 0) && (
              <span className="ml-2 text-xs font-normal text-blue-500">
                {[selectedAccounts.length > 0 && selectedAccounts.map(a => accountNames[a] || a).join(', '), selectedClass].filter(Boolean).join(' · ')}
                {' '}· {filteredEnriched.length} st
              </span>
            )}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-gray-400 border-b border-gray-100">
                <th className="text-left px-4 py-2">Värdepapper</th>
                {allAccounts.length > 1 && selectedAccounts.length > 0 && <th className="text-left px-3 py-2">Konto</th>}
                <th className="text-left px-3 py-2">Klass</th>
                <th className="text-right px-3 py-2">Ticker</th>
                <th className="text-right px-3 py-2">Antal</th>
                <th className="text-right px-3 py-2">Kurs</th>
                <th className="text-right px-3 py-2">Värde (SEK)</th>
                <th className="text-right px-3 py-2">Vinst/Förlust</th>
                <th className="text-right px-3 py-2">Dag %</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnriched.map(h => {
                const rowKey = selectedAccounts.length === 0 ? h.isin : `${h.isin}::${h.account}`;
                return (
                  <tr key={rowKey} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900 text-[12px]">{h.name}</p>
                      <p className="text-gray-400 text-[10px]">
                        {h.isin}
                        {h.category && <span className="ml-1.5 text-gray-300">· {h.category}</span>}
                      </p>
                    </td>

                    {/* Account (only shown when a specific account filter is active) */}
                    {allAccounts.length > 1 && selectedAccounts.length > 0 && (
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                          {accountNames[h.account] || h.account}
                        </span>
                      </td>
                    )}

                    {/* Asset class */}
                    <td className="px-3 py-2.5">
                      <select value={h.assetClass} onChange={e => handleSetAssetClass(h.isin, e.target.value)}
                        className="text-[11px] border border-gray-200 rounded-lg px-1.5 py-0.5 text-gray-600 bg-white focus:outline-none focus:border-blue-300 max-w-[110px]">
                        <option value="">–</option>
                        {assetClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                      </select>
                    </td>

                    {/* Ticker (editable) */}
                    <td className="px-3 py-2.5 text-right">
                      {editTicker === rowKey ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input value={editValue} onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveTicker(h.isin)}
                            placeholder="t.ex. AFRY.ST"
                            className="w-28 border border-blue-300 rounded px-1.5 py-0.5 text-xs outline-none" autoFocus />
                          <button onClick={() => saveTicker(h.isin)} className="text-green-500"><Check size={12} /></button>
                          <button onClick={() => setEditTicker(null)} className="text-gray-300"><X size={12} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditTicker(rowKey); setEditValue(h.ticker === '–' ? '' : h.ticker); }}
                          className="flex items-center gap-1 ml-auto text-gray-600 hover:text-blue-500 group">
                          <span className={h.hasTicker ? 'font-mono' : 'text-orange-400'}>{h.ticker}</span>
                          <Edit2 size={10} className="opacity-0 group-hover:opacity-100" />
                        </button>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                      {h.shares % 1 === 0 ? h.shares : h.shares.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                      {h.currentPrice > 0 ? h.currentPrice.toFixed(2) : '–'}
                      {h.currentPrice > 0 && <span className="text-gray-400 ml-0.5">{h.currency}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                      {h.valueSEK > 0 ? formatSEK(h.valueSEK) : '–'}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium ${h.gainSEK >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {h.costSEK > 0 ? <>{formatSEK(h.gainSEK)}<span className="text-[10px] ml-1 opacity-70">({formatPct(h.gainPct)})</span></> : '–'}
                    </td>
                    <td className={`px-3 py-2.5 text-right ${h.changePercent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {h.currentPrice > 0 ? formatPct(h.changePercent) : '–'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {enriched.some(h => !h.hasTicker) && (
          <div className="px-4 py-2 bg-orange-50 border-t border-orange-100 text-[11px] text-orange-600 flex items-center gap-1">
            <AlertCircle size={11} />
            Klicka på en orange ticker för att ange manuellt — prova också "Återsök tickers"-knappen.
          </div>
        )}
      </Card>

      {/* ── Comparison chart ─────────────────────────────────────────────── */}
      {comparisonChartData.length >= 2 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Avkastning jämfört med index</h2>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Portfölj</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" /> OMXS30</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block" /> Nasdaq</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={comparisonChartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
                width={46}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
                  name === 'portfolio' ? 'Portfölj' : name === 'omxs30' ? 'OMXS30' : 'Nasdaq',
                ]}
              />
              <Line type="monotone" dataKey="portfolio" stroke="#007aff" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="omxs30"    stroke="#ff9f0a" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} connectNulls strokeDasharray="4 2" />
              <Line type="monotone" dataKey="nasdaq"    stroke="#bf5af2" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} connectNulls strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          {!indexHistory && (
            <p className="text-[11px] text-gray-400 text-center mt-2">Laddar indexdata…</p>
          )}
        </Card>
      )}

    </div>
    </div>
  );
}
