import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { allMonths } from '../../utils/calculations';
import { ALL_CATEGORIES } from '../../utils/categorize';
import { formatMonth } from '../../utils/calculations';
import { X, Search, SlidersHorizontal, Tag, ChevronDown, Calendar } from 'lucide-react';

const MONTHS_DEFAULT_SHOW = 6;

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
  const [showAllMonths, setShowAllMonths] = useState(false);

  const availableMonths = allMonths(transactions);
  const accounts = [...new Set(transactions.map(t => t.account))].sort();
  const allTags = [...new Set(transactions.flatMap(t => t.tags ?? []))].sort();

  const hasFilter = filter.months.length || filter.categories.length ||
    filter.accounts.length || filter.type !== 'all' || filter.search ||
    filter.amountMin !== null || filter.amountMax !== null || filter.tags?.length ||
    filter.dateFrom || filter.dateTo;

  const visibleMonths = showAllMonths
    ? availableMonths
    : availableMonths.slice(-MONTHS_DEFAULT_SHOW);

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
    <div className="bg-panel border-b border-line px-4 lg:px-6 py-3 space-y-2.5">
      {/* Row 1: Search + Type + quick ranges + more toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-36">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="text"
            placeholder="Sök..."
            value={filter.search}
            onChange={e => setFilter({ search: e.target.value })}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-soft text-ink rounded-lg border border-line outline-none focus:border-gold/50"
          />
        </div>

        <div className="flex rounded-lg border border-line overflow-hidden text-xs font-medium">
          {(['all', 'income', 'expense'] as const).map(t => (
            <button key={t} onClick={() => setFilter({ type: t })}
              className={`px-2.5 py-1.5 ${filter.type === t ? 'text-[#2a1d08]' : 'bg-card text-mut hover:bg-soft'}`}
              style={filter.type === t ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}>
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
              className="px-2.5 py-1.5 text-xs font-medium bg-soft text-mut rounded-lg hover:bg-card">
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setShowMore(v => !v)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border ${showMore ? 'text-gold' : 'border-line text-mut hover:bg-soft'}`}
            style={showMore ? { borderColor: 'rgba(233,193,120,.5)', background: 'rgba(233,193,120,.12)' } : undefined}>
            <SlidersHorizontal size={12} /> Filter
            {(filter.categories.length + filter.accounts.length + (filter.tags?.length ?? 0)) > 0 && (
              <span className="text-[#2a1d08] rounded-full w-4 h-4 text-[10px] flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }}>
                {filter.categories.length + filter.accounts.length + (filter.tags?.length ?? 0)}
              </span>
            )}
          </button>
          {hasFilter && (
            <button onClick={resetFilter}
              className="flex items-center gap-1 text-xs text-faint hover:text-ink px-2 py-1.5">
              <X size={12} /> Rensa
            </button>
          )}
        </div>
      </div>

      {/* Month chips */}
      {availableMonths.length > 0 && (
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-[11px] text-faint flex-shrink-0">Månad:</span>
          {availableMonths.length > MONTHS_DEFAULT_SHOW && !showAllMonths && (
            <button onClick={() => setShowAllMonths(true)}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-soft text-faint hover:bg-card flex items-center gap-0.5">
              +{availableMonths.length - MONTHS_DEFAULT_SHOW} <ChevronDown size={10} />
            </button>
          )}
          {visibleMonths.map(m => (
            <button key={m} onClick={() => toggleMonth(m)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                filter.months.includes(m) ? 'text-[#2a1d08]' : 'bg-soft text-mut hover:bg-card'
              }`}
              style={filter.months.includes(m) ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}>
              {formatMonth(m)}
            </button>
          ))}
          {showAllMonths && availableMonths.length > MONTHS_DEFAULT_SHOW && (
            <button onClick={() => setShowAllMonths(false)}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-soft text-faint hover:bg-card">
              Visa färre
            </button>
          )}
        </div>
      )}

      {/* Expanded filters */}
      {showMore && (
        <div className="space-y-2 pt-1 border-t border-line">
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[11px] text-faint flex-shrink-0">Kategori:</span>
            {ALL_CATEGORIES.filter(c => c !== 'Överföring').map(cat => (
              <button key={cat} onClick={() => toggleCat(cat)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                  filter.categories.includes(cat as any)
                    ? 'text-[#2a1d08]'
                    : 'bg-soft text-mut hover:bg-card'
                }`}
                style={filter.categories.includes(cat as any) ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}>
                {cat}
              </button>
            ))}
          </div>

          {accounts.length > 1 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-[11px] text-faint flex-shrink-0">Konto:</span>
              {accounts.map(acc => (
                <button key={acc} onClick={() => toggleAccount(acc)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                    filter.accounts.includes(acc) ? 'text-[#2a1d08]' : 'bg-soft text-mut hover:bg-card'
                  }`}
                  style={filter.accounts.includes(acc) ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' } : undefined}>
                  {acc}
                </button>
              ))}
            </div>
          )}

          {allTags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-[11px] text-faint flex-shrink-0 flex items-center gap-1"><Tag size={10} /> Taggar:</span>
              {allTags.map(t => (
                <button key={t} onClick={() => toggleTag(t)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                    (filter.tags ?? []).includes(t) ? 'text-[#2a1d08]' : 'text-gold hover:bg-card'
                  }`}
                  style={(filter.tags ?? []).includes(t)
                    ? { background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)' }
                    : { background: 'rgba(233,193,120,.12)' }}>
                  {t}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-[11px] text-faint flex-shrink-0 flex items-center gap-1"><Calendar size={10} /> Datum:</span>
            <input type="date" value={filter.dateFrom ?? ''}
              onChange={e => setFilter({ dateFrom: e.target.value || null, months: [] })}
              className="bg-soft text-ink border border-line rounded-lg px-2 py-1 text-xs outline-none focus:border-gold/50" />
            <span className="text-[11px] text-faint">–</span>
            <input type="date" value={filter.dateTo ?? ''}
              onChange={e => setFilter({ dateTo: e.target.value || null, months: [] })}
              className="bg-soft text-ink border border-line rounded-lg px-2 py-1 text-xs outline-none focus:border-gold/50" />
          </div>

          <div className="flex gap-2 items-center">
            <span className="text-[11px] text-faint flex-shrink-0">Belopp:</span>
            <input type="number" placeholder="Min" value={filter.amountMin ?? ''}
              onChange={e => setFilter({ amountMin: e.target.value ? Number(e.target.value) : null })}
              className="w-20 bg-soft text-ink border border-line rounded-lg px-2 py-1 text-xs outline-none focus:border-gold/50" />
            <span className="text-[11px] text-faint">–</span>
            <input type="number" placeholder="Max" value={filter.amountMax ?? ''}
              onChange={e => setFilter({ amountMax: e.target.value ? Number(e.target.value) : null })}
              className="w-20 bg-soft text-ink border border-line rounded-lg px-2 py-1 text-xs outline-none focus:border-gold/50" />
            <span className="text-[11px] text-faint">kr</span>
          </div>
        </div>
      )}
    </div>
  );
}
