import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  saveHoldings, loadHoldings, saveTickerMappings, loadTickerMappings,
  savePriceCache, loadPriceCache, savePortfolioSnapshot, loadPortfolioSnapshots,
} from '../lib/db';
import { formatSEK } from '../utils/calculations';
import { Card } from '../components/ui/Card';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { RefreshCw, Edit2, Check, X, TrendingUp, TrendingDown, AlertCircle, Plus, Settings2 } from 'lucide-react';
import type { TickerMapping, PriceData, PortfolioSnapshot } from '../types';

const CHART_COLORS = [
  '#007aff', '#34c759', '#ff9f0a', '#ff375f', '#bf5af2',
  '#64d2ff', '#ff6b35', '#30d158', '#ffd60a', '#5e5ce6',
  '#ff6961', '#0071e3',
];

const PRICE_TTL_MS = 4 * 60 * 60 * 1000;

const FX_PAIRS: Record<string, string> = {
  NOK: 'NOKSEK=X',
  EUR: 'EURSEK=X',
  USD: 'USDSEK=X',
  GBP: 'GBPSEK=X',
};

function formatPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

// ── Asset class manager ────────────────────────────────────────────────────────

function ClassManager({
  assetClasses, onSetClasses,
}: { assetClasses: string[]; onSetClasses: (c: string[]) => void }) {
  const [newCls, setNewCls] = useState('');

  const add = () => {
    const v = newCls.trim();
    if (!v || assetClasses.includes(v)) return;
    onSetClasses([...assetClasses, v]);
    setNewCls('');
  };

  const remove = (cls: string) => onSetClasses(assetClasses.filter(c => c !== cls));

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {assetClasses.map(cls => (
          <span key={cls} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-0.5 text-xs text-gray-700">
            {cls}
            <button onClick={() => remove(cls)} className="text-gray-300 hover:text-red-400 ml-0.5">
              <X size={9} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newCls}
          onChange={e => setNewCls(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Ny klass, t.ex. Ädelmetaller…"
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-300"
        />
        <button onClick={add} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600">
          <Plus size={11} /> Lägg till
        </button>
      </div>
    </div>
  );
}

// ── Breakdown bar chart ────────────────────────────────────────────────────────

function ClassBreakdown({
  enriched, assetClasses, selectedClass, onSelect,
}: {
  enriched: any[];
  assetClasses: string[];
  selectedClass: string | null;
  onSelect: (cls: string | null) => void;
}) {
  const totalSEK = enriched.reduce((s, h) => s + h.valueSEK, 0);
  if (totalSEK === 0) return (
    <p className="text-xs text-gray-400 text-center py-2">
      Uppdatera kurser för att se fördelning per tillgångsslag.
    </p>
  );

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
        <button
          key={bar.name}
          onClick={() => onSelect(selectedClass === bar.name ? null : bar.name)}
          className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${
            selectedClass === bar.name ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
          <span className="text-xs font-medium text-gray-700 w-28 flex-shrink-0 truncate">{bar.name}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all"
              style={{ width: `${bar.pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0 text-right w-28">
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
  const [editTicker, setEditTicker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [showClassManager, setShowClassManager] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'done'>('idle');

  // Load data from Firebase on mount
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

  // Auto-search Yahoo Finance for unmapped holdings
  useEffect(() => {
    if (!holdings.length || !user) return;
    const unmapped = holdings.filter(h => h.isin && !tickerMappings.find(m => m.isin === h.isin));
    if (!unmapped.length) return;

    setSearchStatus('searching');
    Promise.all(
      unmapped.map(async (h) => {
        const country = h.isin.slice(0, 2).toUpperCase();
        try {
          const resp = await fetch(`/api/search-ticker?q=${encodeURIComponent(h.name)}&country=${country}`);
          if (!resp.ok) return null;
          const results = await resp.json() as { symbol: string; shortname: string; quoteType: string; typeDisp: string; score: number }[];
          if (!results.length || results[0].score < 3) return null;
          const best = results[0];
          return {
            isin: h.isin,
            ticker: best.symbol,
            name: best.shortname || h.name,
            manual: false,
            quoteType: best.quoteType,
            category: best.typeDisp,
          } as TickerMapping;
        } catch {
          return null;
        }
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

  // Refresh prices + enrich category from Yahoo Finance
  const refreshPrices = async () => {
    if (!user || !tickerMappings.length) return;
    setRefreshing(true);
    setError('');
    try {
      const tickers = tickerMappings.map(m => m.ticker).filter(Boolean);
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
      const updatedMappings = [...tickerMappings];
      let mappingsChanged = false;

      for (const [symbol, q] of Object.entries(data)) {
        if (Object.values(FX_PAIRS).includes(symbol)) continue;
        newCache[symbol] = {
          ticker: symbol,
          price: q.price,
          currency: q.currency,
          changePercent: q.changePercent,
          fetchedAt: now,
          category: q.category,
          quoteType: q.quoteType,
        };
        // Enrich TickerMapping with category from Yahoo Finance if not already set
        if (q.category || q.quoteType) {
          const idx = updatedMappings.findIndex(m => m.ticker === symbol);
          if (idx >= 0 && (!updatedMappings[idx].category || !updatedMappings[idx].quoteType)) {
            updatedMappings[idx] = {
              ...updatedMappings[idx],
              category: q.category || updatedMappings[idx].category,
              quoteType: q.quoteType || updatedMappings[idx].quoteType,
            };
            mappingsChanged = true;
          }
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
    const mapping: TickerMapping = {
      ...(existing ?? {}),
      isin,
      ticker: editValue.trim().toUpperCase(),
      name: holding?.name ?? isin,
      manual: true,
    };
    upsertTickerMapping(mapping);
    const updated = [...tickerMappings.filter(x => x.isin !== isin), mapping];
    await saveTickerMappings(user.uid, updated);
    setEditTicker(null);
    setEditValue('');
  };

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

  const filteredEnriched = selectedClass
    ? enriched.filter(h => h.assetClass === selectedClass || (selectedClass === 'Ej klassad' && !h.assetClass))
    : enriched;

  const totalValueSEK = enriched.reduce((s, h) => s + h.valueSEK, 0);
  const totalCostSEK = enriched.reduce((s, h) => s + h.costSEK, 0);
  const totalGainSEK = totalValueSEK - totalCostSEK;
  const totalGainPct = totalCostSEK > 0 ? (totalGainSEK / totalCostSEK) * 100 : 0;

  const pieData = enriched.filter(h => h.valueSEK > 0).map(h => ({
    name: h.name.length > 20 ? h.name.slice(0, 20) + '…' : h.name,
    value: h.valueSEK,
  }));

  const historyData = portfolioSnapshots.map(s => ({
    date: formatDate(s.date),
    value: s.totalValueSEK,
  }));

  const priceAgeMinutes = enriched[0]?.priceStale === false
    ? Math.floor((Date.now() - (priceCache[enriched[0].ticker]?.fetchedAt ?? 0)) / 60000)
    : null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!holdings.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <p className="text-gray-500 text-sm">Inga innehav ännu.</p>
          <p className="text-gray-400 text-xs">Ladda upp en Avanza-fil under <strong>Importera</strong> för att komma igång.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
    <div className="max-w-5xl mx-auto w-full p-4 lg:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Portfölj</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {priceAgeMinutes !== null && (
              <p className="text-[11px] text-gray-400">Kurser uppdaterade för {priceAgeMinutes} min sedan</p>
            )}
            {searchStatus === 'searching' && (
              <p className="text-[11px] text-blue-400 flex items-center gap-1">
                <span className="w-2.5 h-2.5 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                Söker tickers…
              </p>
            )}
          </div>
        </div>
        <button
          onClick={refreshPrices}
          disabled={refreshing || !tickerMappings.length}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40 transition-all"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Uppdatera kurser
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 sm:col-span-1">
          <p className="text-xs text-gray-400 mb-1">Totalt värde</p>
          <p className="text-2xl font-bold text-gray-900">{formatSEK(totalValueSEK)}</p>
          <p className={`text-xs mt-1 font-medium ${totalGainSEK >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {totalGainSEK >= 0 ? <TrendingUp size={11} className="inline mr-0.5" /> : <TrendingDown size={11} className="inline mr-0.5" />}
            {formatSEK(totalGainSEK)} ({formatPct(totalGainPct)})
          </p>
        </Card>
        <Card className="p-4 sm:col-span-2">
          <p className="text-xs text-gray-400 mb-2">Fördelning per innehav</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={35} outerRadius={60} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatSEK(v)} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">Uppdatera kurser för att se fördelning</p>
          )}
        </Card>
      </div>

      {/* Asset class breakdown */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Tillgångsklasser</h2>
          <button
            onClick={() => setShowClassManager(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            <Settings2 size={12} /> {showClassManager ? 'Stäng' : 'Hantera klasser'}
          </button>
        </div>
        {showClassManager && (
          <ClassManager assetClasses={assetClasses} onSetClasses={setAssetClasses} />
        )}
        <div className={showClassManager ? 'mt-3' : ''}>
          <ClassBreakdown
            enriched={enriched}
            assetClasses={assetClasses}
            selectedClass={selectedClass}
            onSelect={setSelectedClass}
          />
        </div>
        {totalValueSEK > 0 && enriched.some(h => !h.assetClass) && (
          <p className="text-[11px] text-orange-500 mt-2 flex items-center gap-1">
            <AlertCircle size={10} />
            {enriched.filter(h => !h.assetClass).length} innehav saknar tillgångsklass — välj i tabellen nedan.
          </p>
        )}
      </Card>

      {/* Holdings table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Innehav
            {selectedClass && (
              <span className="ml-2 text-xs font-normal text-blue-500">
                {selectedClass} · {filteredEnriched.length} st
              </span>
            )}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-gray-400 border-b border-gray-100">
                <th className="text-left px-4 py-2">Värdepapper</th>
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
              {filteredEnriched.map(h => (
                <tr key={h.isin} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  {/* Name + Yahoo category */}
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900 text-[12px]">{h.name}</p>
                    <p className="text-gray-400 text-[10px]">
                      {h.isin}
                      {h.category && <span className="ml-1.5 text-gray-300">· {h.category}</span>}
                    </p>
                  </td>

                  {/* Asset class dropdown */}
                  <td className="px-3 py-2.5">
                    <select
                      value={h.assetClass}
                      onChange={e => handleSetAssetClass(h.isin, e.target.value)}
                      className="text-[11px] border border-gray-200 rounded-lg px-1.5 py-0.5 text-gray-600 bg-white focus:outline-none focus:border-blue-300 max-w-[100px]"
                    >
                      <option value="">–</option>
                      {assetClasses.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </td>

                  {/* Ticker (editable) */}
                  <td className="px-3 py-2.5 text-right">
                    {editTicker === h.isin ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveTicker(h.isin)}
                          placeholder="t.ex. AFRY.ST"
                          className="w-28 border border-blue-300 rounded px-1.5 py-0.5 text-xs outline-none"
                          autoFocus
                        />
                        <button onClick={() => saveTicker(h.isin)} className="text-green-500"><Check size={12} /></button>
                        <button onClick={() => setEditTicker(null)} className="text-gray-300"><X size={12} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditTicker(h.isin); setEditValue(h.ticker === '–' ? '' : h.ticker); }}
                        className="flex items-center gap-1 ml-auto text-gray-600 hover:text-blue-500 group"
                      >
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
                    {h.costSEK > 0 ? (
                      <>
                        {formatSEK(h.gainSEK)}
                        <span className="text-[10px] ml-1 opacity-70">({formatPct(h.gainPct)})</span>
                      </>
                    ) : '–'}
                  </td>
                  <td className={`px-3 py-2.5 text-right ${h.changePercent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {h.currentPrice > 0 ? formatPct(h.changePercent) : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {enriched.some(h => !h.hasTicker) && (
          <div className="px-4 py-2 bg-orange-50 border-t border-orange-100 text-[11px] text-orange-600 flex items-center gap-1">
            <AlertCircle size={11} />
            Klicka på en orange ticker för att ange den manuellt — Yahoo Finance-sökning hittade ingen automatisk matchning.
          </div>
        )}
      </Card>

      {/* History chart */}
      {historyData.length >= 2 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Historiskt portföljvärde</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={40} />
              <Tooltip formatter={(v: number) => [formatSEK(v), 'Värde']} />
              <Line type="monotone" dataKey="value" stroke="#007aff" strokeWidth={2}
                dot={{ r: 3, fill: '#007aff' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

    </div>
    </div>
  );
}
