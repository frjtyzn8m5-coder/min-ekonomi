import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { saveOwnAccounts } from '../lib/db';
import { updateTransactionDoc } from '../lib/db';
import { Card } from '../components/ui/Card';
import { Plus, Trash2, Zap, Check } from 'lucide-react';

const SWISH_RX = /^46[0-9]{9}$/;
const NUMBER_RX = /^\d{7,}$/;

function detectCandidates(transactions: ReturnType<typeof useStore.getState>['transactions'], ownAccounts: string[]): string[] {
  const counts: Record<string, { pos: number; neg: number }> = {};
  for (const tx of transactions) {
    const d = tx.description.trim();
    if (!NUMBER_RX.test(d)) continue;
    if (!counts[d]) counts[d] = { pos: 0, neg: 0 };
    if (tx.amount >= 0) counts[d].pos++;
    else counts[d].neg++;
  }
  return Object.entries(counts)
    .filter(([num, c]) => !ownAccounts.includes(num) && (c.pos > 0 || c.neg > 1) && SWISH_RX.test(num))
    .sort((a, b) => (b[1].pos + b[1].neg) - (a[1].pos + a[1].neg))
    .map(([num]) => num);
}

export default function Settings() {
  const { transactions, ownAccounts, addOwnAccount, removeOwnAccount, setOwnAccounts } = useStore();
  const { user } = useAuthStore();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saved, setSaved] = useState(false);

  const candidates = useMemo(
    () => detectCandidates(transactions, ownAccounts),
    [transactions, ownAccounts]
  );

  const save = async (accounts: string[]) => {
    if (!user) return;
    setSaving(true);
    setOwnAccounts(accounts);
    await saveOwnAccounts(user.uid, accounts);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const add = async (account: string) => {
    const trimmed = account.trim();
    if (!trimmed || ownAccounts.includes(trimmed)) return;
    const next = [...new Set([...ownAccounts, trimmed])];
    setInput('');
    await save(next);
  };

  const remove = async (account: string) => {
    const next = ownAccounts.filter(a => a !== account);
    await save(next);
  };

  // Re-classify all transactions matching ownAccounts as transfers in Firestore
  const applyToTransactions = async () => {
    if (!user || ownAccounts.length === 0) return;
    setApplying(true);
    const toUpdate = transactions.filter(tx =>
      ownAccounts.includes(tx.description.trim()) && !tx.isTransfer
    );
    await Promise.all(
      toUpdate.map(tx =>
        updateTransactionDoc(user.uid, tx.id, { isTransfer: true, category: 'Överföring', type: 'transfer' })
      )
    );
    setApplying(false);
  };

  const txCountForAccount = (acc: string) =>
    transactions.filter(tx => tx.description.trim() === acc).length;

  return (
    <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Inställningar</h1>

      {/* Own accounts */}
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Egna kontonummer</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Transaktioner till/från dessa nummer klassas automatiskt som överföringar och påverkar inte din budget.
          </p>
        </div>

        {/* Auto-detected candidates */}
        {candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Zap size={11} className="text-yellow-500" /> Hittade möjliga egna konton
            </p>
            <div className="flex flex-wrap gap-2">
              {candidates.map(c => (
                <button
                  key={c}
                  onClick={() => add(c)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-blue-300 bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 transition-all"
                >
                  <Plus size={11} />
                  {c}
                  <span className="text-blue-400 text-[10px]">({txCountForAccount(c)} tr.)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current own accounts */}
        {ownAccounts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Sparade konton</p>
            {ownAccounts.map(acc => (
              <div key={acc} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-mono text-gray-800">{acc}</span>
                  <span className="ml-2 text-[11px] text-gray-400">{txCountForAccount(acc)} transaktioner</span>
                </div>
                <button onClick={() => remove(acc)}
                  className="text-gray-300 hover:text-red-400 transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Manual add */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Lägg till kontonummer..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add(input)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <button
            onClick={() => add(input)}
            disabled={!input.trim() || saving}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-40 transition-all"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Apply button */}
        {ownAccounts.length > 0 && (
          <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
            <button
              onClick={applyToTransactions}
              disabled={applying}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-700 disabled:opacity-40 transition-all"
            >
              {applying ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Zap size={14} />
              )}
              Tillämpa på befintliga transaktioner
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Check size={12} /> Sparat
              </span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
