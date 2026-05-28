export type TransactionType = 'income' | 'expense' | 'transfer' | 'investment';

export type Category =
  | 'Lön' | 'CSN Bidrag' | 'CSN Lån' | 'Investeringsvinst' | 'Övrigt Inkomst'
  | 'Mat' | 'Restaurang' | 'Transport' | 'Boende' | 'Telefon' | 'Streaming'
  | 'Kläder' | 'Hälsa' | 'Aktiviteter' | 'Handel' | 'Resor' | 'Sparande'
  | 'Investering' | 'Övrigt Utgift' | 'Överföring';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: Category;
  account: string;
  type: TransactionType;
  isTransfer: boolean;
  tags?: string[];
  source: 'seb_csv' | 'seb_xlsx' | 'avanza' | 'klarna' | 'csn' | 'manual';
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'credit';
  balance: number;
  color: string;
}

export interface BudgetGoal {
  category: Category;
  limit: number;
}

export interface AssetSnapshot {
  month: string;
  cash: number;
  avanza: number;
  crypto: number;
  sparkonto: number;
  other: number;
}

export interface DebtSnapshot {
  month: string;
  csn: number;
  klarna: number;
  other: number;
}

export interface MonthData {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  cashflow: number;
  byCategory: Record<string, number>;
}

export interface Reminder {
  id: string;
  title: string;
  emoji: string;
  // dayOfMonth: 1-28 = specifik dag, -1 = sista vardag, -2 = näst sista vardag
  dayOfMonth: number;
  time: string; // HH:MM
  active: boolean;
  lastSentMonth?: string; // YYYY-MM – håller koll på att inte skicka dubbelt
}

export type Page = 'overview' | 'transactions' | 'analytics' | 'budget' | 'networth' | 'import' | 'reminders';

export interface FilterState {
  months: string[];
  categories: Category[];
  accounts: string[];
  type: 'all' | 'income' | 'expense';
  search: string;
  amountMin: number | null;
  amountMax: number | null;
  tags: string[];
}

export interface ImportBatch {
  id: string;
  filename: string;
  uploadedAt: number;
  txCount: number;
  dateFrom: string;
  dateTo: string;
  account: string;
}
