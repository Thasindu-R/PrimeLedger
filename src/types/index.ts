export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO string: "2026-05-06"
}

export interface MonthlySummary {
  month: string;
  income: number;
  expense: number;
}