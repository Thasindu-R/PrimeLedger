import type { Transaction } from '../types';

export interface MonthlyPoint {
  /** `YYYY-MM` — the bucket identity, unique across years. */
  key: string;
  /** Short display label, carrying a year only when the window needs one. */
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface MonthlySeriesOptions {
  /** How many months the window covers, ending with the month containing `now`. */
  months?: number;
  now?: Date;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * `YYYY-MM` for an ISO `YYYY-MM-DD` date. Taken from the string rather than a
 * Date, because `new Date('2026-03-01')` is UTC midnight and reads as February
 * in any negative-offset timezone.
 */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/**
 * Buckets transactions by `YYYY-MM` over an explicit window (D-02). The previous
 * implementation grouped on `getMonth()` alone, which summed January 2025 into
 * January 2026.
 */
export function buildMonthlySeries(
  transactions: Transaction[],
  { months = 12, now = new Date() }: MonthlySeriesOptions = {},
): MonthlyPoint[] {
  const windowSize = Math.max(1, Math.trunc(months));
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth();

  const buckets = new Map<string, MonthlyPoint>();
  const ordered: MonthlyPoint[] = [];

  for (let offset = windowSize - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(endYear, endMonth - offset, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const point: MonthlyPoint = {
      key,
      month: MONTH_NAMES[month],
      income: 0,
      expense: 0,
      net: 0,
    };
    buckets.set(key, point);
    ordered.push(point);
  }

  for (const transaction of transactions) {
    const point = buckets.get(monthKey(transaction.date));
    if (!point) continue;
    if (transaction.type === 'income') {
      point.income += transaction.amount;
    } else {
      point.expense += transaction.amount;
    }
  }

  const spansMultipleYears = new Set(ordered.map((p) => p.key.slice(0, 4))).size > 1;

  for (const point of ordered) {
    point.net = point.income - point.expense;
    if (spansMultipleYears) {
      point.month = `${point.month} ${point.key.slice(2, 4)}`;
    }
  }

  return ordered;
}
