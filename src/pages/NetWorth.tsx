import { useState } from 'react';
import { useStore } from '../store/useStore';
import { formatSEK, formatMonth } from '../utils/calculations';
import { Card, CardHeader, Stat, EmptyState } from '../components/ui/Card';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart, Line, Cell, Legend
} from 'recharts';
import { Plus, TrendingUp, TrendingDown, Edit2, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AssetSnapshot, DebtSnapshot } from '../types';

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

interface SnapshotFormProps {
  month: string;
  type: 'asset' | 'debt';
  existing?: AssetSnapshot | DebtSnapshot;
  onSave: (data: any) => void;
  onCancel: () => void;
}

function SnapshotForm({ month, type, existing, onSave, onCancel }: SnapshotFormProps) {
  const isAsset = type === 'asset';
  const fields = isAsset
    ? [
        { key: 'cash', label: 'Kontanter / bank' },
        { key: 'avanza', label: 'Avanza ISK/aktier' },
        { key: 'crypto', label: 'Krypto' },
        { key: 'sparkonto', label: 'Sparkonto' },
        { key: 'other', label: 'Övrigt' },
      ]
    : [
        { key: 'csn', label: 'CSN Studielån' },
        { key: 'klarna', label: 'Klarna / kortkredit' },
        { key: 'other', label: 'Övrigt' },
      ];

  const init: any = existing || { month };
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, String((init as any)[f.key] || 0)]))
  );

  const [mon, setMon] = useState(existing?.month || month);

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Månad (ÅÅÅÅ-MM)</label>
        <input type="text" value={mon} onChange={e => setMon(e.target.value)}
          placeholder="2026-05"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400" />
      </div>
      {fields.map(f => (
        <div key={f.key}>
          <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
          <input type="number" value={vals[f.key]}
            onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
            placeholder="0" />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({ month: mon, ...Object.fromEntries(fields.map(f => [f.key, parseFloat(vals[f.key]) || 0])) })}
          className="flex items-center gap-1.5 bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          <Check size={14} /> Spara
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-gray-500 text-sm px-3 py-2 rounded-lg hover:bg-gray-100">
          <X size={14} /> Avbryt
        </button>
      </div>
    </div>
  );
}

export default function NetWorth() {
  const { assets, debts, addAssetSnapshot, addDebtSnapshot, transactions } = useStore();
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);

  // Build timeline combining assets and debts
  const months = [...new Set([
    ...assets.map(a => a.month),
    ...debts.map(d => d.month),
  ])].sort();

  const timeline = months.map(m => {
    const a = assets.find(x => x.month === m);
    const d = debts.find(x => x.month === m);
    const totalAssets = a ? (a.cash + a.avanza + a.crypto + a.sparkonto + a.other) : 0;
    const totalDebts = d ? (d.csn + d.klarna + d.other) : 0;
    return {
      name: formatMonth(m),
      Tillgångar: totalAssets,
      Skulder: totalDebts,
      'Nettovärde': totalAssets - totalDebts,
    };
  });

  const latest = timeline[timeline.length - 1];
  const prev = timeline[timeline.length - 2];
  const nwChange = latest && prev ? latest['Nettovärde'] - prev['Nettovärde'] : null;

  // CSN debt projection: add ~8,500 SEK per month until graduation
  const lastDebt = debts[debts.length - 1];
  const currentCSN = lastDebt?.csn || 0;
  const projectionMonths = 12;
  const projection = Array.from({ length: projectionMonths }, (_, i) => {
    const m = new Date();
    m.setMonth(m.getMonth() + i + 1);
    const projMonth = m.toISOString().slice(0, 7);
    return {
      name: formatMonth(projMonth),
      'Faktisk skuld': undefined,
      'Projicerad CSN skuld': currentCSN + (i + 1) * 8500,
    };
  });

  const currentTotalAssets = latest?.Tillgångar || 0;
  const currentTotalDebts = latest?.Skulder || 0;
  const currentNetWorth = currentTotalAssets - currentTotalDebts;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-4 bg-white border-b border-gray-100">
        <h1 className="text-xl font-semibold text-gray-900">Förmögenhet & Skulder</h1>
        <p className="text-sm text-gray-400 mt-0.5">Totalt nettovärde och skuldöversikt</p>
      </div>

      <div className="p-6 space-y-4">
        {/* KPIs */}
        <motion.div {...FADE} className="grid grid-cols-3 gap-4">
          <Card>
            <Stat label="Totala tillgångar" value={formatSEK(currentTotalAssets)} color="text-green-600" />
          </Card>
          <Card>
            <Stat label="Totala skulder" value={formatSEK(currentTotalDebts)} color="text-red-500" />
          </Card>
          <Card>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Nettovärde</p>
              <p className={`text-2xl font-semibold tracking-tight ${currentNetWorth >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                {formatSEK(currentNetWorth)}
              </p>
              {nwChange !== null && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${nwChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {nwChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {nwChange >= 0 ? '+' : ''}{formatSEK(nwChange)} vs föregående
                </div>
              )}
            </div>
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
                      <stop offset="5%" stopColor="#34c759" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#34c759" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="debtsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff3b30" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ff3b30" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Tillgångar" stroke="#34c759" strokeWidth={2} fill="url(#assetsGrad)" />
                  <Area type="monotone" dataKey="Skulder" stroke="#ff3b30" strokeWidth={2} fill="url(#debtsGrad)" />
                  <Line type="monotone" dataKey="Nettovärde" stroke="#007aff" strokeWidth={2.5}
                    dot={{ fill: '#007aff', r: 3 }} strokeDasharray="0" />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Assets form */}
          <motion.div {...FADE} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader
                title="Tillgångar"
                subtitle="Registrera månadsvis"
                action={
                  <button onClick={() => setShowAssetForm(v => !v)}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium">
                    <Plus size={12} /> Ny snapshot
                  </button>
                }
              />
              {showAssetForm && (
                <SnapshotForm
                  month={new Date().toISOString().slice(0, 7)}
                  type="asset"
                  onSave={(d) => { addAssetSnapshot(d); setShowAssetForm(false); }}
                  onCancel={() => setShowAssetForm(false)}
                />
              )}
              {assets.length === 0 && !showAssetForm && (
                <div className="py-6 text-center text-sm text-gray-400">
                  Ingen data ännu — lägg till din första snapshot
                </div>
              )}
              <div className="space-y-2 mt-2">
                {[...assets].reverse().slice(0, 3).map(a => (
                  <div key={a.month} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-600 mb-1">{formatMonth(a.month)}</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                      <span>Kontanter: {formatSEK(a.cash)}</span>
                      <span>Avanza: {formatSEK(a.avanza)}</span>
                      <span>Krypto: {formatSEK(a.crypto)}</span>
                      <span>Sparkonto: {formatSEK(a.sparkonto)}</span>
                    </div>
                    <p className="text-xs font-semibold text-green-600 mt-1">
                      Totalt: {formatSEK(a.cash + a.avanza + a.crypto + a.sparkonto + a.other)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Debts form */}
          <motion.div {...FADE} transition={{ delay: 0.15 }}>
            <Card>
              <CardHeader
                title="Skulder"
                subtitle="Registrera månadsvis"
                action={
                  <button onClick={() => setShowDebtForm(v => !v)}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium">
                    <Plus size={12} /> Ny snapshot
                  </button>
                }
              />
              {showDebtForm && (
                <SnapshotForm
                  month={new Date().toISOString().slice(0, 7)}
                  type="debt"
                  onSave={(d) => { addDebtSnapshot(d); setShowDebtForm(false); }}
                  onCancel={() => setShowDebtForm(false)}
                />
              )}
              {debts.length === 0 && !showDebtForm && (
                <div className="py-6 text-center text-sm text-gray-400">
                  Ingen data ännu — lägg till din första skuldsnapshot
                </div>
              )}
              <div className="space-y-2 mt-2">
                {[...debts].reverse().slice(0, 3).map(d => (
                  <div key={d.month} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-gray-600 mb-1">{formatMonth(d.month)}</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                      <span>CSN: {formatSEK(d.csn)}</span>
                      <span>Klarna: {formatSEK(d.klarna)}</span>
                      <span>Övrigt: {formatSEK(d.other)}</span>
                    </div>
                    <p className="text-xs font-semibold text-red-500 mt-1">
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
              <CardHeader title="CSN Skuldprognos" subtitle="Projicerad skuldutveckling nästa 12 månader (+8 500 kr/mån)" />
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={[
                  { name: 'Nu', 'Projicerad CSN skuld': currentCSN },
                  ...projection,
                ]}>
                  <defs>
                    <linearGradient id="csnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff9f0a" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ff9f0a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatSEK(v)} contentStyle={{ borderRadius: 12, fontSize: 11 }} />
                  <Area type="monotone" dataKey="Projicerad CSN skuld" stroke="#ff9f0a" strokeWidth={2}
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
