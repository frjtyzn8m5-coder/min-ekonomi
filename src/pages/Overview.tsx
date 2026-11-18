import { useStore } from '../store/useStore';
import { getMonthlyData, formatSEK, formatMonth, allMonths } from '../utils/calculations';
import { latestPortfolioValueSEK } from '../utils/portfolio';
import { CATEGORY_COLORS, EXPENSE_CATEGORIES } from '../utils/categorize';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { IWallet, IArrowRight } from '../components/ui/Icons';
import { motion } from 'framer-motion';

const FADE = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

const AXIS_FILL = '#9b9688';
const GRID_STROKE = 'rgba(244,241,234,.08)';
const TOOLTIP_STYLE = { background: '#15151b', border: '1px solid rgba(244,241,234,.09)', borderRadius: 12, fontSize: 11, color: '#f4f1ea' };

function TrendIcon({ pct }: { pct: number }) {
  if (pct > 5) return <TrendingUp size={14} className="text-cyan" />;
  if (pct < -5) return <TrendingDown size={14} className="text-coral" />;
  return <Minus size={14} className="text-faint" />;
}

function Sparkline({ data, color, width = 72 }: { data: number[]; color: string; width?: number }) {
  const points = data.map((v) => ({ v }));
  return (
    <LineChart width={width} height={28} data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs" style={{ background: '#15151b', border: '1px solid rgba(244,241,234,.09)' }}>
      <p className="font-semibold text-ink mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {formatSEK(p.value)}</p>
      ))}
    </div>
  );
};

export default function Overview() {
  const {
    transactions, setPage,
    assets, debts,
    holdings, priceCache, tickerMappings, portfolioSnapshots,
  } = useStore();

  const hasTx = transactions.length > 0;
  const hasSnapshot = assets.length > 0 || debts.length > 0;

  // ── First-run: nothing to show at all ──────────────────────────────────────
  if (!hasTx && !hasSnapshot) {
    return (
      <div className="relative flex-1 flex items-center justify-center p-6 bg-bg text-ink overflow-hidden">
        <div className="vh-aurora" />
        <div className="relative z-10 flex flex-col items-center justify-center py-12 text-center">
          <span className="vh-tile vh-tile--gold w-12 h-12 mb-4"><IWallet size={26} /></span>
          <p className="text-sm font-medium text-mut">Inget att visa ännu</p>
          <p className="text-xs text-faint mt-1 max-w-xs">Importera dina kontoutdrag eller lägg till en förmögenhets-snapshot för att se din översikt</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => setPage('import')}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-[#2a1d08]"
              style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
              Importera filer <IArrowRight size={14} />
            </button>
            <button onClick={() => setPage('networth')}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-ink border border-line hover:bg-card">
              Lägg till förmögenhet <IArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Förmögenhet (net worth) — REAL data only ───────────────────────────────
  const livePortfolio = latestPortfolioValueSEK(portfolioSnapshots, holdings, priceCache, tickerMappings);

  const latestAsset = assets.length ? assets[assets.length - 1] : null;
  const latestDebt  = debts.length ? debts[debts.length - 1] : null;

  const cashVal      = latestAsset?.cash ?? 0;
  const cryptoVal    = latestAsset?.crypto ?? 0;
  const sparkontoVal = latestAsset?.sparkonto ?? 0;
  const otherAssetVal = latestAsset?.other ?? 0;
  // The snapshot's `avanza` field is the user's recorded investment value. When a
  // live portfolio value exists it is the more current figure, so it REPLACES the
  // recorded avanza (prevents double-counting — NetWorth.tsx prefills avanza from
  // this same portfolio). Falls back to the recorded avanza when no live value.
  const investmentValue = livePortfolio > 0 ? livePortfolio : (latestAsset?.avanza ?? 0);

  const totalAssets = cashVal + investmentValue + cryptoVal + sparkontoVal + otherAssetVal;
  const totalDebts  = (latestDebt?.csn ?? 0) + (latestDebt?.klarna ?? 0) + (latestDebt?.other ?? 0);
  const netWorth    = totalAssets - totalDebts;

  // Net-worth timeline from recorded snapshots (assets − debts per month).
  const nwMonths = [...new Set([...assets.map(a => a.month), ...debts.map(d => d.month)])].sort();
  const nwTimeline = nwMonths.map(m => {
    const a = assets.find(x => x.month === m);
    const d = debts.find(x => x.month === m);
    const ta = a ? (a.cash + a.avanza + a.crypto + a.sparkonto + a.other) : 0;
    const td = d ? (d.csn + d.klarna + d.other) : 0;
    return { name: formatMonth(m), 'Förmögenhet': ta - td, 'Tillgångar': ta, 'Skulder': td };
  });
  const prevNW = nwTimeline.length >= 2 ? nwTimeline[nwTimeline.length - 2]['Förmögenhet'] : null;
  const nwChange = prevNW !== null ? netWorth - prevNW : null;
  const nwChangePct = prevNW && prevNW !== 0 ? (nwChange! / Math.abs(prevNW)) * 100 : 0;
  // Spark uses recorded history, with the live-adjusted current value as the last point.
  const nwSpark = nwTimeline.map(t => t['Förmögenhet']);
  if (nwSpark.length) nwSpark[nwSpark.length - 1] = netWorth;

  const assetRows = [
    { label: 'Kontanter / bank', value: cashVal, color: '#5fe0d0' },
    { label: 'Portfölj (Avanza/aktier)', value: investmentValue, color: '#e9c178', live: livePortfolio > 0 },
    { label: 'Krypto', value: cryptoVal, color: '#9b8cff' },
    { label: 'Sparkonto', value: sparkontoVal, color: '#bfe26a' },
    { label: 'Övrigt', value: otherAssetVal, color: '#9b9688' },
  ].filter(r => r.value !== 0);

  const debtRows = [
    { label: 'CSN studielån', value: latestDebt?.csn ?? 0, color: '#ff8f7a' },
    { label: 'Klarna / kortkredit', value: latestDebt?.klarna ?? 0, color: '#ff8f7a' },
    { label: 'Övrigt', value: latestDebt?.other ?? 0, color: '#ff8f7a' },
  ].filter(r => r.value !== 0);

  const asOfMonth = [latestAsset?.month, latestDebt?.month].filter(Boolean).sort().pop();
  const splitTotal = totalAssets + totalDebts;
  const assetsPct = splitTotal > 0 ? (totalAssets / splitTotal) * 100 : 50;

  // ── Monthly cashflow / savings — REAL data only ────────────────────────────
  const monthlyData = hasTx ? getMonthlyData(transactions) : [];
  const lastMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];

  // "Sparande" = inkomst − utgifter (utgifter exkluderar pengar flyttade till sparande).
  const monthSaved = lastMonth ? lastMonth.income - lastMonth.expenses : 0;
  const prevSaved  = prevMonth ? prevMonth.income - prevMonth.expenses : 0;
  const savedPct = prevSaved !== 0 ? ((monthSaved - prevSaved) / Math.abs(prevSaved)) * 100 : 0;
  const incPct = prevMonth && prevMonth.income !== 0 ? ((lastMonth.income - prevMonth.income) / prevMonth.income) * 100 : 0;
  const expPct = prevMonth && prevMonth.expenses !== 0 ? ((lastMonth.expenses - prevMonth.expenses) / prevMonth.expenses) * 100 : 0;

  const savingsRate = lastMonth && lastMonth.income > 0
    ? Math.round((monthSaved / lastMonth.income) * 100)
    : null;

  const last8 = monthlyData.slice(-8);
  const sparkIncome   = last8.map(m => m.income);
  const sparkExpenses = last8.map(m => m.expenses);
  const sparkSavings  = last8.map(m => m.income - m.expenses);

  // Top expense categories (last 3 months).
  const last3Months = hasTx ? allMonths(transactions).slice(-3) : [];
  const catTotals: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.isTransfer || tx.amount >= 0) continue;
    if (!last3Months.includes(tx.date.slice(0, 7))) continue;
    catTotals[tx.category] = (catTotals[tx.category] || 0) + Math.abs(tx.amount);
  }
  const pieData = Object.entries(catTotals)
    .filter(([cat]) => EXPENSE_CATEGORIES.includes(cat as any))
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([cat, val]) => ({ name: cat, value: val }));

  const recentTxs = [...transactions]
    .filter(t => !t.isTransfer)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <div className="relative min-h-full bg-bg text-ink overflow-hidden">
      <div className="vh-aurora" />
      <div className="relative z-10 px-4 sm:px-6 lg:px-10 py-6 space-y-4 lg:space-y-5">

        {/* Header */}
        <motion.div {...FADE} transition={{ duration: 0.3 }} className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Ekonomi</p>
            <h1 className="font-display text-3xl sm:text-4xl text-ink mt-2 leading-none">Översikt</h1>
            <p className="text-sm text-faint mt-2">
              {hasTx ? `${monthlyData.length} månader · ${transactions.filter(t => !t.isTransfer).length} transaktioner` : 'Förmögenhet & sparande'}
            </p>
          </div>
        </motion.div>

        {/* ── HERO: Förmögenhet ─────────────────────────────────────────────── */}
        {hasSnapshot ? (
          <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.05 }}>
            <div className="vh-card p-6 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.16em] text-faint mb-1">Din förmögenhet</p>
                  <p className={`font-display tracking-tight tabular-nums leading-none text-4xl sm:text-5xl lg:text-6xl ${netWorth >= 0 ? 'text-ink' : 'text-coral'}`}>
                    {formatSEK(netWorth)}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs">
                    {nwChange !== null && (
                      <span className={`flex items-center gap-1 ${nwChange >= 0 ? 'text-cyan' : 'text-coral'}`}>
                        <TrendIcon pct={nwChangePct} />
                        {nwChange >= 0 ? '+' : ''}{formatSEK(nwChange)}
                        {prevNW && prevNW !== 0 ? ` (${nwChangePct > 0 ? '+' : ''}${nwChangePct.toFixed(0)}%)` : ''} sedan förra snapshot
                      </span>
                    )}
                    {asOfMonth && <span className="text-faint">Per {formatMonth(asOfMonth)}</span>}
                    {livePortfolio > 0 && <span className="text-faint">· inkl. live portfölj</span>}
                  </div>
                </div>
                {nwSpark.length > 1 && (
                  <div className="opacity-80">
                    <Sparkline data={nwSpark} color={netWorth >= 0 ? '#e9c178' : '#ff8f7a'} width={150} />
                  </div>
                )}
              </div>

              {/* Assets vs debts split bar */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-cyan font-medium tabular-nums">{formatSEK(totalAssets)} tillgångar</span>
                  <span className="text-coral font-medium tabular-nums">{formatSEK(totalDebts)} skulder</span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,143,122,.22)' }}>
                  <div className="h-full rounded-full" style={{ width: `${assetsPct}%`, background: '#5fe0d0' }} />
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.05 }}>
            <div className="vh-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-faint mb-1">Din förmögenhet</p>
                <p className="font-display text-2xl text-ink leading-tight">Ingen förmögenhets-snapshot ännu</p>
                <p className="text-sm text-faint mt-1 max-w-md">
                  Lägg till dina tillgångar och skulder för att se ditt nettovärde{livePortfolio > 0 ? ' — din live portfölj läggs till automatiskt' : ''}.
                </p>
              </div>
              <button onClick={() => setPage('networth')}
                className="flex-shrink-0 flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-[#2a1d08]"
                style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
                Lägg till snapshot <IArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Tillgångar vs Skulder breakdown ───────────────────────────────── */}
        {hasSnapshot && (
          <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.08 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
            {/* Tillgångar */}
            <div className="vh-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-ink text-[15px]">Tillgångar</h3>
                <span className="font-display text-cyan tabular-nums">{formatSEK(totalAssets)}</span>
              </div>
              <div className="space-y-2.5">
                {assetRows.length === 0 && <p className="text-xs text-faint py-2">Inga registrerade tillgångar.</p>}
                {assetRows.map(r => (
                  <div key={r.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-mut min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                      <span className="truncate">{r.label}</span>
                      {r.live && <span className="text-[10px] text-gold flex-shrink-0">live</span>}
                    </span>
                    <span className="tabular-nums text-ink flex-shrink-0 ml-2">{formatSEK(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Skulder */}
            <div className="vh-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-ink text-[15px]">Skulder</h3>
                <span className="font-display text-coral tabular-nums">{formatSEK(totalDebts)}</span>
              </div>
              <div className="space-y-2.5">
                {debtRows.length === 0 && <p className="text-xs text-faint py-2">Inga registrerade skulder.</p>}
                {debtRows.map(r => (
                  <div key={r.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-mut min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                      <span className="truncate">{r.label}</span>
                    </span>
                    <span className="tabular-nums text-ink flex-shrink-0 ml-2">{formatSEK(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Månadens sparande + sparkvot ──────────────────────────────────── */}
        {hasTx && lastMonth && (
          <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: `Sparat ${formatMonth(lastMonth.month)}`,
                value: formatSEK(monthSaved),
                color: monthSaved >= 0 ? 'text-gold' : 'text-coral',
                sub: prevMonth && savedPct !== 0
                  ? <span className={`flex items-center gap-0.5 text-[11px] mt-0.5 ${savedPct > 0 ? 'text-cyan' : 'text-coral'}`}>
                      <TrendIcon pct={savedPct} />{savedPct > 0 ? '+' : ''}{savedPct.toFixed(0)}% vs förra
                    </span> : null,
                spark: sparkSavings, sparkColor: '#e9c178',
              },
              {
                label: 'Sparkvot',
                value: savingsRate !== null ? `${savingsRate}%` : '—',
                color: savingsRate === null ? 'text-ink' : savingsRate >= 20 ? 'text-cyan' : savingsRate >= 0 ? 'text-gold' : 'text-coral',
                sub: savingsRate !== null
                  ? <span className="text-[11px] text-faint mt-0.5">
                      {savingsRate >= 20 ? 'Starkt sparande' : savingsRate >= 10 ? 'Okej — kan höjas' : savingsRate >= 0 ? 'Lågt den här månaden' : 'Minus denna månad'}
                    </span> : null,
                spark: [], sparkColor: '#e9c178',
              },
              {
                label: `Inkomst ${formatMonth(lastMonth.month)}`,
                value: formatSEK(lastMonth.income),
                color: 'text-ink',
                sub: prevMonth && incPct !== 0
                  ? <span className={`flex items-center gap-0.5 text-[11px] mt-0.5 ${incPct > 0 ? 'text-cyan' : 'text-coral'}`}>
                      <TrendIcon pct={incPct} />{incPct > 0 ? '+' : ''}{incPct.toFixed(0)}% vs förra
                    </span> : null,
                spark: sparkIncome, sparkColor: '#5fe0d0',
              },
              {
                label: `Utgifter ${formatMonth(lastMonth.month)}`,
                value: formatSEK(lastMonth.expenses),
                color: 'text-ink',
                sub: prevMonth && expPct !== 0
                  ? <span className={`flex items-center gap-0.5 text-[11px] mt-0.5 ${expPct < 0 ? 'text-cyan' : 'text-coral'}`}>
                      <TrendIcon pct={-expPct} />{expPct > 0 ? '+' : ''}{expPct.toFixed(0)}% vs förra
                    </span> : null,
                spark: sparkExpenses, sparkColor: '#ff8f7a',
              },
            ].map(({ label, value, color, sub, spark, sparkColor }) => (
              <div key={label} className="vh-card p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-faint mb-0.5">{label}</p>
                    <p className={`font-display text-xl tabular-nums tracking-tight ${color}`}>{value}</p>
                    {sub}
                  </div>
                  {spark.length > 1 && (
                    <div className="flex-shrink-0 opacity-80 ml-2 mt-1">
                      <Sparkline data={spark} color={sparkColor} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Charts: Inkomst vs Utgifter + Utgifter per kategori ───────────── */}
        {hasTx && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.12 }} className="lg:col-span-2 flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Inkomster vs Utgifter</h3>
                  <p className="text-xs text-faint mt-0.5">Per månad</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData.map(d => ({
                    name: formatMonth(d.month), Inkomst: d.income, Utgifter: d.expenses,
                  }))} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: AXIS_FILL }} />
                    <Bar dataKey="Inkomst"  fill="#5fe0d0" radius={[4,4,0,0]} />
                    <Bar dataKey="Utgifter" fill="#ff8f7a" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.15 }} className="flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Utgifter per kategori</h3>
                  <p className="text-xs text-faint mt-0.5">Senaste 3 månader</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={66} outerRadius={100} paddingAngle={3} dataKey="value">
                      {pieData.map(({ name }) => <Cell key={name} fill={CATEGORY_COLORS[name] || 'rgba(244,241,234,.14)'} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatSEK(v)} contentStyle={TOOLTIP_STYLE} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: AXIS_FILL }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        )}

        {/* ── Sparande över tid + Senaste transaktioner ─────────────────────── */}
        {hasTx && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 lg:items-stretch">
            {/* Savings over time */}
            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.18 }} className="lg:col-span-7 flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Sparande över tid</h3>
                  <p className="text-xs text-faint mt-0.5">Inkomst minus utgifter per månad</p>
                </div>
                <div className="flex-1 flex items-center min-h-0">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={monthlyData.map(d => ({ name: formatMonth(d.month), 'Sparande': d.income - d.expenses }))}>
                      <defs>
                        <linearGradient id="savGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#e9c178" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#e9c178" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="Sparande" stroke="#e9c178" strokeWidth={2}
                        fill="url(#savGrad)" dot={{ fill: '#e9c178', r: 3 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>

            {/* Recent transactions */}
            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.22 }} className="lg:col-span-5 flex">
              <div className="vh-card w-full flex flex-col">
                <div className="px-5 py-4 border-b border-line flex items-center justify-between">
                  <h3 className="font-display text-ink text-[15px]">Senaste transaktioner</h3>
                  <button onClick={() => setPage('transactions')}
                    className="text-xs text-gold hover:text-gold flex items-center gap-1">
                    Visa alla <IArrowRight size={12} />
                  </button>
                </div>
                <div className="divide-y divide-line flex-1">
                  {recentTxs.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold"
                          style={{ background: (CATEGORY_COLORS[tx.category] || '#625d52') + '25', color: CATEGORY_COLORS[tx.category] || '#9b9688' }}>
                          {tx.description.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate max-w-[180px] lg:max-w-64">{tx.description}</p>
                          <p className="text-xs text-faint">{tx.date} · {tx.category}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ml-3 ${tx.amount >= 0 ? 'text-cyan' : 'text-ink'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatSEK(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </div>
  );
}
