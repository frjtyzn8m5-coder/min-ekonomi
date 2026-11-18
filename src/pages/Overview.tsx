import { useStore } from '../store/useStore';
import { getMonthlyData, formatSEK, formatMonth, allMonths } from '../utils/calculations';
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

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ v }));
  return (
    <LineChart width={72} height={28} data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
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
  const { transactions, setPage } = useStore();

  if (!transactions.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-bg text-ink">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="vh-tile vh-tile--gold w-12 h-12 mb-4"><IWallet size={26} /></span>
          <p className="text-sm font-medium text-mut">Inga transaktioner ännu</p>
          <p className="text-xs text-faint mt-1 max-w-xs">Importera dina kontoutdrag för att se din ekonomiska översikt</p>
          <div className="mt-4">
            <button onClick={() => setPage('import')}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-[#2a1d08]"
              style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
              Importera filer <IArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const monthlyData = getMonthlyData(transactions);
  const lastMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];
  const expPct = prevMonth ? ((lastMonth.expenses - prevMonth.expenses) / prevMonth.expenses) * 100 : 0;
  const incPct = prevMonth ? ((lastMonth.income - prevMonth.income) / prevMonth.income) * 100 : 0;

  const last8 = monthlyData.slice(-8);
  const sparkIncome   = last8.map(m => m.income);
  const sparkExpenses = last8.map(m => m.expenses);
  const sparkSavings  = last8.map(m => m.savings);

  const last3Months = allMonths(transactions).slice(-3);
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

  const totalIncome = transactions.filter(t => !t.isTransfer && t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExp    = transactions.filter(t => !t.isTransfer && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const savingsRate = lastMonth?.income > 0
    ? Math.round(((lastMonth.income - lastMonth.expenses) / lastMonth.income) * 100)
    : null;

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 bg-bg text-ink min-h-full">
      <motion.div {...FADE} transition={{ duration: 0.3 }} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Översikt</h1>
          <p className="text-sm text-faint mt-0.5">
            {monthlyData.length} månader · {transactions.filter(t => !t.isTransfer).length} transaktioner
          </p>
        </div>
      </motion.div>

      {/* KPI row */}
      <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total inkomst',
            value: formatSEK(totalIncome),
            color: 'text-cyan',
            sub: null,
            spark: sparkIncome,
            sparkColor: '#5fe0d0',
          },
          {
            label: 'Totala utgifter',
            value: formatSEK(totalExp),
            color: 'text-coral',
            sub: null,
            spark: sparkExpenses,
            sparkColor: '#ff8f7a',
          },
          {
            label: `Inkomst ${lastMonth ? formatMonth(lastMonth.month) : ''}`,
            value: lastMonth ? formatSEK(lastMonth.income) : '—',
            color: 'text-ink',
            sub: incPct !== 0 && prevMonth
              ? <span className={`flex items-center gap-0.5 text-[11px] mt-0.5 ${incPct > 0 ? 'text-cyan' : 'text-coral'}`}>
                  <TrendIcon pct={incPct} />{incPct > 0 ? '+' : ''}{incPct.toFixed(0)}% vs förra
                </span> : null,
            spark: sparkIncome,
            sparkColor: '#5fe0d0',
          },
          {
            label: `Utgifter ${lastMonth ? formatMonth(lastMonth.month) : ''}`,
            value: lastMonth ? formatSEK(lastMonth.expenses) : '—',
            color: 'text-ink',
            sub: expPct !== 0 && prevMonth
              ? <span className={`flex items-center gap-0.5 text-[11px] mt-0.5 ${expPct < 0 ? 'text-cyan' : 'text-coral'}`}>
                  <TrendIcon pct={-expPct} />{expPct > 0 ? '+' : ''}{expPct.toFixed(0)}% vs förra
                </span> : null,
            spark: sparkExpenses,
            sparkColor: '#ff8f7a',
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

      {/* Savings rate banner */}
      {savingsRate !== null && (
        <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.08 }}>
          <div className="rounded-xl px-5 py-3 flex items-center justify-between border"
            style={{
              background: savingsRate >= 20 ? 'rgba(95,224,208,.12)' : savingsRate >= 0 ? 'rgba(233,193,120,.12)' : 'rgba(255,143,122,.12)',
              borderColor: savingsRate >= 20 ? 'rgba(95,224,208,.28)' : savingsRate >= 0 ? 'rgba(233,193,120,.28)' : 'rgba(255,143,122,.28)',
            }}>
            <div>
              <p className="text-xs text-mut">Sparkvot {lastMonth ? formatMonth(lastMonth.month) : ''}</p>
              <p className="font-display text-2xl tabular-nums tracking-tight"
                style={{ color: savingsRate >= 20 ? 'var(--cyan)' : savingsRate >= 0 ? 'var(--gold)' : 'var(--coral)' }}>{savingsRate}%</p>
            </div>
            <p className="text-xs text-faint text-right max-w-[180px] hidden sm:block">
              {savingsRate >= 20 ? 'Bra sparande! Håll i det.' :
               savingsRate >= 10 ? 'Okej — kan förbättras.' :
               savingsRate >= 0  ? 'Låg sparkvot den här månaden.' :
                                   'Utgifter översteg inkomsten.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.1 }} className="lg:col-span-2">
          <div className="vh-card p-5">
            <div className="mb-4">
              <h3 className="font-display text-ink text-[15px]">Inkomster vs Utgifter</h3>
              <p className="text-xs text-faint mt-0.5">Per månad</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData.map(d => ({
                name: formatMonth(d.month), Inkomst: d.income, Utgifter: d.expenses, Sparande: d.savings,
              }))} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: AXIS_FILL }} />
                <Bar dataKey="Inkomst"  fill="#5fe0d0" radius={[4,4,0,0]} />
                <Bar dataKey="Utgifter" fill="#ff8f7a" radius={[4,4,0,0]} />
                <Bar dataKey="Sparande" fill="#e9c178" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.15 }}>
          <div className="vh-card p-5">
            <div className="mb-4">
              <h3 className="font-display text-ink text-[15px]">Utgifter per kategori</h3>
              <p className="text-xs text-faint mt-0.5">Senaste 3 månader</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map(({ name }) => <Cell key={name} fill={CATEGORY_COLORS[name] || 'rgba(244,241,234,.14)'} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatSEK(v)} contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: AXIS_FILL }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Cashflow area chart */}
      <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.2 }}>
        <div className="vh-card p-5">
          <div className="mb-4">
            <h3 className="font-display text-ink text-[15px]">Kassaflöde över tid</h3>
            <p className="text-xs text-faint mt-0.5">Inkomst minus utgifter per månad</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={monthlyData.map(d => ({ name: formatMonth(d.month), Kassaflöde: d.cashflow }))}>
              <defs>
                <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#e9c178" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#e9c178" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: AXIS_FILL }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Kassaflöde" stroke="#e9c178" strokeWidth={2}
                fill="url(#cfGrad)" dot={{ fill: '#e9c178', r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Recent transactions */}
      <motion.div {...FADE} transition={{ duration: 0.3, delay: 0.25 }}>
        <div className="vh-card">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <h3 className="font-display text-ink text-[15px]">Senaste transaktioner</h3>
            <button onClick={() => setPage('transactions')}
              className="text-xs text-gold hover:text-gold flex items-center gap-1">
              Visa alla <IArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-line">
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
  );
}
