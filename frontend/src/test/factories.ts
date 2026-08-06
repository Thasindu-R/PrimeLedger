import type { Category, Transaction, TransactionType } from '../types';
import { addDays, toIsoDate } from '../utils/dates';

let seq = 0;

/** Build a transaction with sane defaults so tests only state what they care about. */
export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `txn-${seq}`,
    type: 'expense' as TransactionType,
    category: 'Food' as Category,
    amount: 1000,
    date: '2026-08-01',
    description: `Transaction ${seq}`,
    ...overrides,
  };
}

export const STORAGE_KEY = 'finance_tracker_transactions';

export function seedStorage(transactions: Transaction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/** `YYYY-MM-DD` for a date offset from today — keeps tests independent of the clock. */
export function daysFromToday(offset: number): string {
  return toIsoDate(addDays(new Date(), offset));
}
