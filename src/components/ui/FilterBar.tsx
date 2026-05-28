import { useStore } from '../../store/useStore';
import { allMonths } from '../../utils/calculations';
import { ALL_CATEGORIES } from '../../utils/categorize';
import { formatMonth } from '../../utils/calculations';
import { X, Search } from 'lucide-react';

export default function FilterBar() {
  const { transactions, filter, setFilter, resetFilter } = useStore();
  const months = allMonths(transactions);
  const accounts = [...new Set(transactions.map(t => t.account))].sort();

  const hasFilter = filter.months.length || filter.categories.length ||
    filter.accounts.length || filter.type !== 'all' || filter.search ||
    filter.amountMin !== null || filter.amountMax !== null;

  const toggleMonth = (m: string) => {
    const months = filter.months.includes(m)
      ? filter.months.filter(x => x !== m)
      : [...filter.months, m];
    setFilter({ months });
  };

  const toggleCat = (c: string) => {
    const cats = filter.categories.includes(c as any)
      ? filter.categories.filter(x => x !== c)
      : [...filter.categories, c as any];
    setFilter({ categories: cats });
  };

  const toggleAccount = (a: string) => {
    const accs = filter.accounts.includes(a)
      ? filter.accounts.filter(x => x !== a)
      : [...filter.accounts, a];
    setFilter({ accounts: accs });
  };

  return (
    <div className="bg-white border-b border-gray-100 px-6 py-3 space-y-3">
      {/* Row 1: Search + Type */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Sök transaktion..."
            value={filter.search}
            onChange={e => setFilter({ search: e.target.value })}
            className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {(['all', 'income', 'expense'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilter({ type: t })}
              className={`px-3 py-2 ${filter.type === t ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              {t === 'all' ? 'Alla' : t === 'income' ? 'Inkomster' : 'Utgifter'}
            </button>
          ))}
        </div>
        {hasFilter && (
          <button
            onClick={resetFilter}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-2"
          >
            <X size={12} /> Rensa
          </button>
        )}
      </div>

      {/* Row 2: Month chips */}
      {months.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-[11px] text-gray-400 self-center mr-1">Månad:</span>
          {months.map(m => (
            <button
              key={m}
              onClick={() => toggleMonth(m)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                filter.months.includes(m)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {formatMonth(m)}
            </button>
          ))}
        </div>
      )}

      {/* Row 3: Category filter (top expense categories) */}
      <div className="flex gap-1.5 flex-wrap">
        <span className="text-[11px] text-gray-400 self-center mr-1">Kategori:</span>
        {ALL_CATEGORIES.filter(c => !['Överföring'].includes(c)).map(cat => (
          <button
            key={cat}
            onClick={() => toggleCat(cat)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              filter.categories.includes(cat as any)
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Row 4: Account filter */}
      {accounts.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-[11px] text-gray-400 self-center mr-1">Konto:</span>
          {accounts.map(acc => (
            <button
              key={acc}
              onClick={() => toggleAccount(acc)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                filter.accounts.includes(acc)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {acc}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
