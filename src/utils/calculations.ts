import type { Transaction, MonthData, FilterState, Gender, ActivityLevel, PrimaryGoal } from '../types';

// ── BMR / TDEE / Makromål (Sprint 0) ─────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  highly_active: 1.725,
  very_highly_active: 1.9,
}

export function calculateBMR(weight: number, height: number, age: number, gender: Gender): number {
  const base = 10 * weight + 6.25 * height - 5 * age
  return gender === 'male' ? base + 5 : base - 161
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel])
}

export interface MacroTargets {
  dailyCalorieTarget: number
  proteinTargetG: number
  fatTargetG: number
  carbTargetG: number
}

/**
 * Beräknar dagliga makromål baserat på kroppsstatus och mål.
 * Utökas i Sprint 4 med fullständig algoritm.
 */
export function calculateMacroTargets(
  tdee: number,
  weight: number,
  primaryGoal: PrimaryGoal,
  weeklyWeightChangeTarget?: number,
): MacroTargets {
  // Kalorideficit/surplus baserat på mål
  const weeklyKcalPerKg = 7700 // kcal per kg kroppsvikt
  let calorieDelta = 0

  if (weeklyWeightChangeTarget !== undefined && weeklyWeightChangeTarget !== 0) {
    calorieDelta = Math.round((weeklyWeightChangeTarget * weeklyKcalPerKg) / 7)
  } else {
    // Defaults per mål
    if (primaryGoal === 'lose_fat')      calorieDelta = -500
    else if (primaryGoal === 'gain_muscle') calorieDelta = 250
    else if (primaryGoal === 'recomp')   calorieDelta = -200
    // maintain / general_health → 0
  }

  const dailyCalorieTarget = Math.max(1200, Math.round(tdee + calorieDelta))

  // Protein: 2.2 g/kg kroppsvikt (högt för body recomp/fettförlust)
  const proteinTargetG = Math.round(weight * 2.2)
  // Fett: 25% av kalorier
  const fatTargetG = Math.round((dailyCalorieTarget * 0.25) / 9)
  // Kolhydrater: resten
  const proteinKcal = proteinTargetG * 4
  const fatKcal = fatTargetG * 9
  const carbTargetG = Math.max(0, Math.round((dailyCalorieTarget - proteinKcal - fatKcal) / 4))

  return { dailyCalorieTarget, proteinTargetG, fatTargetG, carbTargetG }
}

export function getAgeFromBirthDate(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// ─────────────────────────────────────────────────────────────────────────────
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
    if (f.dateFrom && tx.date < f.dateFrom) return false;
    if (f.dateTo && tx.date > f.dateTo) return false;
    if (f.categories.length && !f.categories.includes(tx.category)) return false;
    if (f.accounts.length && !f.accounts.includes(tx.account)) return false;
    if (f.type === 'income' && tx.amount < 0) return false;
    if (f.type === 'expense' && tx.amount >= 0) return false;
    if (f.search && !tx.description.toLowerCase().includes(f.search.toLowerCase())) return false;
    if (f.amountMin !== null && Math.abs(tx.amount) < f.amountMin) return false;
    if (f.amountMax !== null && Math.abs(tx.amount) > f.amountMax) return false;
    if (f.tags?.length && !f.tags.some(tag => tx.tags?.includes(tag))) return false;
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
