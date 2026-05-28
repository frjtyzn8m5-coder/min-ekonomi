import type { Transaction, MonthData, FilterState } from '../types';
import { isIncomeCategory, isSavingsCategory } from './categorize';

export function getMonth(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

export function allMonths(txs: Transaction[]): string[] {
  return [...new Set(txs.map(t => getMonth(t.date)))].sort();
}

export function filterTxs(txs: Transaction[], f: FilterState): Transaction[] {
  return txs.filter(tx => {
    if (tx.isTransfer) return false;
    if (f.months.length && !f.months.includes(getMonth(tx.date))) return false;
    if (f.categories.length && !f.categories.includes(tx.category)) return false;
    if (f.accounts.length && !f.accounts.includes(tx.account)) return false;
    if (f.type === 'income' && tx.amount < 0) return false;
    if (f.type === 'expense' && tx.amount >= 0) return false;
    if (f.search && !tx.description.toLowerCase().includes(f.search.toLowerCase())) return false;
    if (f.amountMin !== null && Math.abs(tx.amount) < f.amountMin) return false;
    if (f.amountMax !== null && Math.abs(tx.amount) > f.amountMax) return false;
    return true;
  });
}

export function getMonthlyData(txs: Transaction[]): MonthData[] {
  const nonTransfer = txs.filter(t => !t.isTransfer);
  const months = allMonths(nonTransfer);
  return months.map(month => {
    const monthTxs = nonTransfer.filter(t => getMonth(t.date) === month);
    const byCategory: Record<string, number> = {};
    let income = 0;
    let expenses = 0;
    let savings = 0;
    for (const tx of monthTxs) {
      const key = tx.category;
      if (!byCategory[key]) byCategory[key] = 0;
      if (tx.amount >= 0) {
        income += tx.amount;
        byCategory[key] = (byCategory[key] || 0) + tx.amount;
      } else {
        const abs = Math.abs(tx.amount);
        if (isSavingsCategory(tx.category)) {
          savings += abs;
        } else {
          expenses += abs;
        }
        byCategory[key] = (byCategory[key] || 0) + abs;
      }
    }
    return { month, income, expenses, savings, cashflow: income - expenses - savings, byCategory };
  });
}

export function getCategoryTotals(txs: Transaction[], months?: string[]): Record<string, number> {
  const filtered = months?.length ? txs.filter(t => months.includes(getMonth(t.date))) : txs;
  const totals: Record<string, number> = {};
  for (const tx of filtered) {
    if (tx.isTransfer) continue;
    const key = tx.category;
    if (!totals[key]) totals[key] = 0;
    totals[key] += Math.abs(tx.amount);
  }
  return totals;
}

export function getAccountTotals(txs: Transaction[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const tx of txs) {
    if (!totals[tx.account]) totals[tx.account] = 0;
    totals[tx.account] += tx.amount;
  }
  return totals;
}

export function getSpendingCalendar(txs: Transaction[], year: number): Record<string, number> {
  const cal: Record<string, number> = {};
  for (const tx of txs) {
    if (tx.isTransfer || tx.amount >= 0) continue;
    if (!tx.date.startsWith(String(year))) continue;
    const day = tx.date;
    cal[day] = (cal[day] || 0) + Math.abs(tx.amount);
  }
  return cal;
}

export function getSankeyData(txs: Transaction[], month?: string): { nodes: string[]; links: {source: number; target: number; value: number}[] } {
  const filtered = txs.filter(t => !t.isTransfer && (!month || getMonth(t.date) === month));
  const incomeBySource: Record<string, number> = {};
  const expensesByCat: Record<string, number> = {};
  let totalIncome = 0;
  for (const tx of filtered) {
    if (tx.amount >= 0) {
      incomeBySource[tx.category] = (incomeBySource[tx.category] || 0) + tx.amount;
      totalIncome += tx.amount;
    } else {
      expensesByCat[tx.category] = (expensesByCat[tx.category] || 0) + Math.abs(tx.amount);
    }
  }
  const nodes = ['Totalt Inkomst', ...Object.keys(incomeBySource), ...Object.keys(expensesByCat)];
  const nodeIdx = (n: string) => nodes.indexOf(n);
  const links: {source: number; target: number; value: number}[] = [];
  for (const [cat, amt] of Object.entries(incomeBySource)) {
    links.push({ source: nodeIdx(cat), target: nodeIdx('Totalt Inkomst'), value: amt });
  }
  for (const [cat, amt] of Object.entries(expensesByCat)) {
    links.push({ source: nodeIdx('Totalt Inkomst'), target: nodeIdx(cat), value: amt });
  }
  return { nodes, links };
}

export function formatSEK(n: number, decimals = 0): string {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: decimals }).format(n);
}

export function formatMonth(m: string): string {
  const [y, mo] = m.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  return `${months[parseInt(mo) - 1]} ${y}`;
}

export function detectSubscriptions(txs: Transaction[]): Array<{description: string; amount: number; months: string[]}> {
  const monthly: Record<string, {months: Set<string>; amounts: number[]}> = {};
  for (const tx of txs) {
    if (tx.isTransfer || tx.amount >= 0) continue;
    const key = tx.description.toLowerCase().slice(0, 20);
    if (!monthly[key]) monthly[key] = { months: new Set(), amounts: [] };
    monthly[key].months.add(getMonth(tx.date));
    monthly[key].amounts.push(Math.abs(tx.amount));
  }
  return Object.entries(monthly)
    .filter(([, v]) => v.months.size >= 2)
    .map(([desc, v]) => ({
      description: desc,
      amount: v.amounts.reduce((a, b) => a + b, 0) / v.amounts.length,
      months: [...v.months].sort(),
    }))
    .sort((a, b) => b.amount - a.amount);
}
