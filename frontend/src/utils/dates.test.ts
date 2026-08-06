import { describe, it, expect } from 'vitest';
import {
  addDays,
  maxTransactionDate,
  toIsoDate,
  validateTransactionDate,
} from './dates';

describe('toIsoDate', () => {
  it('formats from local calendar fields, not the UTC instant', () => {
    // 1 March 00:30 local is still 28 February in UTC for any positive offset.
    const local = new Date(2026, 2, 1, 0, 30);
    expect(toIsoDate(local)).toBe('2026-03-01');
  });

  it('zero-pads month and day', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('rolls over a month boundary', () => {
    expect(toIsoDate(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });

  it('does not mutate its argument', () => {
    const original = new Date(2026, 0, 31);
    addDays(original, 5);
    expect(toIsoDate(original)).toBe('2026-01-31');
  });
});

describe('validateTransactionDate (D-09)', () => {
  const now = new Date(2026, 7, 6);

  it('accepts today and yesterday', () => {
    expect(validateTransactionDate('2026-08-06', now)).toBe('ok');
    expect(validateTransactionDate('2026-08-05', now)).toBe('ok');
  });

  it('accepts tomorrow, matching the server rule', () => {
    expect(validateTransactionDate('2026-08-07', now)).toBe('ok');
    expect(maxTransactionDate(now)).toBe('2026-08-07');
  });

  it('rejects the day after tomorrow', () => {
    expect(validateTransactionDate('2026-08-08', now)).toBe('too-far-future');
  });

  it('rejects the year 3000', () => {
    expect(validateTransactionDate('3000-01-01', now)).toBe('too-far-future');
  });

  it('rejects an implausibly old date', () => {
    expect(validateTransactionDate('1899-12-31', now)).toBe('too-old');
  });

  it('rejects an empty or malformed value', () => {
    expect(validateTransactionDate('', now)).toBe('missing');
    expect(validateTransactionDate('06/08/2026', now)).toBe('malformed');
    expect(validateTransactionDate('not-a-date', now)).toBe('malformed');
  });

  it('accepts an overflowing day, which the browser date picker cannot produce anyway', () => {
    // JS rolls 31 February forward to 3 March rather than failing.
    expect(validateTransactionDate('2026-02-31', now)).toBe('ok');
  });
});
