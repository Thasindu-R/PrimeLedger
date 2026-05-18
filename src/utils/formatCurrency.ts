export function formatCurrency(amount: number): string {
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatted = formatter.format(amount);
  return `Rs. ${formatted}`;
}

export function formatCurrencyParts(amount: number): { whole: string; decimal: string } {
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatted = formatter.format(amount);
  const parts = formatted.split('.');
  return {
    whole: `Rs. ${parts[0]}`,
    decimal: `.${parts[1] || '00'}`,
  };
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
