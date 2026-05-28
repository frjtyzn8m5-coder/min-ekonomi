import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { filterTxs, formatSEK, formatMonth, allMonths } from '../utils/calculations';
import { ALL_CATEGORIES, CATEGORY_COLORS } from '../utils/categorize';
import { Card } from '../components/ui/Card';
import FilterBar from '../components/ui/FilterBar';
import { Plus, ChevronDown, ChevronUp, Trash2, Tag, Check, X } from 'lucide-react';
import type { Transaction, Category } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Manual Transaction Modal ──────────────────────────────────────────────────

interface ManualTxModalProps {
  onClose: () => void;
}

function ManualTxModal({ onClose }: ManualTxModalProps) {
  const { transactions, addManualTransaction } = useStore();
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
    addManualTransaction({
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
    });
    onClose();
  };

  const expenseCats = ALL_CATEGORIES.filter(c =>
    !['Lön','CSN Bidrag','CSN Lån','Investeringsvinst','Övrigt Inkomst','Överföring'].includes(c)
  );
  const incomeCats = ['Lön','CSN Bidrag','CSN Lån','Investeringsvinst','Övrigt Inkomst'];
  const cats = form.isExpense ? expenseCats : incomeCats;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Ny transaktion</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Datum</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Konto</label>
            {accounts.length > 0 ? (
              <select value={form.account} onChange={e => set('account', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400">
                {accounts.map(a => <option key={a}>{a}</option>)}
              </select>
            ) : (
              <input value={form.account} onChange={e => set('account', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400" />
            )}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Beskrivning</label>
          <input value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="T.ex. ICA Maxi"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Belopp (kr)</label>
            <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Typ</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium h-[34px]">
              <button onClick={() => { set('isExpense', true); set('category', 'Övrigt Utgift'); }}
                className={`flex-1 ${form.isExpense ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                Utgift
              </button>
              <button onClick={() => { set('isExpense', false); set('category', 'Övrigt Inkomst'); }}
                className={`flex-1 ${!form.isExpense ? 'bg-green-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                Inkomst
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Kategori</label>
          <select value={form.category} onChange={e => set('category', e.target.value as Category)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400">
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Taggar</label>
          <div className="flex gap-1.5 flex-wrap mb-1.5">
            {form.tags.map(t => (
              <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">
                {t}
                <button onClick={() => removeTag(t)}><X size={10} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={form.tagInput} onChange={e => set('tagInput', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Lägg till tagg..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400" />
            <button onClick={addTag}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
              +
            </button>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Avbryt
          </button>
          <button onClick={submit}
            className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600">
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
  const [expanded, setExpanded] = useState(false);
  const [edit, setEdit] = useState({
    description: tx.description,
    category: tx.category,
    date: tx.date,
    tagInput: '',
    tags: tx.tags ?? [],
  });

  const saveEdit = () => {
    updateTransaction(tx.id, {
      description: edit.description,
      category: edit.category,
      date: edit.date,
      tags: edit.tags,
    });
    setExpanded(false);
  };

  const addTag = () => {
    const t = edit.tagInput.trim();
    if (t && !edit.tags.includes(t)) setEdit(e => ({ ...e, tags: [...e.tags, t], tagInput: '' }));
    else setEdit(e => ({ ...e, tagInput: '' }));
  };

  const removeTag = (t: string) => setEdit(e => ({ ...e, tags: e.tags.filter(x => x !== t) }));

  const color = CATEGORY_COLORS[tx.category] || '#e5e7eb';

  return (
    <>
      <div className="flex items-center justify-between px-4 lg:px-5 py-3 hover:bg-gray-50/50 cursor-pointer"
        onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold"
            style={{ background: color + '25', color }}>
            {tx.description.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate max-w-[160px] lg:max-w-xs">{tx.description}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs text-gray-400">{tx.date}</p>
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: color + '20', color }}>
                {tx.category}
              </span>
              {tx.account && <span className="text-xs text-gray-400 hidden sm:inline">{tx.account}</span>}
              {(tx.tags ?? []).map(t => (
                <span key={t} className="hidden sm:inline text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500">
                  <Tag size={8} className="inline mr-0.5" />{t}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-gray-800'}`}>
            {tx.amount >= 0 ? '+' : ''}{formatSEK(tx.amount)}
          </span>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
            className="overflow-hidden bg-blue-50/30 border-t border-b border-blue-100">
            <div className="px-4 lg:px-5 py-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">Beskrivning</label>
                  <input value={edit.description} onChange={e => setEdit(x => ({ ...x, description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-sm outline-none focus:border-blue-400 bg-white" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">Datum</label>
                  <input type="date" value={edit.date} onChange={e => setEdit(x => ({ ...x, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-sm outline-none focus:border-blue-400 bg-white" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">Kategori</label>
                  <select value={edit.category} onChange={e => setEdit(x => ({ ...x, category: e.target.value as Category }))}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-sm outline-none focus:border-blue-400 bg-white">
                    {ALL_CATEGORIES.filter(c => c !== 'Överföring').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">Taggar</label>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {edit.tags.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs">
                      {t}
                      <button onClick={() => removeTag(t)}><X size={9} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={edit.tagInput} onChange={e => setEdit(x => ({ ...x, tagInput: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTag()}
                    placeholder="Ny tagg..."
                    className="w-32 border border-gray-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-blue-400 bg-white" />
                  <button onClick={addTag} className="text-xs px-2 py-1 bg-gray-100 rounded-lg hover:bg-gray-200">+</button>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={saveEdit}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600">
                  <Check size={12} /> Spara
                </button>
                <button onClick={() => setExpanded(false)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">
                  Avbryt
                </button>
                <button onClick={() => deleteTransaction(tx.id)}
                  className="ml-auto flex items-center gap-1 px-3 py-1.5 text-red-400 hover:text-red-600 text-xs">
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
    <div className="flex flex-col h-full">
      {showModal && <ManualTxModal onClose={() => setShowModal(false)} />}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Transaktioner</h1>
          <p className="text-xs text-gray-400">{filtered.length} transaktioner</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <span className="text-green-600 font-medium">+{formatSEK(totalIncome)}</span>
            <span className="text-gray-500">−{formatSEK(totalExpense)}</span>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-600">
            <Plus size={13} /> Ny
          </button>
        </div>
      </div>

      <FilterBar />

      {/* List */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Inga transaktioner matchar filtret
          </div>
        ) : (
          <Card padding={false} className="m-4 lg:m-6">
            <div className="divide-y divide-gray-50">
              {paginated.map(tx => <TxRow key={tx.id} tx={tx} />)}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30">
                  ← Föregående
                </button>
                <span className="text-xs text-gray-400">{page} / {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30">
                  Nästa →
                </button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
