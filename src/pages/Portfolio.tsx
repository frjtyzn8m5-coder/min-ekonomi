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
import { RefreshCw, Edit2, Check, X, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import type { TickerMapping, PriceData, PortfolioSnapshot } from '../types';

const CHART_COLORS = [
  '#007aff', '#34c759', '#ff9f0a', '#ff375f', '#bf5af2',
  '#64d2ff', '#ff6b35', '#30d158', '#ffd60a', '#5e5ce6',
  '#ff6961', '#0071e3',
];

const PRICE_TTL_MS = 4 * 60 * 60 * 1000; // 4h cache

// FX pairs needed for non-SEK holdings
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

export default function Portfolio() {
  const { user } = useAuthStore();
  const {
    holdings, tickerMappings, priceCache, portfolioSnapshots,
    setHoldings, setTickerMappings, upsertTickerMapping,
    setPriceCache, setPortfolioSnapshots, addPortfolioSnapshot,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [editTicker, setEditTicker] = useState<string | null>(null); // ISIN being edited
  const [editValue, setEditValue] = useState('');
  const [fxRates, setFxRates] = useState<Record<string, number>>({});

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

  // Auto-fetch tickers for holdings that don't have a mapping yet
  useEffect(() => {
    if (!holdings.length || !user) return;
    const unmapped = holdings.filter(h => h.isin && !tickerMappings.find(m => m.isin === h.isin));
    if (!unmapped.length) return;

    const isins = unmapped.map(h => h.isin).join(',');
    fetch(`/api/openfigi?isins=${encodeURIComponent(isins)}`)
      .then(r => r.json())
      .then(async (data: Record<string, { ticker: string; name: string }>) => {
        const newMappings: TickerMapping[] = Object.entries(data).map(([isin, v]) => ({
          isin,
          ticker: v.ticker,
          name: v.name,
          manual: false,
        }));
        const merged = [...tickerMappings];
        for (const m of newMappings) {
          if (!merged.find(x => x.isin === m.isin)) merged.push(m);
        }
        setTickerMappings(merged);
        await saveTickerMappings(user.uid, merged);
      })
      .catch(() => {}); // Silent fail – user can add tickers manually
  }, [holdings]);

  // Refresh prices
  const refreshPrices = async () => {
    if (!user || !tickerMappings.length) return;
    setRefreshing(true);
    setError('');
    try {
      const tickers = tickerMappings.map(m => m.ticker).filter(Boolean);
      const neededFx = [...new Set(
        holdings.map(h => h.currency).filter(c => c !== 'SEK' && FX_PAIRS[c])
          .map(c => FX_PAIRS[c])
      )];

      const allSymbols = [...tickers, ...neededFx];
      const resp = await fetch(
        `/api/prices?tickers=${encodeURIComponent(allSymbols.join(','))}`
      );
      const data: Record<string, { price: number; currency: string; changePercent: number; name: string }> = await resp.json();

      // Extract FX rates
      const newFx: Record<string, number> = { SEK: 1 };
      for (const [cur, pair] of Object.entries(FX_PAIRS)) {
        if (data[pair]) newFx[cur] = data[pair].price;
      }
      setFxRates(newFx);

      // Build price cache keyed by ticker
      const now = Date.now();
      const newCache: Record<string, PriceData> = { ...priceCache };
      for (const [symbol, q] of Object.entries(data)) {
        if (FX_PAIRS[symbol] || Object.values(FX_PAIRS).includes(symbol)) continue;
        newCache[symbol] = {
          ticker: symbol,
          price: q.price,
          currency: q.currency,
          changePercent: q.changePercent,
          fetchedAt: now,
        };
      }
      setPriceCache(newCache);
      await savePriceCache(user.uid, newCache);

      // Take a portfolio snapshot
      const totalSEK = computeTotalSEK(newCache, newFx);
      if (totalSEK > 0) {
        const snap: PortfolioSnapshot = {
          date: new Date().toISOString().slice(0, 10),
          totalValueSEK: totalSEK,
          holdings: holdings.map(h => {
            const tm = tickerMappings.find(x => x.isin === h.isin);
            const pd = tm ? newCache[tm.ticker] : undefined;
            const rate = newFx[h.currency] ?? 1;
            const valueSEK = pd ? h.shares * pd.price * rate : 0;
            return { isin: h.isin, name: h.name, valueSEK, shares: h.shares };
          }),
        };
        addPortfolioSnapshot(snap);
        await savePortfolioSnapshot(user.uid, snap);
      }
    } catch (e) {
      setError('Kunde inte hämta kurser. Kontrollera ticker-mappningarna.');
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

  // Computed values
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

  const saveTicker = async (isin: string) => {
    if (!user || !editValue.trim()) return;
    const holding = holdings.find(h => h.isin === isin);
    const mapping: TickerMapping = {
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
    <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Portfölj</h1>
          {priceAgeMinutes !== null && (
            <p className="text-[11px] text-gray-400 mt-0.5">Kurser uppdaterade för {priceAgeMinutes} min sedan</p>
          )}
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

      {/* Total value */}
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
          <p className="text-xs text-gray-400 mb-2">Fördelning</p>
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

      {/* Holdings table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Innehav</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-gray-400 border-b border-gray-100">
                <th className="text-left px-4 py-2">Värdepapper</th>
                <th className="text-right px-3 py-2">Ticker</th>
                <th className="text-right px-3 py-2">Antal</th>
                <th className="text-right px-3 py-2">Kurs</th>
                <th className="text-right px-3 py-2">Värde (SEK)</th>
                <th className="text-right px-3 py-2">Vinst/Förlust</th>
                <th className="text-right px-3 py-2">Dag %</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map(h => (
                <tr key={h.isin} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900 text-[12px]">{h.name}</p>
                    <p className="text-gray-400 text-[10px]">{h.isin}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {editTicker === h.isin ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveTicker(h.isin)}
                          placeholder="t.ex. AFRY.ST"
                          className="w-24 border border-blue-300 rounded px-1.5 py-0.5 text-xs outline-none"
                          autoFocus
                        />
                        <button onClick={() => saveTicker(h.isin)} className="text-green-500 hover:text-green-600"><Check size={12} /></button>
                        <button onClick={() => setEditTicker(null)} className="text-gray-300 hover:text-gray-500"><X size={12} /></button>
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
            <AlertCircle size={11} /> Klicka på orangea tickers för att ange dem manuellt – OpenFIGI hittade ingen automatisk matchning.
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
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip formatter={(v: number) => [formatSEK(v), 'Värde']} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#007aff"
                strokeWidth={2}
                dot={{ r: 3, fill: '#007aff' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 mt-2">
            Snapshots tas varje gång du klickar "Uppdatera kurser". Ladda upp Avanza-filer regelbundet för bättre historik.
          </p>
        </Card>
      )}

      {historyData.length === 1 && (
        <Card className="p-4">
          <p className="text-xs text-gray-400 text-center">
            Historikdiagrammet visas när du har uppdaterat kurser vid minst 2 olika tillfällen.
          </p>
        </Card>
      )}
    </div>
  );
}
