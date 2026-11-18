import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { saveOwnAccounts } from '../lib/db';
import { updateTransactionDoc } from '../lib/db';
import { Card } from '../components/ui/Card';
import { Plus, Trash2, Zap, Check, RefreshCw } from 'lucide-react';
import { autoCat, autoIsTransfer, smartCategorize } from '../utils/categorize';
import type { Category } from '../types';
import PageBanner from '../components/ui/PageBanner';

// Bank account numbers: 8–14 digits that do NOT start with 46 (those are Swish/phone)
const BANK_ACCOUNT_RX = /^\d{8,14}$/;
const SWISH_RX = /^46[0-9]{9}$/;

function detectCandidates(transactions: ReturnType<typeof useStore.getState>['transactions'], ownAccounts: string[]): string[] {
  const counts: Record<string, { pos: number; neg: number; totalAbs: number }> = {};
  for (const tx of transactions) {
    const d = tx.description.trim();
    if (!BANK_ACCOUNT_RX.test(d)) continue;
    if (SWISH_RX.test(d)) continue; // skip phone numbers
    if (!counts[d]) counts[d] = { pos: 0, neg: 0, totalAbs: 0 };
    if (tx.amount >= 0) counts[d].pos++;
    else counts[d].neg++;
    counts[d].totalAbs += Math.abs(tx.amount);
  }
  return Object.entries(counts)
    .filter(([num, c]) => !ownAccounts.includes(num) && (c.pos >= 1 || c.neg >= 1))
    .sort((a, b) => b[1].totalAbs - a[1].totalAbs)
    .map(([num]) => num);
}

export default function Settings() {
  const { transactions, ownAccounts, addOwnAccount, removeOwnAccount, setOwnAccounts, updateTransaction } = useStore();
  const { user } = useAuthStore();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recatting, setRecatting] = useState(false);
  const [recatResult, setRecatResult] = useState<string | null>(null);

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
    toUpdate.forEach(tx => updateTransaction(tx.id, { isTransfer: true, category: 'Överföring', type: 'transfer' }));
    setApplying(false);
  };

  const txCountForAccount = (acc: string) =>
    transactions.filter(tx => tx.description.trim() === acc).length;

  const recategorizeAll = async () => {
    if (!user || transactions.length === 0) return;
    setRecatting(true);
    setRecatResult(null);

    // Re-run categorization on all non-manual transactions
    const reCatted = smartCategorize(
      transactions.map(tx => {
        if (tx.isTransfer) return tx; // don't touch confirmed transfers
        const isXfer = autoIsTransfer(tx.description);
        const category: Category = isXfer ? 'Överföring' : autoCat(tx.description);
        return { ...tx, category, isTransfer: isXfer, type: isXfer ? 'transfer' as const : tx.amount >= 0 ? 'income' as const : 'expense' as const };
      })
    );

    // Find what actually changed
    const changed = reCatted.filter(updated => {
      const orig = transactions.find(t => t.id === updated.id);
      return orig && (orig.category !== updated.category || orig.isTransfer !== updated.isTransfer);
    });

    // Persist to Firestore + local store
    await Promise.all(
      changed.map(tx =>
        updateTransactionDoc(user.uid, tx.id, {
          category: tx.category,
          isTransfer: tx.isTransfer,
          type: tx.type,
        })
      )
    );
    changed.forEach(tx => updateTransaction(tx.id, { category: tx.category, isTransfer: tx.isTransfer, type: tx.type }));

    setRecatting(false);
    setRecatResult(`${changed.length} transaktioner uppdaterade`);
    setTimeout(() => setRecatResult(null), 4000);
  };

  return (
    <div className="flex-1 overflow-auto bg-bg text-ink">
      <PageBanner
        img="/img/f-fin.jpg"
        eyebrow="Ekonomi"
        title="Inställningar"
        subtitle="Egna konton och automatisk kategorisering"
      />

      <div className="max-w-[1600px] mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Own accounts */}
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="font-display text-sm text-ink">Egna kontonummer</h2>
          <p className="text-xs text-faint mt-0.5">
            Transaktioner till/från dessa nummer klassas automatiskt som överföringar och påverkar inte din budget.
          </p>
        </div>

        {/* Auto-detected candidates */}
        {candidates.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-mut uppercase tracking-wide flex items-center gap-1">
              <Zap size={11} className="text-gold" /> Hittade möjliga egna konton
            </p>
            <div className="flex flex-wrap gap-2">
              {candidates.map(c => (
                <button
                  key={c}
                  onClick={() => add(c)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed text-gold text-xs transition-all"
                  style={{ borderColor: 'rgba(233,193,120,.5)', background: 'rgba(233,193,120,.12)' }}
                >
                  <Plus size={11} />
                  {c}
                  <span className="text-mut text-[10px]">({txCountForAccount(c)} tr.)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current own accounts */}
        {ownAccounts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-mut uppercase tracking-wide">Sparade konton</p>
            {ownAccounts.map(acc => (
              <div key={acc} className="flex items-center justify-between px-3 py-2 bg-soft rounded-lg">
                <div>
                  <span className="text-sm font-mono text-ink">{acc}</span>
                  <span className="ml-2 text-[11px] text-faint">{txCountForAccount(acc)} transaktioner</span>
                </div>
                <button onClick={() => remove(acc)}
                  className="text-faint hover:text-coral transition-colors p-1">
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
            className="flex-1 bg-soft text-ink border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-gold/50"
          />
          <button
            onClick={() => add(input)}
            disabled={!input.trim() || saving}
            className="px-3 py-2 text-[#2a1d08] rounded-lg text-sm disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Apply button */}
        {ownAccounts.length > 0 && (
          <div className="flex items-center gap-3 pt-1 border-t border-line">
            <button
              onClick={applyToTransactions}
              disabled={applying}
              className="flex items-center gap-1.5 px-3 py-2 bg-soft text-ink border border-line rounded-lg text-sm hover:bg-card disabled:opacity-40 transition-all"
            >
              {applying ? (
                <span className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              ) : (
                <Zap size={14} className="text-gold" />
              )}
              Tillämpa på befintliga transaktioner
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-cyan">
                <Check size={12} /> Sparat
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Re-categorize */}
      <Card className="p-5 space-y-3">
        <div>
          <h2 className="font-display text-sm text-ink">Omklassificera transaktioner</h2>
          <p className="text-xs text-faint mt-0.5">
            Kör om auto-kategoriseringen på alla befintliga transaktioner med de senaste reglerna. Bekräftade överföringar ändras inte.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={recategorizeAll}
            disabled={recatting || transactions.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-[#2a1d08] rounded-lg text-sm disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}
          >
            {recatting ? (
              <span className="w-4 h-4 border-2 border-[#2a1d08] border-t-transparent rounded-full animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {recatting ? 'Bearbetar...' : `Omklassificera ${transactions.length.toLocaleString('sv-SE')} transaktioner`}
          </button>
          {recatResult && (
            <span className="flex items-center gap-1 text-xs text-cyan">
              <Check size={12} /> {recatResult}
            </span>
          )}
        </div>
      </Card>
      </div>
    </div>
  );
}
