import type { Account, Transaction, TransactionType } from '../types';
import { addDays, toIsoDate } from '../utils/dates';

let seq = 0;

/** Build a transaction with sane defaults so tests only state what they care about. */
export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `txn-${seq}`,
    type: 'expense' as TransactionType,
    category: 'Food',
    // Stable and derived from the name, so a test that cares about the id can
    // predict it and one that does not can ignore it.
    categoryId: `cat-${(overrides.category ?? 'Food').toLowerCase()}`,
    accountId: 'acc-1',
    isTransfer: false,
    amount: 1000,
    date: '2026-08-01',
    description: `Transaction ${seq}`,
    ...overrides,
  };
}

/** Build an account with sane defaults, for the tests that need a real one. */
export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    name: 'Everyday',
    type: 'CHECKING',
    currency: 'USD',
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    transactionCount: 0,
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
