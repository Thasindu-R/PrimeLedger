import type { Transaction } from '../types';
import { monthKey } from './timeSeries';

export interface PeriodDeltas {
  /** Percentage change vs the previous month, or null when there is nothing to compare. */
  income: number | null;
  expense: number | null;
  balance: number | null;
}

/**
 * Percentage change from `previous` to `current`, to one decimal place.
 * Returns null when `previous` is zero — a jump from nothing is not a
 * percentage, and presenting one would be the same dishonesty as D-05.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function totalsForMonth(transactions: Transaction[], key: string) {
  let income = 0;
  let expense = 0;
  for (const transaction of transactions) {
    if (monthKey(transaction.date) !== key) continue;
    if (transaction.type === 'income') {
      income += transaction.amount;
    } else {
      expense += transaction.amount;
    }
  }
  return { income, expense, balance: income - expense };
}

function keyFor(year: number, monthIndex: number): string {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Real month-over-month deltas, replacing the hard-coded 6.7 / 9.8 / -8.6 / 8.7
 * literals the UI used to present as fact (D-05). FR-25 moves this server-side.
 */
export function computePeriodDeltas(
  transactions: Transaction[],
  now: Date = new Date(),
): PeriodDeltas {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const current = totalsForMonth(transactions, keyFor(year, month));
  const previous = totalsForMonth(transactions, keyFor(year, month - 1));

  return {
    income: percentChange(current.income, previous.income),
    expense: percentChange(current.expense, previous.expense),
    balance: percentChange(current.balance, previous.balance),
  };
}

/** Mean monthly total across the months that actually have activity. */
export function averagePerActiveMonth(values: { income: number; expense: number }[]) {
  const active = values.filter((v) => v.income > 0 || v.expense > 0);
  if (active.length === 0) return { income: 0, expense: 0 };
  return {
    income: active.reduce((sum, v) => sum + v.income, 0) / active.length,
    expense: active.reduce((sum, v) => sum + v.expense, 0) / active.length,
  };
}
