import type { Transaction } from '../types';

const HEADERS = ['Date', 'Description', 'Category', 'Type', 'Amount'];

/** Quotes a field only when it would otherwise break the row, doubling any quotes. */
function escapeField(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Serialises transactions to CSV. The previous inline versions joined on commas
 * with no quoting, so any description containing a comma silently shifted every
 * column after it. FR-31 moves generation server-side; until then this is the
 * one implementation both export buttons share.
 */
export function transactionsToCsv(transactions: Transaction[]): string {
  const rows = transactions.map((t) => [
    t.date,
    t.description ?? '',
    t.category,
    t.type,
    t.amount.toFixed(2),
  ]);

  return [HEADERS, ...rows]
    .map((row) => row.map(escapeField).join(','))
    .join('\n');
}

/** Triggers a browser download of the given CSV text. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportFilename(now: Date = new Date()): string {
  return `transactions_${now.toISOString().split('T')[0]}.csv`;
}
