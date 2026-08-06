import { describe, it, expect } from 'vitest';
import { computePeriodDeltas, percentChange } from './periodComparison';
import { makeTransaction } from '../test/factories';

const NOW = new Date('2026-08-06T12:00:00Z');

describe('percentChange', () => {
  it('reports a real percentage when there is a previous figure', () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(90, 100)).toBe(-10);
  });

  it('returns null rather than Infinity when the previous period was zero', () => {
    expect(percentChange(500, 0)).toBeNull();
  });

  it('returns null rather than NaN when both periods are zero', () => {
    expect(percentChange(0, 0)).toBeNull();
  });

  it('rounds to one decimal place', () => {
    expect(percentChange(1234, 1000)).toBe(23.4);
  });
});

describe('computePeriodDeltas (D-05)', () => {
  it('compares this month against last month rather than inventing a figure', () => {
    const deltas = computePeriodDeltas(
      [
        makeTransaction({ type: 'income', amount: 1000, date: '2026-07-10' }),
        makeTransaction({ type: 'expense', amount: 500, date: '2026-07-11' }),
        makeTransaction({ type: 'income', amount: 1500, date: '2026-08-02' }),
        makeTransaction({ type: 'expense', amount: 250, date: '2026-08-03' }),
      ],
      NOW,
    );

    expect(deltas.income).toBe(50); // 1000 -> 1500
    expect(deltas.expense).toBe(-50); // 500 -> 250
    expect(deltas.balance).toBe(150); // 500 -> 1250
  });

  it('reports null deltas when there is no prior month to compare against', () => {
    const deltas = computePeriodDeltas(
      [makeTransaction({ type: 'income', amount: 1500, date: '2026-08-02' })],
      NOW,
    );

    expect(deltas.income).toBeNull();
    expect(deltas.expense).toBeNull();
    expect(deltas.balance).toBeNull();
  });

  it('rolls the comparison window across a year boundary', () => {
    const deltas = computePeriodDeltas(
      [
        makeTransaction({ type: 'income', amount: 200, date: '2025-12-20' }),
        makeTransaction({ type: 'income', amount: 300, date: '2026-01-05' }),
      ],
      new Date('2026-01-15T00:00:00Z'),
    );

    expect(deltas.income).toBe(50);
  });

  it('ignores months either side of the two-month window', () => {
    const deltas = computePeriodDeltas(
      [
        makeTransaction({ type: 'income', amount: 9999, date: '2026-05-01' }),
        makeTransaction({ type: 'income', amount: 1000, date: '2026-07-10' }),
        makeTransaction({ type: 'income', amount: 1000, date: '2026-08-10' }),
      ],
      NOW,
    );

    expect(deltas.income).toBe(0);
  });
});
