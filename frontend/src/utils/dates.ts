/**
 * Calendar-date helpers. Transaction dates are plain `YYYY-MM-DD` strings, not
 * instants, so "today" is read from local calendar fields — `toISOString()`
 * would return the UTC day and be off by one for most of the day in Asia/Colombo.
 */

export function toIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function today(now: Date = new Date()): string {
  return toIsoDate(now);
}

/**
 * The latest date a transaction may carry. One day of slack matches the server
 * rule in FR-12 (`occurred_on <= CURRENT_DATE + 1`) so a post-dated entry made
 * near midnight is not rejected.
 */
export function maxTransactionDate(now: Date = new Date()): string {
  return toIsoDate(addDays(now, 1));
}

export const MIN_TRANSACTION_DATE = '1900-01-01';

export type DateValidity = 'ok' | 'missing' | 'malformed' | 'too-far-future' | 'too-old';

export function validateTransactionDate(
  value: string,
  now: Date = new Date(),
): DateValidity {
  if (!value) return 'missing';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'malformed';
  if (Number.isNaN(new Date(`${value}T00:00:00`).getTime())) return 'malformed';
  if (value > maxTransactionDate(now)) return 'too-far-future';
  if (value < MIN_TRANSACTION_DATE) return 'too-old';
  return 'ok';
}

export const DATE_ERROR_MESSAGES: Record<Exclude<DateValidity, 'ok'>, string> = {
  missing: 'Please choose a date',
  malformed: 'Please enter a valid date',
  'too-far-future': 'Date cannot be more than one day in the future',
  'too-old': 'Date must be on or after 1 January 1900',
};
