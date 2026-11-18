import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { saveAsset, saveDebt } from '../lib/db';
import { formatSEK, formatMonth } from '../utils/calculations';
import { latestPortfolioValueSEK } from '../utils/portfolio';
import { Card, CardHeader, EmptyState } from '../components/ui/Card';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart, Line, Legend
} from 'recharts';
import { Plus, TrendingUp, TrendingDown, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AssetSnapshot, DebtSnapshot } from '../types';
import PageBanner from '../components/ui/PageBanner';

const FADE = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl shadow-lg p-3 text-xs" style={{ background: '#15151b', border: '1px solid rgba(244,241,234,.09)', color: '#f4f1ea' }}>
      <p className="font-semibold mb-2" style={{ color: '#f4f1ea' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {formatSEK(p.value)}</p>
      ))}
    </div>
  );
};

interface SnapshotFormProps {
  month: string;
  type: 'asset' | 'debt';
  existing?: AssetSnapshot | DebtSnapshot;
  /** Live portfolio value in SEK — prefilled into the Avanza/investment field for new asset snapshots. */
  portfolioValue?: number;
  onSave: (data: any) => void;
  onCancel: () => void;
}

function SnapshotForm({ month, type, existing, portfolioValue, onSave, onCancel }: SnapshotFormProps) {
  const isAsset = type === 'asset';
  const fields = isAsset
    ? [
        { key: 'cash',      label: 'Kontanter / bank' },
        { key: 'avanza',    label: 'Avanza ISK/aktier' },
        { key: 'crypto',    label: 'Krypto' },
        { key: 'sparkonto', label: 'Sparkonto' },
        { key: 'other',     label: 'Övrigt' },
      ]
    : [
        { key: 'csn',    label: 'CSN Studielån' },
        { key: 'klarna', label: 'Klarna / kortkredit' },
        { key: 'other',  label: 'Övrigt' },
      ];

  const hasPortfolioValue = portfolioValue != null && portfolioValue > 0;
  const init: any = existing || { month };
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => {
      // Prefill the investment field from the live portfolio for a NEW asset snapshot.
      if (isAsset && f.key === 'avanza' && !existing && hasPortfolioValue) {
        return [f.key, String(Math.round(portfolioValue as number))];
      }
      return [f.key, String((init as any)[f.key] || 0)];
    }))
  );
  const [mon, setMon] = useState(existing?.month || month);

  return (
    <div className="bg-soft rounded-xl p-4 space-y-3">
      <div>
        <label className="text-xs text-mut block mb-1">Månad (ÅÅÅÅ-MM)</label>
        <input type="month" value={mon} onChange={e => setMon(e.target.value)}
          className="w-full text-sm bg-card text-ink border border-line rounded-lg px-3 py-2 outline-none focus:border-gold/50" />
      </div>
      {fields.map(f => {
        const isAvanza = isAsset && f.key === 'avanza';
        return (
          <div key={f.key}>
            <label className="text-xs text-mut flex items-center gap-1.5 mb-1">
              {f.label}
              {isAvanza && hasPortfolioValue && (
                <span className="text-gold">· från portföljen ({formatSEK(portfolioValue as number)})</span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input type="number" value={vals[f.key]}
                onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                className="w-full text-sm bg-card text-ink border border-line rounded-lg px-3 py-2 outline-none focus:border-gold/50"
                placeholder="0" />
              {isAvanza && hasPortfolioValue && (
                <button type="button"
                  onClick={() => setVals(v => ({ ...v, avanza: String(Math.round(portfolioValue as number)) }))}
                  title="Fyll i värdet från portföljen"
                  className="flex-shrink-0 text-xs text-gold hover:text-gold-2 px-2 py-2 whitespace-nowrap">
                  Synka
                </button>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({ month: mon, ...Object.fromEntries(fields.map(f => [f.key, parseFloat(vals[f.key]) || 0])) })}
          className="flex items-center gap-1.5 text-[#2a1d08] text-sm font-medium px-4 py-2 rounded-lg"
          style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
          <Check size={14} /> Spara
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-mut text-sm px-3 py-2 rounded-lg hover:bg-card">
          <X size={14} /> Avbryt
        </button>
      </div>
    </div>
  );
}

export default function NetWorth() {
  const {
    assets, debts, addAssetSnapshot, addDebtSnapshot,
    holdings, priceCache, tickerMappings, portfolioSnapshots,
  } = useStore();
  const { user } = useAuthStore();

  // Live investment value in SEK, auto-derived from the real portfolio
  // (prefers the FX-correct persisted snapshot, falls back to holdings × prices).
  const livePortfolioSEK = latestPortfolioValueSEK(portfolioSnapshots, holdings, priceCache, tickerMappings);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [csnMonthlyRate, setCsnMonthlyRate] = useState(8500);
  const [editingCsnRate, setEditingCsnRate] = useState(false);
  const [csnRateInput, setCsnRateInput] = useState('8500');

  const months = [...new Set([...assets.map(a => a.month), ...debts.map(d => d.month)])].sort();

  const timeline = months.map(m => {
    const a = assets.find(x => x.month === m);
    const d = debts.find(x => x.month === m);
    const totalAssets = a ? (a.cash + a.avanza + a.crypto + a.sparkonto + a.other) : 0;
    const totalDebts  = d ? (d.csn + d.klarna + d.other) : 0;
    return {
      name: formatMonth(m),
      Tillgångar: totalAssets,
      Skulder: totalDebts,
      Nettovärde: totalAssets - totalDebts,
    };
  });

  // Asset breakdown over time
  const assetBreakdown = assets.map(a => ({
    name: formatMonth(a.month),
    Kontanter:  a.cash,
    Avanza:     a.avanza,
    Krypto:     a.crypto,
    Sparkonto:  a.sparkonto,
    Övrigt:     a.other,
  }));

  const latest = timeline[timeline.length - 1];
  const prev   = timeline[timeline.length - 2];
  const nwChange = latest && prev ? latest.Nettovärde - prev.Nettovärde : null;

  const lastDebt = debts[debts.length - 1];
  const currentCSN = lastDebt?.csn || 0;
  const projectionMonths = 12;
  const projection = Array.from({ length: projectionMonths }, (_, i) => {
    const m = new Date();
    m.setMonth(m.getMonth() + i + 1);
    return {
      name: formatMonth(m.toISOString().slice(0, 7)),
      'Projicerad CSN skuld': currentCSN + (i + 1) * csnMonthlyRate,
    };
  });

  const currentTotalAssets = latest?.Tillgångar || 0;
  const currentTotalDebts  = latest?.Skulder || 0;
  const currentNetWorth    = currentTotalAssets - currentTotalDebts;

  return (
    <div className="flex flex-col h-full overflow-auto bg-bg text-ink">
      <PageBanner
        img="/img/f-save.jpg"
        eyebrow="Ekonomi"
        title="Förmögenhet"
        subtitle="Totalt nettovärde och skuldöversikt"
      />

      <div className="px-4 sm:px-6 lg:px-10 py-6 space-y-4">
        {/* KPIs */}
        <motion.div {...FADE} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-faint mb-0.5">Totala tillgångar</p>
            <p className="font-display tabular-nums text-2xl text-cyan">{formatSEK(currentTotalAssets)}</p>
          </Card>
          <Card>
            <p className="text-xs text-faint mb-0.5">Totala skulder</p>
            <p className="font-display tabular-nums text-2xl text-coral">{formatSEK(currentTotalDebts)}</p>
          </Card>
          <Card>
            <p className="text-xs text-faint mb-0.5">Nettovärde</p>
            <p className={`font-display tabular-nums text-2xl tracking-tight ${currentNetWorth >= 0 ? 'text-ink' : 'text-coral'}`}>
              {formatSEK(currentNetWorth)}
            </p>
            {nwChange !== null && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${nwChange >= 0 ? 'text-cyan' : 'text-coral'}`}>
                {nwChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {nwChange >= 0 ? '+' : ''}{formatSEK(nwChange)} vs föregående
              </div>
            )}
          </Card>
        </motion.div>

        {/* Net worth area chart */}
        {timeline.length > 0 && (
          <motion.div {...FADE} transition={{ delay: 0.05 }}>
            <Card>
              <CardHeader title="Nettovärde över tid" subtitle="Tillgångar minus skulder" />
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={timeline}>
                  <defs>
                    <linearGradient id="assetsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5fe0d0" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#5fe0d0" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="debtsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff8f7a" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ff8f7a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,241,234,.08)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9b9688' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9b9688' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Tillgångar" stroke="#5fe0d0" strokeWidth={2} fill="url(#assetsGrad)" />
                  <Area type="monotone" dataKey="Skulder"    stroke="#ff8f7a" strokeWidth={2} fill="url(#debtsGrad)" />
                  <Line type="monotone" dataKey="Nettovärde" stroke="#e9c178" strokeWidth={2.5} dot={{ fill: '#e9c178', r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        )}

        {/* Asset breakdown stacked area */}
        {assetBreakdown.length > 1 && (
          <motion.div {...FADE} transition={{ delay: 0.08 }}>
            <Card>
              <CardHeader title="Tillgångsfördelning" subtitle="Fördelning per typ över tid" />
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={assetBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,241,234,.08)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9b9688' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9b9688' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Kontanter"  stackId="a" stroke="#5fe0d0" fill="#5fe0d040" strokeWidth={1} />
                  <Area type="monotone" dataKey="Sparkonto"  stackId="a" stroke="#bfe26a" fill="#bfe26a40" strokeWidth={1} />
                  <Area type="monotone" dataKey="Avanza"     stackId="a" stroke="#e9c178" fill="#e9c17840" strokeWidth={1} />
                  <Area type="monotone" dataKey="Krypto"     stackId="a" stroke="#9b8cff" fill="#9b8cff40" strokeWidth={1} />
                  <Area type="monotone" dataKey="Övrigt"     stackId="a" stroke="#ff8f7a" fill="#ff8f7a40" strokeWidth={1} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Assets */}
          <motion.div {...FADE} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader title="Tillgångar" subtitle="Registrera månadsvis"
                action={
                  <button onClick={() => setShowAssetForm(v => !v)}
                    className="flex items-center gap-1 text-xs text-gold hover:text-gold-2 font-medium">
                    <Plus size={12} /> Ny snapshot
                  </button>
                } />
              {livePortfolioSEK > 0 && (
                <div className="flex items-center justify-between bg-soft rounded-xl px-3 py-2 mb-2">
                  <span className="text-xs text-mut">Live portföljvärde (Avanza/aktier)</span>
                  <span className="text-xs font-semibold text-gold tabular-nums">{formatSEK(livePortfolioSEK)}</span>
                </div>
              )}
              {showAssetForm && (
                <SnapshotForm month={new Date().toISOString().slice(0, 7)} type="asset"
                  portfolioValue={livePortfolioSEK}
                  onSave={async (d) => { addAssetSnapshot(d); if (user) await saveAsset(user.uid, d); setShowAssetForm(false); }}
                  onCancel={() => setShowAssetForm(false)} />
              )}
              {assets.length === 0 && !showAssetForm && (
                <div className="py-6 text-center text-sm text-faint">Lägg till din första snapshot</div>
              )}
              <div className="space-y-2 mt-2">
                {[...assets].reverse().slice(0, 3).map(a => (
                  <div key={a.month} className="bg-soft rounded-xl p-3">
                    <p className="text-xs font-semibold text-mut mb-1">{formatMonth(a.month)}</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-mut">
                      <span>Kontanter: {formatSEK(a.cash)}</span>
                      <span>Avanza: {formatSEK(a.avanza)}</span>
                      <span>Krypto: {formatSEK(a.crypto)}</span>
                      <span>Sparkonto: {formatSEK(a.sparkonto)}</span>
                    </div>
                    <p className="text-xs font-semibold text-cyan mt-1">
                      Totalt: {formatSEK(a.cash + a.avanza + a.crypto + a.sparkonto + a.other)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Debts */}
          <motion.div {...FADE} transition={{ delay: 0.15 }}>
            <Card>
              <CardHeader title="Skulder" subtitle="Registrera månadsvis"
                action={
                  <button onClick={() => setShowDebtForm(v => !v)}
                    className="flex items-center gap-1 text-xs text-gold hover:text-gold-2 font-medium">
                    <Plus size={12} /> Ny snapshot
                  </button>
                } />
              {showDebtForm && (
                <SnapshotForm month={new Date().toISOString().slice(0, 7)} type="debt"
                  onSave={async (d) => { addDebtSnapshot(d); if (user) await saveDebt(user.uid, d); setShowDebtForm(false); }}
                  onCancel={() => setShowDebtForm(false)} />
              )}
              {debts.length === 0 && !showDebtForm && (
                <div className="py-6 text-center text-sm text-faint">Lägg till din första skuldsnapshot</div>
              )}
              <div className="space-y-2 mt-2">
                {[...debts].reverse().slice(0, 3).map(d => (
                  <div key={d.month} className="bg-soft rounded-xl p-3">
                    <p className="text-xs font-semibold text-mut mb-1">{formatMonth(d.month)}</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-mut">
                      <span>CSN: {formatSEK(d.csn)}</span>
                      <span>Klarna: {formatSEK(d.klarna)}</span>
                      <span>Övrigt: {formatSEK(d.other)}</span>
                    </div>
                    <p className="text-xs font-semibold text-coral mt-1">
                      Totalt: {formatSEK(d.csn + d.klarna + d.other)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* CSN debt projection */}
        {currentCSN > 0 && (
          <motion.div {...FADE} transition={{ delay: 0.2 }}>
            <Card>
              <div className="flex items-center justify-between mb-3">
                <CardHeader title="CSN Skuldprognos" subtitle="Projicerad skuldutveckling nästa 12 månader" />
                <div className="flex items-center gap-2 text-xs">
                  {editingCsnRate ? (
                    <div className="flex items-center gap-1">
                      <input type="number" value={csnRateInput} onChange={e => setCsnRateInput(e.target.value)}
                        className="w-20 bg-soft text-ink border border-line rounded-lg px-2 py-1 outline-none focus:border-gold/50" />
                      <span className="text-faint">kr/mån</span>
                      <button onClick={() => { setCsnMonthlyRate(parseInt(csnRateInput) || 8500); setEditingCsnRate(false); }}
                        className="text-gold hover:text-gold-2"><Check size={13} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setCsnRateInput(String(csnMonthlyRate)); setEditingCsnRate(true); }}
                      className="text-faint hover:text-ink">
                      +{formatSEK(csnMonthlyRate)}/mån
                    </button>
                  )}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={[{ name: 'Nu', 'Projicerad CSN skuld': currentCSN }, ...projection]}>
                  <defs>
                    <linearGradient id="csnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#e9c178" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#e9c178" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(244,241,234,.08)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9b9688' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9b9688' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatSEK(v)} contentStyle={{ borderRadius: 12, fontSize: 11, background: '#15151b', border: '1px solid rgba(244,241,234,.09)', color: '#f4f1ea' }} />
                  <Area type="monotone" dataKey="Projicerad CSN skuld" stroke="#e9c178" strokeWidth={2}
                    strokeDasharray="5 5" fill="url(#csnGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
