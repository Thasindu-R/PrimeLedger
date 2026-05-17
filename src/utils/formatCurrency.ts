/**
 * Formats a number as Sri Lankan Rupees.
 * @example formatCurrency(50000) → "Rs. 50,000.00"
 */
export function formatCurrency(amount: number): string {
  const formatted = Math.abs(amount)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return amount < 0 ? `-Rs. ${formatted}` : `Rs. ${formatted}`;
}

/**
 * Converts an ISO date string to a human-readable format.
 * @example formatDate("2026-05-12") → "12 May 2026"
 */
export function formatDate(dateStr: string): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);

  const monthName = months[monthIndex] ?? '';
  // Short month: first 3 chars
  return `${day} ${monthName.slice(0, 3)} ${year}`;
}
