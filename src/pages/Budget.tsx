import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { saveBudgets } from '../lib/db';
import { getMonthlyData, formatSEK, formatMonth, allMonths } from '../utils/calculations';
import { EXPENSE_CATEGORIES, CATEGORY_COLORS } from '../utils/categorize';
import { Card, CardHeader, EmptyState } from '../components/ui/Card';
import { Upload, Edit2, Check, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell } from 'recharts';
import type { Category } from '../types';

function SparkBar({ data, limit }: { data: number[]; limit: number }) {
  if (data.length === 0) return null;
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => {
        const pct = limit > 0 ? (v / limit) : 0;
        const over = pct > 1;
        return (
          <div key={i} className="flex-1 rounded-sm"
            style={{
              height: `${Math.min(pct * 100, 100)}%`,
              minHeight: v > 0 ? 2 : 0,
              background: over ? '#ff3b30' : pct > 0.8 ? '#ff9f0a' : CATEGORY_COLORS[String(i)] || '#34c759',
              opacity: i === data.length - 1 ? 1 : 0.5,
            }} />
        );
      })}
    </div>
  );
}

export default function Budget() {
  const { transactions, budgets, updateBudget, setPage } = useStore();
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [showTrend, setShowTrend] = useState<string | null>(null);

  const months = allMonths(transactions);
  const [selectedMonth, setSelectedMonth] = useState(months[months.length - 1] || '');

  if (!transactions.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState icon={<Upload size={48} />} title="Inga transaktioner"
          description="Importera kontoutdrag för att se budget"
          action={<button onClick={() => setPage('import')} className="bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Importera</button>} />
      </div>
    );
  }

  const allMonthlyData = getMonthlyData(transactions);
  const monthData = allMonthlyData.find(m => m.month === selectedMonth);
  const last6Months = allMonthlyData.slice(-6);

  const rows = EXPENSE_CATEGORIES.map(cat => {
    const budget = budgets.find(b => b.category === cat);
    const actual = monthData?.byCategory[cat] || 0;
    const limit = budget?.limit || 0;
    const pct = limit > 0 ? (actual / limit) * 100 : 0;
    const over = limit > 0 && actual > limit;
    const trend = last6Months.map(m => m.byCategory[cat] || 0);
    return { cat, actual, limit, pct, over, trend };
  }).filter(r => r.actual > 0 || r.limit > 0);

  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalBudget = rows.reduce((s, r) => s + r.limit, 0);
  const totalPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  const startEdit = (cat: string, current: number) => { setEditCat(cat); setEditVal(String(current)); };
  const saveEdit = (cat: string) => {
    const val = parseInt(editVal);
    if (!isNaN(val) && val >= 0) updateBudget(cat as Category, val);
    setEditCat(null);
  };

  // Trend chart data for selected category
  const trendData = showTrend
    ? last6Months.map(m => ({
        name: formatMonth(m.month),
        Faktisk: m.byCategory[showTrend] || 0,
        Budget: budgets.find(b => b.category === showTrend)?.limit || 0,
      }))
    : [];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-4 lg:px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Budget</h1>
          <p className="text-sm text-gray-400 mt-0.5">Sätt gränser och spåra dina utgifter</p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {months.slice(-6).map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${selectedMonth === m ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {formatMonth(m)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-4">
        {/* Total */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400">Total budget {formatMonth(selectedMonth)}</p>
                <p className="text-2xl font-semibold tracking-tight text-gray-900">
                  {formatSEK(totalActual)}
                  <span className="text-base font-normal text-gray-400"> / {formatSEK(totalBudget)}</span>
                </p>
              </div>
              <div className={`text-lg font-bold ${totalPct > 100 ? 'text-red-500' : totalPct > 80 ? 'text-yellow-500' : 'text-green-500'}`}>
                {totalPct.toFixed(0)}%
              </div>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${totalPct > 100 ? 'bg-red-500' : totalPct > 80 ? 'bg-yellow-400' : 'bg-green-500'}`}
                style={{ width: `${Math.min(totalPct, 100)}%` }} />
            </div>
          </Card>
        </motion.div>

        {/* Category rows */}
        <Card padding={false}>
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Per kategori</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {rows.map(({ cat, actual, limit, pct, over, trend }, i) => (
              <motion.div key={cat}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="px-5 py-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[cat] || '#e5e7eb' }} />
                    <span className="text-sm font-medium text-gray-800">{cat}</span>
                    {over && <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">Över budget</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Trend sparkline */}
                    <button onClick={() => setShowTrend(showTrend === cat ? null : cat)}
                      className={`p-1 rounded ${showTrend === cat ? 'text-blue-500 bg-blue-50' : 'text-gray-300 hover:text-gray-500'}`}>
                      <TrendingUp size={13} />
                    </button>
                    <span className={`text-sm font-semibold ${over ? 'text-red-500' : 'text-gray-700'}`}>{formatSEK(actual)}</span>
                    <span className="text-xs text-gray-400">/</span>
                    {editCat === cat ? (
                      <div className="flex items-center gap-1">
                        <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEdit(cat)}
                          className="w-20 text-xs border border-blue-300 rounded px-2 py-1 outline-none" autoFocus />
                        <button onClick={() => saveEdit(cat)} className="text-blue-500 hover:text-blue-600"><Check size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(cat, limit)}
                        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        {limit > 0 ? formatSEK(limit) : 'Sätt budget'}
                        <Edit2 size={10} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct > 80 ? 'bg-yellow-400' : 'bg-green-400'}`}
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: over ? undefined : CATEGORY_COLORS[cat] + 'aa' }} />
                </div>

                {limit > 0 && (
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-400">{pct.toFixed(0)}% använt</span>
                    <span className={`text-[10px] font-medium ${over ? 'text-red-500' : 'text-gray-400'}`}>
                      {over ? `+${formatSEK(actual - limit)} över` : `${formatSEK(limit - actual)} kvar`}
                    </span>
                  </div>
                )}

                {/* 6-month trend */}
                {showTrend === cat && trendData.length > 1 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3">
                    <p className="text-[11px] text-gray-400 mb-2">6-månadershistorik</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <BarChart data={trendData} barGap={2}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={30} />
                        <Tooltip formatter={(v: any) => formatSEK(v)} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                        {limit > 0 && <ReferenceLine y={limit} stroke="#ef4444" strokeDasharray="3 3" />}
                        <Bar dataKey="Faktisk" radius={[3,3,0,0]}>
                          {trendData.map((d, idx) => (
                            <Cell key={idx} fill={d.Faktisk > d.Budget && d.Budget > 0 ? '#ff3b30' : CATEGORY_COLORS[cat] || '#34c759'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
