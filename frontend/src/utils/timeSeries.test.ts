import { describe, it, expect } from 'vitest';
import { buildMonthlySeries } from './timeSeries';
import { makeTransaction } from '../test/factories';

const NOW = new Date('2026-08-06T12:00:00Z');

describe('buildMonthlySeries (D-02)', () => {
  it('keeps the same month of different years in separate buckets', () => {
    const series = buildMonthlySeries(
      [
        makeTransaction({ type: 'income', amount: 100, date: '2025-01-15' }),
        makeTransaction({ type: 'income', amount: 700, date: '2026-01-15' }),
      ],
      { months: 24, now: NOW },
    );

    const jan2025 = series.find((p) => p.key === '2025-01');
    const jan2026 = series.find((p) => p.key === '2026-01');

    expect(jan2025?.income).toBe(100);
    expect(jan2026?.income).toBe(700);
  });

  it('returns an explicit contiguous window ending with the current month', () => {
    const series = buildMonthlySeries([], { months: 3, now: NOW });

    expect(series.map((p) => p.key)).toEqual(['2026-06', '2026-07', '2026-08']);
  });

  it('splits income from expense within a bucket', () => {
    const series = buildMonthlySeries(
      [
        makeTransaction({ type: 'income', amount: 5000, date: '2026-08-02' }),
        makeTransaction({ type: 'expense', amount: 1200, date: '2026-08-03' }),
        makeTransaction({ type: 'expense', amount: 800, date: '2026-08-04' }),
      ],
      { months: 1, now: NOW },
    );

    expect(series).toEqual([
      expect.objectContaining({ key: '2026-08', income: 5000, expense: 2000, net: 3000 }),
    ]);
  });

  it('ignores transactions outside the requested window', () => {
    const series = buildMonthlySeries(
      [makeTransaction({ type: 'income', amount: 999, date: '2024-03-01' })],
      { months: 3, now: NOW },
    );

    expect(series.reduce((sum, p) => sum + p.income, 0)).toBe(0);
  });

  it('labels months without a year while the window stays inside one calendar year', () => {
    const series = buildMonthlySeries([], { months: 3, now: NOW });

    expect(series.map((p) => p.month)).toEqual(['Jun', 'Jul', 'Aug']);
  });

  it('disambiguates labels with a year once the window spans a year boundary', () => {
    const series = buildMonthlySeries([], { months: 3, now: new Date('2026-01-15T00:00:00Z') });

    expect(series.map((p) => p.month)).toEqual(['Nov 25', 'Dec 25', 'Jan 26']);
  });

  it('does not read the local-time month, which shifts dates near month boundaries', () => {
    // '2026-03-01' parsed as UTC midnight is 28 Feb in any negative-offset zone.
    const series = buildMonthlySeries(
      [makeTransaction({ type: 'expense', amount: 50, date: '2026-03-01' })],
      { months: 8, now: NOW },
    );

    expect(series.find((p) => p.key === '2026-03')?.expense).toBe(50);
    expect(series.find((p) => p.key === '2026-02')?.expense).toBe(0);
  });
});
