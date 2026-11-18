import { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  getMonthlyData, formatSEK, formatMonth,
  getSpendingCalendar, getCategoryTotals
} from '../utils/calculations';
import { CATEGORY_COLORS, EXPENSE_CATEGORIES } from '../utils/categorize';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Treemap, ComposedChart,
  ReferenceLine, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import { ITrend, IArrowRight } from '../components/ui/Icons';
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

  return (
    <div className="relative min-h-full bg-bg text-ink overflow-hidden">
      <div className="vh-aurora" />
      <div className="relative z-10 px-4 sm:px-6 lg:px-10 py-6">
      <header className="mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Ekonomi</p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink mt-2 leading-none">Analys</h1>
          <p className="text-sm text-faint mt-2">Visualisera dina utgiftsmönster</p>
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
          <motion.div {...FADE} transition={{ duration: 0.3 }}>
            <div className="vh-card p-5">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.05 }}>
              <div className="vh-card p-5">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Utgiftsfördelning</h3>
                  <p className="text-xs text-faint mt-0.5">Totalt {selectedYear}</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <Treemap data={treemapData} dataKey="value" aspectRatio={4/3} content={<TreemapCell />}>
                    <Tooltip formatter={(v: any, n: any) => [formatSEK(v), n]} contentStyle={TOOLTIP_STYLE} />
                  </Treemap>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.1 }}>
              <div className="vh-card p-5">
                <div className="mb-4">
                  <h3 className="font-display text-ink text-[15px]">Kategori jämförelse</h3>
                  <p className="text-xs text-faint mt-0.5">Senaste 2 månader</p>
                </div>
                {last2.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={300}>
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
                  <div className="flex items-center justify-center h-[300px] text-sm text-faint">
                    Behöver minst 2 månader av data
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
          <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.15 }} className="lg:col-span-7 flex">
            <div className="vh-card p-5 flex flex-col w-full">
              <div className="mb-4">
                <h3 className="font-display text-ink text-[15px]">Utgifter per kategori</h3>
                <p className="text-xs text-faint mt-0.5">Staplad fördelning {selectedYear}</p>
              </div>
              <div className="flex-1 flex items-center min-h-0">
              <ResponsiveContainer width="100%" height={280}>
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
                <h3 className="font-display text-ink text-[15px]">Månadsförändring</h3>
                <p className="text-xs text-faint mt-0.5">Utgiftsökning/-minskning vs föregående månad</p>
              </div>
              <div className="flex-1 flex items-center min-h-0">
              <ResponsiveContainer width="100%" height={280}>
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
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
