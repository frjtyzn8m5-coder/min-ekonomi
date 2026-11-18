import { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  getMonthlyData, formatSEK, formatMonth,
  getSpendingCalendar, getCategoryTotals
} from '../utils/calculations';
import { CATEGORY_COLORS, EXPENSE_CATEGORIES, diagnoseUncategorized } from '../utils/categorize';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Treemap, ComposedChart,
  ReferenceLine, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  AreaChart, Area, Line,
} from 'recharts';
import { ITrend, IArrowRight } from '../components/ui/Icons';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

const FADE = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

const AXIS_FILL = '#9b9688';
const GRID_STROKE = 'rgba(244,241,234,.08)';
const TOOLTIP_STYLE = { background: '#15151b', border: '1px solid rgba(244,241,234,.09)', borderRadius: 12, fontSize: 11, color: '#f4f1ea' };

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

function SpendingHeatmap({ year }: { year: number }) {
  const { transactions } = useStore();
  const cal = getSpendingCalendar(transactions, year);
  const values = Object.values(cal);
  const maxVal = Math.max(...values, 1);

  const weeks: Array<Array<{ date: string; val: number } | null>> = [];
  const firstDay = new Date(year, 0, 1);
  const startOffset = firstDay.getDay();
  let week: Array<{ date: string; val: number } | null> = [];

  for (let i = 0; i < startOffset; i++) week.push(null);
  const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
  for (let d = 0; d < daysInYear; d++) {
    const date = new Date(year, 0, d + 1);
    const str = date.toISOString().slice(0, 10);
    week.push({ date: str, val: cal[str] || 0 });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const months = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
  function opacity(val: number) {
    if (val === 0) return 0.05;
    return 0.15 + (val / maxVal) * 0.85;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5 min-w-max">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day, di) => (
              <div key={di} title={day ? `${day.date}: ${formatSEK(day.val)}` : ''}
                className="w-3 h-3 rounded-sm"
                style={{ background: day ? `rgba(255, 143, 122, ${opacity(day.val)})` : 'transparent', cursor: day ? 'pointer' : 'default' }} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-faint">
        {months.map(m => <span key={m}>{m}</span>)}
      </div>
    </div>
  );
}

function TreemapCell({ x, y, width, height, name, value }: any) {
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x+1} y={y+1} width={width-2} height={height-2} fill={CATEGORY_COLORS[name] || 'rgba(244,241,234,.14)'} opacity={0.85} rx={4} />
      {width > 50 && height > 30 && (
        <>
          <text x={x+8} y={y+18} fill="#15151b" fontSize={10} fontWeight={600}>{name}</text>
          {height > 42 && <text x={x+8} y={y+30} fill="#15151b" fontSize={9} opacity={0.75}>{formatSEK(value)}</text>}
        </>
      )}
    </g>
  );
}

export default function Analytics() {
  const { transactions, setPage } = useStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  if (!transactions.length) {
    return (
      <div className="relative flex-1 flex items-center justify-center p-6 bg-bg text-ink overflow-hidden">
        <div className="vh-aurora" />
        <div className="relative z-10 flex flex-col items-center justify-center py-12 text-center">
          <span className="vh-tile vh-tile--violet w-12 h-12 mb-4"><ITrend size={26} /></span>
          <p className="text-sm font-medium text-mut">Inga transaktioner</p>
          <p className="text-xs text-faint mt-1 max-w-xs">Importera kontoutdrag för att se analyser</p>
          <div className="mt-4">
            <button onClick={() => setPage('import')}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-[#2a1d08]"
              style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
              Importera <IArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter ALL data by selected year
  const yearTxs = transactions.filter(t => t.date.startsWith(String(selectedYear)));
  const monthlyData = getMonthlyData(yearTxs);
  const years = [...new Set(transactions.map(t => t.date.slice(0, 4)).map(Number))].sort();

  const catTotals = getCategoryTotals(yearTxs);
  const treemapData = EXPENSE_CATEGORIES
    .filter(c => catTotals[c] > 0)
    .map(c => ({ name: c, value: catTotals[c] }))
    .sort((a, b) => b.value - a.value);

  const top6Cats = treemapData.slice(0, 6).map(d => d.name);
  const stackedData = monthlyData.map(m => {
    const row: any = { name: formatMonth(m.month) };
    top6Cats.forEach(c => { row[c] = m.byCategory[c] || 0; });
    return row;
  });

  const last6 = monthlyData.slice(-6);
  const momData = last6.map((m, i) => {
    const prev = monthlyData[monthlyData.length - 6 + i - 1];
    return { name: formatMonth(m.month), Utgifter: m.expenses, Förändring: prev ? m.expenses - prev.expenses : 0 };
  });

  const last2 = monthlyData.slice(-2);
  const radarData = top6Cats.map(cat => ({
    cat,
    [last2[0] ? formatMonth(last2[0].month) : 'Förra']: last2[0]?.byCategory[cat] || 0,
    [last2[1] ? formatMonth(last2[1].month) : 'Nu']:    last2[1]?.byCategory[cat] || 0,
  }));

  // ── KPIs for the year ──────────────────────────────────────────────────────
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);
  const totalIncome   = monthlyData.reduce((s, m) => s + m.income, 0);
  const avgMonthly    = monthlyData.length ? totalExpenses / monthlyData.length : 0;
  const savingsRate   = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : null;
  const biggestCat    = treemapData[0] ?? null;

  // ── Expense trend (per month) with average reference ───────────────────────
  const trendData = monthlyData.map(m => ({
    name: formatMonth(m.month),
    Utgifter: m.expenses,
    Inkomst: m.income,
  }));

  // ── Biggest month-over-month category changes (last month vs previous) ─────
  const curM = monthlyData[monthlyData.length - 1];
  const prvM = monthlyData[monthlyData.length - 2];
  const momChanges = (curM && prvM)
    ? EXPENSE_CATEGORIES
        .map(cat => {
          const curr = curM.byCategory[cat] || 0;
          const prev = prvM.byCategory[cat] || 0;
          return { cat, curr, prev, diff: curr - prev, pct: prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0) };
        })
        .filter(c => c.curr > 0 || c.prev > 0)
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        .slice(0, 6)
    : [];

  // ── Top categories with share + half-year trend ────────────────────────────
  const firstHalf = monthlyData.slice(0, Math.ceil(monthlyData.length / 2));
  const secondHalf = monthlyData.slice(Math.ceil(monthlyData.length / 2));
  const sumCat = (arr: typeof monthlyData, cat: string) => arr.reduce((s, m) => s + (m.byCategory[cat] || 0), 0);
  const topCats = treemapData.slice(0, 8).map(d => {
    const h1 = sumCat(firstHalf, d.name);
    const h2 = sumCat(secondHalf, d.name);
    return {
      name: d.name,
      value: d.value,
      pct: totalExpenses > 0 ? (d.value / totalExpenses) * 100 : 0,
      trend: h2 - h1,
    };
  });

  // ── Uncategorised spend diagnosis ("Övrigt" breakdown) ─────────────────────
  const uncategorized = diagnoseUncategorized(yearTxs, 8);
  const uncatTotal = uncategorized.reduce((s, u) => s + u.total, 0);
  const uncatShare = totalExpenses > 0 ? (uncatTotal / totalExpenses) * 100 : 0;

  const kpis = [
    { label: `Totala utgifter ${selectedYear}`, value: formatSEK(totalExpenses), color: 'text-coral' },
    { label: 'Snitt per månad', value: formatSEK(Math.round(avgMonthly)), color: 'text-ink' },
    { label: 'Största kategori', value: biggestCat ? biggestCat.name : '—',
      sub: biggestCat ? formatSEK(biggestCat.value) : undefined, color: 'text-gold' },
    { label: `Sparkvot ${selectedYear}`, value: savingsRate !== null ? `${savingsRate}%` : '—',
      color: savingsRate === null ? 'text-ink' : savingsRate >= 20 ? 'text-cyan' : savingsRate >= 0 ? 'text-gold' : 'text-coral' },
  ];

  return (
    <div className="relative min-h-full w-full bg-bg text-ink overflow-hidden">
      <div className="vh-aurora" />
      <div className="relative z-10 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-10 py-6">
      <header className="mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Ekonomi</p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink mt-2 leading-none">Analys</h1>
          <p className="text-sm text-faint mt-2">Insikter och mönster i dina utgifter</p>
        </div>
        <div className="flex rounded-lg border border-line overflow-hidden text-xs">
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`px-3 py-2 font-medium ${selectedYear === y ? 'text-[#2a1d08]' : 'text-mut hover:bg-white/5'}`}
              style={selectedYear === y ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}>
              {y}
            </button>
          ))}
        </div>
      </header>

      {monthlyData.length === 0 ? (
        <div className="flex items-center justify-center py-32 text-sm text-faint">
          Ingen data för {selectedYear}
        </div>
      ) : (
        <div className="space-y-4 lg:space-y-5">

          {/* ── KPI row ─────────────────────────────────────────────────────── */}
          <motion.div {...FADE} transition={{ duration: 0.3 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {kpis.map(k => (
              <div key={k.label} className="vh-card p-5">
                <p className="text-xs text-faint mb-1">{k.label}</p>
                <p className={`font-display text-xl lg:text-2xl tabular-nums tracking-tight truncate ${k.color}`}>{k.value}</p>
                {k.sub && <p className="text-[11px] text-faint mt-0.5 tabular-nums">{k.sub}</p>}
              </div>
            ))}
          </motion.div>

          {/* ── Trend + biggest changes ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.05 }} className="lg:col-span-8 flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Utgiftstrend</h3>
                  <p className="text-xs text-faint mt-0.5">Utgifter mot inkomster per månad · streckad linje = snitt</p>
                </div>
                <div className="flex-1 flex items-center min-h-0">
                  <ResponsiveContainer width="100%" height={340}>
                    <ComposedChart data={trendData}>
                      <defs>
                        <linearGradient id="expTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff8f7a" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#ff8f7a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: AXIS_FILL }} />
                      <ReferenceLine y={avgMonthly} stroke="#e9c178" strokeDasharray="5 4" strokeOpacity={0.7} />
                      <Area type="monotone" dataKey="Utgifter" stroke="#ff8f7a" strokeWidth={2} fill="url(#expTrend)" dot={{ r: 2.5, fill: '#ff8f7a' }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="Inkomst" stroke="#5fe0d0" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>

            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.1 }} className="lg:col-span-4 flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-3">
                  <h3 className="font-display text-ink text-[15px]">Största förändringar</h3>
                  <p className="text-xs text-faint mt-0.5">
                    {curM && prvM ? `${formatMonth(curM.month)} vs ${formatMonth(prvM.month)}` : 'Behöver 2 månader'}
                  </p>
                </div>
                {momChanges.length ? (
                  <div className="space-y-2.5">
                    {momChanges.map(c => {
                      const up = c.diff > 0;
                      return (
                        <div key={c.cat} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[c.cat] || 'rgba(244,241,234,.2)' }} />
                            <span className="text-sm text-mut truncate">{c.cat}</span>
                          </span>
                          <span className={`flex items-center gap-1 text-xs font-medium tabular-nums flex-shrink-0 ${up ? 'text-coral' : 'text-cyan'}`}>
                            {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {up ? '+' : ''}{formatSEK(c.diff)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-faint">Behöver minst 2 månader</div>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── Treemap + top categories ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.12 }} className="flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Utgiftsfördelning</h3>
                  <p className="text-xs text-faint mt-0.5">Totalt {selectedYear}</p>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <Treemap data={treemapData} dataKey="value" aspectRatio={4/3} content={<TreemapCell />}>
                    <Tooltip formatter={(v: any, n: any) => [formatSEK(v), n]} contentStyle={TOOLTIP_STYLE} />
                  </Treemap>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.15 }} className="flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Toppkategorier</h3>
                  <p className="text-xs text-faint mt-0.5">Andel av utgifter · trend = andra halvan vs första</p>
                </div>
                <div className="space-y-3 flex-1">
                  {topCats.map(c => {
                    const up = c.trend > 0;
                    const flat = Math.abs(c.trend) < avgMonthly * 0.05;
                    return (
                      <div key={c.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[c.name] || 'rgba(244,241,234,.2)' }} />
                            <span className="text-mut truncate">{c.name}</span>
                            <span className={`flex items-center ${flat ? 'text-faint' : up ? 'text-coral' : 'text-cyan'}`}>
                              {flat ? <Minus size={12} /> : up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            </span>
                          </span>
                          <span className="tabular-nums text-ink flex-shrink-0 ml-2">
                            {formatSEK(c.value)} <span className="text-faint text-xs">({c.pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(244,241,234,.07)' }}>
                          <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: CATEGORY_COLORS[c.name] || 'rgba(244,241,234,.2)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── Uncategorised spend diagnosis ───────────────────────────────── */}
          {uncategorized.length > 0 && (
            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.16 }}>
              <div className="vh-card p-5">
                <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <h3 className="font-display text-ink text-[15px]">Okategoriserat (Övrigt)</h3>
                    <p className="text-xs text-faint mt-0.5">
                      {formatSEK(uncatTotal)} ({uncatShare.toFixed(0)}% av utgifterna) saknar kategori — störst först. Kategorisera dem i Transaktioner så lär sig appen framåt.
                    </p>
                  </div>
                  <button onClick={() => setPage('transactions')}
                    className="flex items-center gap-1.5 text-xs font-medium text-gold hover:text-gold-2">
                    Till transaktioner <IArrowRight size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {uncategorized.map(u => (
                    <div key={u.merchant} className="flex items-center justify-between gap-3 py-1.5 border-b border-line">
                      <span className="text-sm text-mut truncate" title={u.sample}>{u.merchant}</span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-faint tabular-nums">{u.count}×</span>
                        <span className="text-sm text-ink tabular-nums">{formatSEK(u.total)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Stacked category over time + radar ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.18 }} className="lg:col-span-7 flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Utgifter per kategori över tid</h3>
                  <p className="text-xs text-faint mt-0.5">Staplad fördelning {selectedYear}</p>
                </div>
                <div className="flex-1 flex items-center min-h-0">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={stackedData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: AXIS_FILL }} />
                      {top6Cats.map((cat, i) => (
                        <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat] || 'rgba(244,241,234,.14)'}
                          radius={i === top6Cats.length-1 ? [4,4,0,0] : [0,0,0,0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>

            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.2 }} className="lg:col-span-5 flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Kategorijämförelse</h3>
                  <p className="text-xs text-faint mt-0.5">Senaste 2 månader</p>
                </div>
                <div className="flex-1 flex items-center min-h-0">
                {last2.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke={GRID_STROKE} />
                      <PolarAngleAxis dataKey="cat" tick={{ fontSize: 10, fill: AXIS_FILL }} />
                      <PolarRadiusAxis tick={{ fontSize: 9, fill: AXIS_FILL }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Radar name={formatMonth(last2[0].month)} dataKey={formatMonth(last2[0].month)} stroke="#ff8f7a" fill="#ff8f7a" fillOpacity={0.15} />
                      <Radar name={formatMonth(last2[1].month)} dataKey={formatMonth(last2[1].month)} stroke="#e9c178" fill="#e9c178" fillOpacity={0.15} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: AXIS_FILL }} />
                      <Tooltip formatter={(v: any) => formatSEK(v)} contentStyle={TOOLTIP_STYLE} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center w-full h-[320px] text-sm text-faint">
                    Behöver minst 2 månader av data
                  </div>
                )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── Month change + heatmap ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.22 }} className="lg:col-span-5 flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Månadsförändring</h3>
                  <p className="text-xs text-faint mt-0.5">Utgiftsökning/-minskning vs föregående månad</p>
                </div>
                <div className="flex-1 flex items-center min-h-0">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={momData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={0} stroke="rgba(244,241,234,.15)" />
                      <Bar dataKey="Förändring" radius={[4,4,4,4]}>
                        {momData.map((d, i) => <Cell key={i} fill={d.Förändring >= 0 ? '#ff8f7a' : '#5fe0d0'} />)}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>

            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.25 }} className="lg:col-span-7 flex">
              <div className="vh-card p-5 flex flex-col w-full">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Utgiftsheatmap</h3>
                  <p className="text-xs text-faint mt-0.5">Daglig konsumtion {selectedYear}</p>
                </div>
                <SpendingHeatmap year={selectedYear} />
                <div className="flex items-center gap-2 mt-3 text-[10px] text-faint">
                  <div className="flex gap-1">
                    {[0.05, 0.25, 0.5, 0.75, 1].map(o => (
                      <div key={o} className="w-3 h-3 rounded-sm" style={{ background: `rgba(255, 143, 122, ${o})` }} />
                    ))}
                  </div>
                  <span>Mer utgifter →</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
