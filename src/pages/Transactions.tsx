import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { updateTransactionDoc, deleteTransaction as dbDeleteTx, saveTxBatch } from '../lib/db';
import { filterTxs, formatSEK, formatMonth, allMonths } from '../utils/calculations';
import { ALL_CATEGORIES, CATEGORY_COLORS } from '../utils/categorize';
import FilterBar from '../components/ui/FilterBar';
import { Plus, ChevronDown, ChevronUp, Trash2, Tag, Check, X } from 'lucide-react';
import type { Transaction, Category } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import PageBanner from '../components/ui/PageBanner';

const GOLD_BTN = { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' };

// ─── Manual Transaction Modal ──────────────────────────────────────────────────

interface ManualTxModalProps {
  onClose: () => void;
}

function ManualTxModal({ onClose }: ManualTxModalProps) {
  const { transactions, addManualTransaction } = useStore();
  const { user } = useAuthStore();
  const accounts = [...new Set(transactions.map(t => t.account))].sort();

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    isExpense: true,
    category: 'Övrigt Utgift' as Category,
    account: accounts[0] || 'Konto',
    tagInput: '',
    tags: [] as string[],
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const addTag = () => {
    const t = form.tagInput.trim();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    set('tagInput', '');
  };

  const removeTag = (t: string) => set('tags', form.tags.filter(x => x !== t));

  const submit = () => {
    if (!form.description.trim() || !form.amount) return;
    const amt = parseFloat(form.amount);
    if (isNaN(amt)) return;
    const finalAmt = form.isExpense ? -Math.abs(amt) : Math.abs(amt);
    const tx: Transaction = {
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      date: form.date,
      description: form.description.trim(),
      amount: finalAmt,
      category: form.category,
      account: form.account,
      tags: form.tags,
      type: finalAmt >= 0 ? 'income' : 'expense',
      isTransfer: false,
      source: 'manual',
    };
    addManualTransaction(tx);
    if (user) saveTxBatch(user.uid, [tx], tx.id).catch(() => {});
    onClose();
  };

  const expenseCats = ALL_CATEGORIES.filter(c =>
    !['Lön','CSN Bidrag','CSN Lån','Investeringsvinst','Övrigt Inkomst','Överföring'].includes(c)
  );
  const incomeCats = ['Lön','CSN Bidrag','CSN Lån','Investeringsvinst','Övrigt Inkomst'];
  const cats = form.isExpense ? expenseCats : incomeCats;

  const inputCls = "w-full border border-line bg-soft text-ink rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gold";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        className="vh-card bg-card text-ink w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-ink text-[17px]">Ny transaktion</h2>
          <button onClick={onClose} className="text-faint hover:text-ink"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-mut mb-1 block">Datum</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-mut mb-1 block">Konto</label>
            {accounts.length > 0 ? (
              <select value={form.account} onChange={e => set('account', e.target.value)}
                className={inputCls}>
                {accounts.map(a => <option key={a}>{a}</option>)}
              </select>
            ) : (
              <input value={form.account} onChange={e => set('account', e.target.value)}
                className={inputCls} />
            )}
          </div>
        </div>

        <div>
          <label className="text-xs text-mut mb-1 block">Beskrivning</label>
          <input value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="T.ex. ICA Maxi"
            className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-mut mb-1 block">Belopp (kr)</label>
            <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="0"
              className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-mut mb-1 block">Typ</label>
            <div className="flex rounded-lg border border-line overflow-hidden text-xs font-medium h-[34px]">
              <button onClick={() => { set('isExpense', true); set('category', 'Övrigt Utgift'); }}
                className={`flex-1 ${form.isExpense ? 'text-[#2a1208] font-semibold' : 'bg-card text-mut hover:bg-white/5'}`}
                style={form.isExpense ? { background: 'var(--coral)' } : undefined}>
                Utgift
              </button>
              <button onClick={() => { set('isExpense', false); set('category', 'Övrigt Inkomst'); }}
                className={`flex-1 ${!form.isExpense ? 'text-[#06231f] font-semibold' : 'bg-card text-mut hover:bg-white/5'}`}
                style={!form.isExpense ? { background: 'var(--cyan)' } : undefined}>
                Inkomst
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-mut mb-1 block">Kategori</label>
          <select value={form.category} onChange={e => set('category', e.target.value as Category)}
            className={inputCls}>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-mut mb-1 block">Taggar</label>
          <div className="flex gap-1.5 flex-wrap mb-1.5">
            {form.tags.map(t => (
              <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-gold" style={{ background: 'rgba(233,193,120,.12)' }}>
                {t}
                <button onClick={() => removeTag(t)}><X size={10} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={form.tagInput} onChange={e => set('tagInput', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Lägg till tagg..."
              className="flex-1 border border-line bg-soft text-ink rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gold" />
            <button onClick={addTag}
              className="px-3 py-1.5 bg-soft text-mut rounded-lg text-sm hover:bg-white/5">
              +
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-line text-sm text-mut hover:bg-white/5">
            Avbryt
          </button>
          <button onClick={submit}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-[#2a1d08]" style={GOLD_BTN}>
            Lägg till
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Transaction Row ───────────────────────────────────────────────────────────

interface TxRowProps {
  tx: Transaction;
}

function TxRow({ tx }: TxRowProps) {
  const { updateTransaction, deleteTransaction } = useStore();
  const { user } = useAuthStore();
  const [expanded, setExpanded] = useState(false);
  const [edit, setEdit] = useState({
    description: tx.description,
    category: tx.category,
    date: tx.date,
    tagInput: '',
    tags: tx.tags ?? [],
  });

  const saveEdit = () => {
    updateTransaction(tx.id, { description: edit.description, category: edit.category, date: edit.date, tags: edit.tags });
    if (user) updateTransactionDoc(user.uid, tx.id, { description: edit.description, category: edit.category, date: edit.date, tags: edit.tags });
    setExpanded(false);
  };

  const addTag = () => {
    const t = edit.tagInput.trim();
    if (t && !edit.tags.includes(t)) setEdit(e => ({ ...e, tags: [...e.tags, t], tagInput: '' }));
    else setEdit(e => ({ ...e, tagInput: '' }));
  };

  const removeTag = (t: string) => setEdit(e => ({ ...e, tags: e.tags.filter(x => x !== t) }));

  const color = CATEGORY_COLORS[tx.category] || '#625d52';

  return (
    <>
      <div className="flex items-center justify-between px-4 lg:px-5 py-3 hover:bg-white/5 cursor-pointer"
        onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold"
            style={{ background: color + '25', color }}>
            {tx.description.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate max-w-[160px] lg:max-w-xs">{tx.description}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs text-faint">{tx.date}</p>
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: color + '20', color }}>
                {tx.category}
              </span>
              {tx.account && <span className="text-xs text-faint hidden sm:inline">{tx.account}</span>}
              {(tx.tags ?? []).map(t => (
                <span key={t} className="hidden sm:inline text-xs px-1.5 py-0.5 rounded-full text-gold" style={{ background: 'rgba(233,193,120,.12)' }}>
                  <Tag size={8} className="inline mr-0.5" />{t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-sm font-semibold tabular-nums ${tx.amount >= 0 ? 'text-cyan' : 'text-ink'}`}>
            {tx.amount >= 0 ? '+' : ''}{formatSEK(tx.amount)}
          </span>
          {expanded ? <ChevronUp size={14} className="text-faint" /> : <ChevronDown size={14} className="text-faint" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-b border-line"
            style={{ background: 'rgba(233,193,120,.05)' }}>
            <div className="px-4 lg:px-5 py-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-faint mb-1 block">Beskrivning</label>
                  <input value={edit.description} onChange={e => setEdit(x => ({ ...x, description: e.target.value }))}
                    className="w-full border border-line rounded-lg px-2.5 py-1 text-sm outline-none focus:border-gold bg-soft text-ink" />
                </div>
                <div>
                  <label className="text-[11px] text-faint mb-1 block">Datum</label>
                  <input type="date" value={edit.date} onChange={e => setEdit(x => ({ ...x, date: e.target.value }))}
                    className="w-full border border-line rounded-lg px-2.5 py-1 text-sm outline-none focus:border-gold bg-soft text-ink" />
                </div>
                <div>
                  <label className="text-[11px] text-faint mb-1 block">Kategori</label>
                  <select value={edit.category} onChange={e => setEdit(x => ({ ...x, category: e.target.value as Category }))}
                    className="w-full border border-line rounded-lg px-2.5 py-1 text-sm outline-none focus:border-gold bg-soft text-ink">
                    {ALL_CATEGORIES.filter(c => c !== 'Överföring').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-faint mb-1 block">Taggar</label>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {edit.tags.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-gold" style={{ background: 'rgba(233,193,120,.16)' }}>
                      {t}
                      <button onClick={() => removeTag(t)}><X size={9} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={edit.tagInput} onChange={e => setEdit(x => ({ ...x, tagInput: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTag()}
                    placeholder="Ny tagg..."
                    className="w-32 border border-line rounded-lg px-2.5 py-1 text-xs outline-none focus:border-gold bg-soft text-ink" />
                  <button onClick={addTag} className="text-xs px-2 py-1 bg-soft text-mut rounded-lg hover:bg-white/5">+</button>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={saveEdit}
                  className="flex items-center gap-1 px-3 py-1.5 text-[#2a1d08] text-xs rounded-lg" style={GOLD_BTN}>
                  <Check size={12} /> Spara
                </button>
                <button onClick={() => setExpanded(false)}
                  className="px-3 py-1.5 border border-line text-mut text-xs rounded-lg hover:bg-white/5">
                  Avbryt
                </button>
                <button onClick={() => { deleteTransaction(tx.id); if (user) dbDeleteTx(user.uid, tx.id); }}
                  className="ml-auto flex items-center gap-1 px-3 py-1.5 text-coral hover:brightness-110 text-xs">
                  <Trash2 size={12} /> Ta bort
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function Transactions() {
  const { transactions, filter } = useStore();
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => filterTxs(transactions, filter), [transactions, filter]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalIncome  = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="flex flex-col h-full bg-bg text-ink">
      {showModal && <ManualTxModal onClose={() => setShowModal(false)} />}

      {/* Banner */}
      <div className="flex-shrink-0">
        <PageBanner
          img="/img/f-fin.jpg"
          eyebrow="Ekonomi"
          title="Transaktioner"
          subtitle={`${filtered.length} transaktioner`}
          action={
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-4 text-xs">
                <span className="text-cyan font-medium tabular-nums">+{formatSEK(totalIncome)}</span>
                <span className="text-white/60 tabular-nums">−{formatSEK(totalExpense)}</span>
              </div>
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 text-[#2a1d08] text-xs font-semibold px-3.5 py-2 rounded-xl" style={GOLD_BTN}>
                <Plus size={13} /> Ny
              </button>
            </div>
          }
        />
      </div>

      <FilterBar />

      {/* List */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-faint text-sm">
            Inga transaktioner matchar filtret
          </div>
        ) : (
          <div className="vh-card m-4 lg:m-6">
            <div className="divide-y divide-line">
              {paginated.map(tx => <TxRow key={tx.id} tx={tx} />)}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-line">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="text-xs text-mut hover:text-ink disabled:opacity-30">
                  ← Föregående
                </button>
                <span className="text-xs text-faint tabular-nums">{page} / {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="text-xs text-mut hover:text-ink disabled:opacity-30">
                  Nästa →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
