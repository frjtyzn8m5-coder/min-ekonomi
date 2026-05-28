import { useState } from 'react';
import { useStore } from '../store/useStore';
import { filterTxs, formatSEK } from '../utils/calculations';
import { CATEGORY_COLORS, ALL_CATEGORIES } from '../utils/categorize';
import FilterBar from '../components/ui/FilterBar';
import { Card, EmptyState } from '../components/ui/Card';
import { Upload, ChevronDown } from 'lucide-react';
import type { Category } from '../types';
import { motion } from 'framer-motion';

const PAGE_SIZE = 50;

export default function Transactions() {
  const { transactions, filter, setPage, updateTransaction } = useStore();
  const [pageNum, setPageNum] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = filterTxs(transactions, filter).sort((a, b) => b.date.localeCompare(a.date));
  const paged = filtered.slice(0, (pageNum + 1) * PAGE_SIZE);

  if (!transactions.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState
          icon={<Upload size={48} />}
          title="Inga transaktioner"
          description="Importera kontoutdrag för att se dina transaktioner"
          action={
            <button onClick={() => setPage('import')}
              className="bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-600">
              Importera
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-white border-b border-gray-100">
        <h1 className="text-xl font-semibold text-gray-900">Transaktioner</h1>
        <p className="text-sm text-gray-400 mt-0.5">{filtered.length} av {transactions.filter(t => !t.isTransfer).length}</p>
      </div>

      <FilterBar />

      <div className="flex-1 overflow-auto p-6">
        <Card padding={false}>
          {/* Header */}
          <div className="grid grid-cols-[1fr_140px_120px_100px] gap-4 px-5 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            <span>Beskrivning</span>
            <span>Kategori</span>
            <span>Konto</span>
            <span className="text-right">Belopp</span>
          </div>

          <div className="divide-y divide-gray-50">
            {paged.map(tx => (
              <motion.div key={tx.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-[1fr_140px_120px_100px] gap-4 px-5 py-3 hover:bg-gray-50 transition-colors items-center"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                    style={{
                      background: (CATEGORY_COLORS[tx.category] || '#e5e7eb') + '30',
                      color: CATEGORY_COLORS[tx.category] || '#6b7280'
                    }}>
                    {tx.description.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400">{tx.date}</p>
                  </div>
                </div>

                {/* Category selector */}
                <div className="relative">
                  {editId === tx.id ? (
                    <select
                      autoFocus
                      value={tx.category}
                      onBlur={() => setEditId(null)}
                      onChange={e => {
                        updateTransaction(tx.id, { category: e.target.value as Category });
                        setEditId(null);
                      }}
                      className="text-xs border border-blue-300 rounded-lg px-2 py-1 outline-none bg-white w-full"
                    >
                      {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditId(tx.id)}
                      className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full hover:opacity-80 transition-opacity"
                      style={{
                        background: (CATEGORY_COLORS[tx.category] || '#e5e7eb') + '25',
                        color: CATEGORY_COLORS[tx.category] || '#6b7280'
                      }}
                    >
                      {tx.category}
                      <ChevronDown size={10} />
                    </button>
                  )}
                </div>

                <span className="text-xs text-gray-400 truncate">{tx.account}</span>

                <span className={`text-sm font-semibold text-right ${tx.amount >= 0 ? 'text-green-600' : 'text-gray-800'}`}>
                  {tx.amount >= 0 ? '+' : ''}{formatSEK(tx.amount)}
                </span>
              </motion.div>
            ))}
          </div>

          {paged.length < filtered.length && (
            <div className="px-5 py-4 border-t border-gray-100 text-center">
              <button
                onClick={() => setPageNum(p => p + 1)}
                className="text-sm text-blue-500 hover:text-blue-600 font-medium"
              >
                Ladda fler ({filtered.length - paged.length} kvar)
              </button>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">
              Inga transaktioner matchar filtret
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
