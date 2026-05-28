import { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  getMonthlyData, formatSEK, formatMonth, allMonths,
  getSpendingCalendar, getCategoryTotals
} from '../utils/calculations';
import { CATEGORY_COLORS, EXPENSE_CATEGORIES } from '../utils/categorize';
import { Card, CardHeader, EmptyState } from '../components/ui/Card';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Treemap, ComposedChart,
  ReferenceLine, Cell, PieChart, Pie, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { Upload, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const FADE = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {formatSEK(p.value)}</p>
      ))}
    </div>
  );
};

// Spending heatmap calendar
function SpendingHeatmap({ year }: { year: number }) {
  const { transactions } = useStore();
  const cal = getSpendingCalendar(transactions, year);
  const values = Object.values(cal);
  const maxVal = Math.max(...values, 1);

  // Generate all weeks for the year
  const weeks: Array<Array<{ date: string; val: number } | null>> = [];
  const firstDay = new Date(year, 0, 1);
  const startOffset = firstDay.getDay(); // 0=Sun
  let week: Array<{ date: string; val: number } | null> = [];

  // Pad start
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

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

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
              <div
                key={di}
                title={day ? `${day.date}: ${formatSEK(day.val)}` : ''}
                className="w-3 h-3 rounded-sm"
                style={{
                  background: day ? `rgba(255, 59, 48, ${opacity(day.val)})` : 'transparent',
                  cursor: day ? 'pointer' : 'default',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-gray-400">
        {months.map(m => <span key={m}>{m}</span>)}
      </div>
    </div>
  );
}

// Custom Treemap content
function TreemapCell({ x, y, width, height, name, value }: any) {
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2}
        fill={CATEGORY_COLORS[name] || '#e5e7eb'} opacity={0.85} rx={4} />
      {width > 50 && height > 30 && (
        <>
          <text x={x + 8} y={y + 18} fill="white" fontSize={10} fontWeight={600}>{name}</text>
          {height > 42 && (
            <text x={x + 8} y={y + 30} fill="white" fontSize={9} opacity={0.8}>{formatSEK(value)}</text>
          )}
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
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState
          icon={<Upload size={48} />}
          title="Inga transaktioner"
          description="Importera kontoutdrag för att se analyser"
          action={
            <button onClick={() => setPage('import')}
              className="bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg">
              Importera
            </button>
          }
        />
      </div>
    );
  }

  const monthlyData = getMonthlyData(transactions);
  const years = [...new Set(transactions.map(t => t.date.slice(0, 4)).map(Number))].sort();

  // Category totals for treemap
  const catTotals = getCategoryTotals(transactions);
  const treemapData = EXPENSE_CATEGORIES
    .filter(c => catTotals[c] > 0)
    .map(c => ({ name: c, value: catTotals[c] }))
    .sort((a, b) => b.value - a.value);

  // Monthly category stacked data (top 6 cats)
  const top6Cats = treemapData.slice(0, 6).map(d => d.name);
  const stackedData = monthlyData.map(m => {
    const row: any = { name: formatMonth(m.month) };
    top6Cats.forEach(c => { row[c] = m.byCategory[c] || 0; });
    return row;
  });

  // Waterfall: for last month
  const lastMonth = monthlyData[monthlyData.length - 1];
  const waterfallData = lastMonth ? [
    { name: 'Inkomst', value: lastMonth.income, fill: '#34c759', start: 0 },
    ...EXPENSE_CATEGORIES
      .filter(c => (lastMonth.byCategory[c] || 0) > 0)
      .sort((a, b) => (lastMonth.byCategory[b] || 0) - (lastMonth.byCategory[a] || 0))
      .slice(0, 7)
      .map((c, i, arr) => {
        const prev = arr.slice(0, i).reduce((s, x) => s + (lastMonth.byCategory[x] || 0), 0);
        return { name: c, value: lastMonth.byCategory[c] || 0, fill: CATEGORY_COLORS[c] || '#e5e7eb', start: lastMonth.income - prev };
      }),
  ] : [];

  // Month-over-month comparison (last 6 months)
  const last6 = monthlyData.slice(-6);
  const momData = last6.map((m, i) => {
    const prev = monthlyData[monthlyData.length - 6 + i - 1];
    return {
      name: formatMonth(m.month),
      Utgifter: m.expenses,
      Förändring: prev ? m.expenses - prev.expenses : 0,
    };
  });

  // Radar: category spending comparison last 2 months
  const last2 = monthlyData.slice(-2);
  const radarData = top6Cats.map(cat => ({
    cat,
    [last2[0] ? formatMonth(last2[0].month) : 'Föregående']: last2[0]?.byCategory[cat] || 0,
    [last2[1] ? formatMonth(last2[1].month) : 'Nuvarande']: last2[1]?.byCategory[cat] || 0,
  }));

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Analys</h1>
          <p className="text-sm text-gray-400 mt-0.5">Visualisera dina utgiftsmönster</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`px-3 py-2 font-medium ${selectedYear === y ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Spending heatmap */}
        <motion.div {...FADE} transition={{ duration: 0.3 }}>
          <Card>
            <CardHeader title="Utgiftsheatmap" subtitle={`Daglig konsumtion ${selectedYear}`} />
            <SpendingHeatmap year={selectedYear} />
            <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-400">
              <div className="flex gap-1">
                {[0.05, 0.25, 0.5, 0.75, 1].map(o => (
                  <div key={o} className="w-3 h-3 rounded-sm" style={{ background: `rgba(255, 59, 48, ${o})` }} />
                ))}
              </div>
              <span>Mer utgifter →</span>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
          {/* Treemap */}
          <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.05 }}>
            <Card>
              <CardHeader title="Utgiftsfördelning" subtitle="Totalt alla månader" />
              <ResponsiveContainer width="100%" height={240}>
                <Treemap data={treemapData} dataKey="value" aspectRatio={4 / 3} content={<TreemapCell />}>
                  <Tooltip formatter={(v: any, n: any) => [formatSEK(v), n]} contentStyle={{ borderRadius: 12, fontSize: 11 }} />
                </Treemap>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          {/* Category radar */}
          <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card>
              <CardHeader title="Kategori jämförelse" subtitle="Senaste 2 månader" />
              {last2.length >= 2 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#f0f0f0" />
                    <PolarAngleAxis dataKey="cat" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <PolarRadiusAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Radar name={formatMonth(last2[0].month)} dataKey={formatMonth(last2[0].month)}
                      stroke="#ff3b30" fill="#ff3b30" fillOpacity={0.15} />
                    <Radar name={formatMonth(last2[1].month)} dataKey={formatMonth(last2[1].month)}
                      stroke="#007aff" fill="#007aff" fillOpacity={0.15} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => formatSEK(v)} contentStyle={{ borderRadius: 12, fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-240 flex items-center justify-center text-sm text-gray-400 py-16">
                  Behöver minst 2 månader av data
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Stacked categories over time */}
        <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.15 }}>
          <Card>
            <CardHeader title="Utgifter per kategori" subtitle="Staplad fördelning per månad" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stackedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                {top6Cats.map((cat, i) => (
                  <Bar key={cat} dataKey={cat} stackId="a"
                    fill={CATEGORY_COLORS[cat] || '#e5e7eb'}
                    radius={i === top6Cats.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Month over month change */}
        <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card>
            <CardHeader title="Månadsförändring" subtitle="Utgiftsökning/-minskning vs föregående månad" />
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={momData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#e5e7eb" />
                <Bar dataKey="Förändring" radius={[4, 4, 4, 4]}>
                  {momData.map((d, i) => (
                    <Cell key={i} fill={d.Förändring >= 0 ? '#ff3b30' : '#34c759'} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
