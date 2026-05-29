import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { saveBudgets } from '../lib/db';
import { getMonthlyData, formatSEK, formatMonth, allMonths } from '../utils/calculations';
import { EXPENSE_CATEGORIES, CATEGORY_COLORS } from '../utils/categorize';
import { Card, EmptyState } from '../components/ui/Card';
import { Upload, Edit2, Check, TrendingUp, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell } from 'recharts';
import type { Category, Transaction } from '../types';

// ── Income / fixed-cost detection ─────────────────────────────────────────────

function detectIncomeSources(txs: Transaction[]) {
  const monthly = getMonthlyData(txs);
  const last3 = monthly.slice(-3);
  if (!last3.length) return { lön: 0, csnBidrag: 0, csnLån: 0, boende: 0, telefon: 0 };
  const avg = (key: string) =>
    Math.round(last3.reduce((s, m) => s + (m.byCategory[key] || 0), 0) / last3.length);
  return {
    lön:       avg('Lön'),
    csnBidrag: avg('CSN Bidrag'),
    csnLån:    avg('CSN Lån'),
    boende:    avg('Boende'),
    telefon:   avg('Telefon'),
  };
}

// ── Budget style allocations (% of disposable income after housing+phone) ────

type BudgetStyle = 'student' | 'sparsam' | 'balanserad' | 'generös';

const STYLE_INFO: Record<BudgetStyle, { label: string; emoji: string; desc: string }> = {
  student:    { label: 'Student',    emoji: '🎓', desc: 'Fokus på mat och transport, högt sparande (~42%).' },
  sparsam:    { label: 'Sparsam',    emoji: '💰', desc: 'Disciplinerat med lite mer utrymme, sparar ~36%.' },
  balanserad: { label: 'Balanserad', emoji: '⚖️', desc: 'Bra balans mellan nöjen och sparande (~28%).' },
  generös:    { label: 'Generös',    emoji: '✨', desc: 'Mer utrymme för resor och nöjen, sparar ~16%.' },
};

const STYLE_ALLOC: Record<BudgetStyle, Partial<Record<Category, number>>> = {
  student: {
    Mat: 0.20, Restaurang: 0.06, Transport: 0.06, Hälsa: 0.04,
    Kläder: 0.04, Aktiviteter: 0.06, Handel: 0.04, Resor: 0.02,
    Streaming: 0.02, 'Övrigt Utgift': 0.03,
  },
  sparsam: {
    Mat: 0.17, Restaurang: 0.08, Transport: 0.08, Hälsa: 0.04,
    Kläder: 0.05, Aktiviteter: 0.06, Handel: 0.05, Resor: 0.03,
    Streaming: 0.02, 'Övrigt Utgift': 0.04,
  },
  balanserad: {
    Mat: 0.15, Restaurang: 0.10, Transport: 0.09, Hälsa: 0.04,
    Kläder: 0.06, Aktiviteter: 0.08, Handel: 0.07, Resor: 0.06,
    Streaming: 0.02, 'Övrigt Utgift': 0.05,
  },
  generös: {
    Mat: 0.13, Restaurang: 0.12, Transport: 0.10, Hälsa: 0.04,
    Kläder: 0.08, Aktiviteter: 0.10, Handel: 0.09, Resor: 0.10,
    Streaming: 0.02, 'Övrigt Utgift': 0.05,
  },
};

function generateBudget(income: number, boende: number, telefon: number, style: BudgetStyle): Partial<Record<Category, number>> {
  const disposable = Math.max(income - boende - telefon, 0);
  const alloc = STYLE_ALLOC[style];
  const result: Partial<Record<Category, number>> = { Boende: boende, Telefon: telefon };
  for (const [cat, pct] of Object.entries(alloc) as [Category, number][]) {
    result[cat] = Math.round(disposable * pct / 100) * 100;
  }
  return result;
}

// ── Snabbstart quiz modal ──────────────────────────────────────────────────────

function BudgetQuiz({ transactions, budgets, updateBudget, onClose, user }: {
  transactions: Transaction[];
  budgets: { category: string; limit: number }[];
  updateBudget: (cat: Category, limit: number) => void;
  onClose: () => void;
  user: any;
}) {
  const detected = useMemo(() => detectIncomeSources(transactions), [transactions]);
  const totalDet = detected.lön + detected.csnBidrag + detected.csnLån;

  const [income,  setIncome]  = useState(totalDet || 25000);
  const [boende,  setBoende]  = useState(detected.boende  || 6000);
  const [telefon, setTelefon] = useState(detected.telefon || 300);
  const [style,   setStyle]   = useState<BudgetStyle>('balanserad');
  const [applying, setApplying] = useState(false);

  const suggested = useMemo(
    () => generateBudget(income, boende, telefon, style),
    [income, boende, telefon, style],
  );
  const totalSuggested = (Object.values(suggested) as number[]).reduce((s, v) => s + v, 0);
  const savings    = income - totalSuggested;
  const savingsPct = income > 0 ? (savings / income) * 100 : 0;

  const handleApply = async () => {
    setApplying(true);
    for (const [cat, val] of Object.entries(suggested)) {
      if (EXPENSE_CATEGORIES.includes(cat as Category)) updateBudget(cat as Category, val as number);
    }
    if (user) {
      const newBudgets = EXPENSE_CATEGORIES.map(cat => ({
        category: cat,
        limit: (suggested[cat] as number | undefined) ?? budgets.find(b => b.category === cat)?.limit ?? 0,
      }));
      await saveBudgets(user.uid, newBudgets).catch(() => {});
    }
    setApplying(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900">Snabbstart budget</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">

          {/* Monthly income */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-2">
              Månadsinkomst efter skatt
            </label>
            {totalDet > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {detected.lön > 0 && (
                  <span className="text-[11px] bg-green-50 text-green-700 rounded-full px-2 py-0.5">
                    Lön ~{formatSEK(detected.lön)}
                  </span>
                )}
                {detected.csnBidrag > 0 && (
                  <span className="text-[11px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">
                    CSN Bidrag ~{formatSEK(detected.csnBidrag)}
                  </span>
                )}
                {detected.csnLån > 0 && (
                  <span className="text-[11px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">
                    CSN Lån ~{formatSEK(detected.csnLån)}
                  </span>
                )}
                <span className="text-[11px] text-gray-400 self-center">→ totalt ~{formatSEK(totalDet)}</span>
              </div>
            )}
            <div className="relative">
              <input
                type="number"
                value={income}
                onChange={e => setIncome(Math.max(0, Number(e.target.value)))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-300 pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kr/mån</span>
            </div>
          </div>

          {/* Fixed costs */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-2">
              Fasta kostnader <span className="font-normal text-gray-400">(dras av före fördelning)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-gray-500 mb-1">
                  Boende{detected.boende > 0 ? ` (hittade ~${formatSEK(detected.boende)})` : ''}
                </p>
                <div className="relative">
                  <input
                    type="number"
                    value={boende}
                    onChange={e => setBoende(Math.max(0, Number(e.target.value)))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-300 pr-8"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">kr</span>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 mb-1">
                  Telefon & internet{detected.telefon > 0 ? ` (hittade ~${formatSEK(detected.telefon)})` : ''}
                </p>
                <div className="relative">
                  <input
                    type="number"
                    value={telefon}
                    onChange={e => setTelefon(Math.max(0, Number(e.target.value)))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-300 pr-8"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">kr</span>
                </div>
              </div>
            </div>
          </div>

          {/* Style selector */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-2">Budget-stil</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(STYLE_INFO) as [BudgetStyle, typeof STYLE_INFO[BudgetStyle]][]).map(([s, info]) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-3 py-2.5 rounded-xl text-left transition-colors border ${
                    style === s
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-gray-50 border-transparent text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-xs font-semibold mb-0.5">{info.emoji} {info.label}</div>
                  <div className="text-[10px] text-gray-500 leading-tight">{info.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Suggested breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">Föreslaget per kategori</span>
              <span className={`text-xs font-semibold ${savings >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                Sparande: {formatSEK(savings)} ({savingsPct.toFixed(0)}%)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {EXPENSE_CATEGORIES.map(cat => {
                const val = (suggested[cat as Category] ?? 0) as number;
                if (val === 0) return null;
                return (
                  <div key={cat} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[cat] || '#e5e7eb' }} />
                      <span className="text-gray-600 truncate">{cat}</span>
                    </span>
                    <span className="font-semibold text-gray-800 ml-2 flex-shrink-0">{formatSEK(val)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Apply button */}
        <div className="px-5 pb-5">
          <button
            onClick={handleApply}
            disabled={applying}
            className="w-full py-3 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-60 transition-colors"
          >
            {applying ? 'Tillämpar…' : 'Tillämpa budget'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Sparkbar ──────────────────────────────────────────────────────────────────

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

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Budget() {
  const { transactions, budgets, updateBudget, setPage } = useStore();
  const { user } = useAuthStore();
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [showTrend, setShowTrend] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

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

  const trendData = showTrend
    ? last6Months.map(m => ({
        name: formatMonth(m.month),
        Faktisk: m.byCategory[showTrend] || 0,
        Budget: budgets.find(b => b.category === showTrend)?.limit || 0,
      }))
    : [];

  return (
    <>
      <AnimatePresence>
        {showQuiz && (
          <BudgetQuiz
            transactions={transactions}
            budgets={budgets}
            updateBudget={updateBudget}
            onClose={() => setShowQuiz(false)}
            user={user}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col h-full overflow-auto">
        <div className="px-4 lg:px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Budget</h1>
            <p className="text-sm text-gray-400 mt-0.5">Sätt gränser och spåra dina utgifter</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => setShowQuiz(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Sparkles size={12} /> Snabbstart
            </button>
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
                    <span className="text-base font-normal text-gray-400"> / {totalBudget > 0 ? formatSEK(totalBudget) : <span className="text-gray-300">ej satt</span>}</span>
                  </p>
                </div>
                {totalBudget > 0 && (
                  <div className={`text-lg font-bold ${totalPct > 100 ? 'text-red-500' : totalPct > 80 ? 'text-yellow-500' : 'text-green-500'}`}>
                    {totalPct.toFixed(0)}%
                  </div>
                )}
              </div>
              {totalBudget > 0 && (
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${totalPct > 100 ? 'bg-red-500' : totalPct > 80 ? 'bg-yellow-400' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(totalPct, 100)}%` }} />
                </div>
              )}
              {totalBudget === 0 && (
                <p className="text-xs text-gray-400">
                  Ingen budget satt ännu —{' '}
                  <button onClick={() => setShowQuiz(true)} className="text-blue-500 hover:underline">
                    använd Snabbstart
                  </button>{' '}
                  för att sätta upp en budget på sekunder.
                </p>
              )}
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

                  {limit > 0 && (
                    <>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct > 80 ? 'bg-yellow-400' : 'bg-green-400'}`}
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: over ? undefined : CATEGORY_COLORS[cat] + 'aa' }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-400">{pct.toFixed(0)}% använt</span>
                        <span className={`text-[10px] font-medium ${over ? 'text-red-500' : 'text-gray-400'}`}>
                          {over ? `+${formatSEK(actual - limit)} över` : `${formatSEK(limit - actual)} kvar`}
                        </span>
                      </div>
                    </>
                  )}

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
    </>
  );
}
