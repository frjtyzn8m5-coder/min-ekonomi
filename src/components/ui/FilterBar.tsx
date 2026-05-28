import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { allMonths } from '../../utils/calculations';
import { ALL_CATEGORIES } from '../../utils/categorize';
import { formatMonth } from '../../utils/calculations';
import { X, Search, SlidersHorizontal, Tag } from 'lucide-react';

function getRecentMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function getCurrentYearMonths(): string[] {
  const year = new Date().getFullYear();
  const now = new Date();
  const months: string[] = [];
  for (let m = 1; m <= now.getMonth() + 1; m++) {
    months.push(`${year}-${String(m).padStart(2, '0')}`);
  }
  return months;
}

export default function FilterBar() {
  const { transactions, filter, setFilter, resetFilter } = useStore();
  const [showMore, setShowMore] = useState(false);

  const availableMonths = allMonths(transactions);
  const accounts = [...new Set(transactions.map(t => t.account))].sort();
  const allTags = [...new Set(transactions.flatMap(t => t.tags ?? []))].sort();

  const hasFilter = filter.months.length || filter.categories.length ||
    filter.accounts.length || filter.type !== 'all' || filter.search ||
    filter.amountMin !== null || filter.amountMax !== null || filter.tags?.length;

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

  const toggleTag = (t: string) => {
    const tags = (filter.tags ?? []).includes(t)
      ? (filter.tags ?? []).filter(x => x !== t)
      : [...(filter.tags ?? []), t];
    setFilter({ tags });
  };

  const setQuickRange = (months: string[]) => {
    const filtered = months.filter(m => availableMonths.includes(m));
    setFilter({ months: filtered });
  };

  return (
    <div className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 space-y-2.5">
      {/* Row 1: Search + Type + quick ranges + more toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-36">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Sök..."
            value={filter.search}
            onChange={e => setFilter({ search: e.target.value })}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-blue-400"
          />
        </div>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {(['all', 'income', 'expense'] as const).map(t => (
            <button key={t} onClick={() => setFilter({ type: t })}
              className={`px-2.5 py-1.5 ${filter.type === t ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {t === 'all' ? 'Alla' : t === 'income' ? 'Inkomst' : 'Utgift'}
            </button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap">
          {[
            { label: '1 mån',  fn: () => setQuickRange(getRecentMonths(1)) },
            { label: '3 mån',  fn: () => setQuickRange(getRecentMonths(3)) },
            { label: 'I år',   fn: () => setQuickRange(getCurrentYearMonths()) },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn}
              className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setShowMore(v => !v)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border ${showMore ? 'border-blue-300 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            <SlidersHorizontal size={12} /> Filter
            {(filter.categories.length + filter.accounts.length + (filter.tags?.length ?? 0)) > 0 && (
              <span className="bg-blue-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                {filter.categories.length + filter.accounts.length + (filter.tags?.length ?? 0)}
              </span>
            )}
          </button>
          {hasFilter && (
            <button onClick={resetFilter}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">
              <X size={12} /> Rensa
            </button>
          )}
        </div>
      </div>

      {/* Month chips */}
      {availableMonths.length > 0 && (
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-[11px] text-gray-400 flex-shrink-0">Månad:</span>
          {availableMonths.map(m => (
            <button key={m} onClick={() => toggleMonth(m)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                filter.months.includes(m) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {formatMonth(m)}
            </button>
          ))}
        </div>
      )}

      {/* Expanded filters */}
      {showMore && (
        <div className="space-y-2 pt-1 border-t border-gray-50">
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[11px] text-gray-400 flex-shrink-0">Kategori:</span>
            {ALL_CATEGORIES.filter(c => c !== 'Överföring').map(cat => (
              <button key={cat} onClick={() => toggleCat(cat)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                  filter.categories.includes(cat as any)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {cat}
              </button>
            ))}
          </div>

          {accounts.length > 1 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-[11px] text-gray-400 flex-shrink-0">Konto:</span>
              {accounts.map(acc => (
                <button key={acc} onClick={() => toggleAccount(acc)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                    filter.accounts.includes(acc) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {acc}
                </button>
              ))}
            </div>
          )}

          {allTags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-[11px] text-gray-400 flex-shrink-0 flex items-center gap-1"><Tag size={10} /> Taggar:</span>
              {allTags.map(t => (
                <button key={t} onClick={() => toggleTag(t)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                    (filter.tags ?? []).includes(t) ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-center">
            <span className="text-[11px] text-gray-400 flex-shrink-0">Belopp:</span>
            <input type="number" placeholder="Min" value={filter.amountMin ?? ''}
              onChange={e => setFilter({ amountMin: e.target.value ? Number(e.target.value) : null })}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-400" />
            <span className="text-[11px] text-gray-400">–</span>
            <input type="number" placeholder="Max" value={filter.amountMax ?? ''}
              onChange={e => setFilter({ amountMax: e.target.value ? Number(e.target.value) : null })}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-400" />
            <span className="text-[11px] text-gray-400">kr</span>
          </div>
        </div>
      )}
    </div>
  );
}
