import { useStore } from '../store/useStore';
import { getMonthlyData, formatSEK, formatMonth, allMonths } from '../utils/calculations';
import { CATEGORY_COLORS, EXPENSE_CATEGORIES } from '../utils/categorize';
import { Card, CardHeader, Stat, EmptyState } from '../components/ui/Card';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Upload, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const FADE = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

function TrendIcon({ pct }: { pct: number }) {
  if (pct > 5) return <TrendingUp size={14} className="text-green-500" />;
  if (pct < -5) return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatSEK(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Overview() {
  const { transactions, setPage } = useStore();

  if (!transactions.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={<Upload size={48} />}
          title="Inga transaktioner ännu"
          description="Importera dina kontoutdrag för att se din ekonomiska översikt"
          action={
            <button
              onClick={() => setPage('import')}
              className="flex items-center gap-2 bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Importera filer <ArrowRight size={14} />
            </button>
          }
        />
      </div>
    );
  }

  const monthlyData = getMonthlyData(transactions);
  const lastMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];
  const expPct = prevMonth ? ((lastMonth.expenses - prevMonth.expenses) / prevMonth.expenses) * 100 : 0;
  const incPct = prevMonth ? ((lastMonth.income - prevMonth.income) / prevMonth.income) * 100 : 0;

  const last3Months = allMonths(transactions).slice(-3);
  const catTotals: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.isTransfer || tx.amount >= 0) continue;
    if (!last3Months.includes(tx.date.slice(0, 7))) continue;
    catTotals[tx.category] = (catTotals[tx.category] || 0) + Math.abs(tx.amount);
  }
  const pieData = Object.entries(catTotals)
    .filter(([cat]) => EXPENSE_CATEGORIES.includes(cat as any))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, val]) => ({ name: cat, value: val }));

  const recentTxs = [...transactions]
    .filter(t => !t.isTransfer)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const totalIncome = transactions.filter(t => !t.isTransfer && t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExp = transactions.filter(t => !t.isTransfer && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const avgMonthly = monthlyData.length > 0 ? totalExp / monthlyData.length : 0;

  return (
    <div className="p-6 space-y-6">
      <motion.div {...FADE} transition={{ duration: 0.3 }}>
        <h1 className="text-xl font-semibold text-gray-900">Översikt</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {monthlyData.length} månader • {transactions.filter(t => !t.isTransfer).length} transaktioner
        </p>
      </motion.div>

      {/* KPI row */}
      <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total inkomst', value: formatSEK(totalIncome), color: 'text-green-600' },
          { label: 'Totala utgifter', value: formatSEK(totalExp), color: 'text-red-500' },
          { label: `Inkomst ${lastMonth ? formatMonth(lastMonth.month) : ''}`, value: lastMonth ? formatSEK(lastMonth.income) : '—', color: 'text-gray-900' },
          { label: `Utgifter ${lastMonth ? formatMonth(lastMonth.month) : ''}`, value: lastMonth ? formatSEK(lastMonth.expenses) : '—', color: 'text-gray-900' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <Stat label={label} value={value} color={color} />
          </Card>
        ))}
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Income vs Expenses bar chart */}
        <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.1 }} className="col-span-2">
          <Card>
            <CardHeader title="Inkomster vs Utgifter" subtitle="Per månad" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData.map(d => ({
                name: formatMonth(d.month),
                Inkomst: d.income,
                Utgifter: d.expenses,
                Sparande: d.savings,
              }))} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Inkomst" fill="#34c759" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Utgifter" fill="#ff3b30" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Sparande" fill="#007aff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Spending donut */}
        <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.15 }}>
          <Card>
            <CardHeader title="Utgifter per kategori" subtitle="Senaste 3 månader" />
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {pieData.map(({ name }) => (
                    <Cell key={name} fill={CATEGORY_COLORS[name] || '#e5e7eb'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatSEK(v)} contentStyle={{ borderRadius: 12, fontSize: 11 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* Net cashflow area chart */}
      <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.2 }}>
        <Card>
          <CardHeader title="Kassaflöde över tid" subtitle="Inkomst minus utgifter per månad" />
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={monthlyData.map(d => ({
              name: formatMonth(d.month),
              Kassaflöde: d.cashflow,
            }))}>
              <defs>
                <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#007aff" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#007aff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Kassaflöde" stroke="#007aff" strokeWidth={2}
                fill="url(#cfGrad)" dot={{ fill: '#007aff', r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* Recent transactions */}
      <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.25 }}>
        <Card padding={false}>
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Senaste transaktioner</h3>
            </div>
            <button
              onClick={() => setPage('transactions')}
              className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              Visa alla <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentTxs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ background: (CATEGORY_COLORS[tx.category] || '#e5e7eb') + '25', color: CATEGORY_COLORS[tx.category] || '#6b7280' }}>
                    {tx.description.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate max-w-64">{tx.description}</p>
                    <p className="text-xs text-gray-400">{tx.date} · {tx.category}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-gray-800'}`}>
                  {tx.amount >= 0 ? '+' : ''}{formatSEK(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
