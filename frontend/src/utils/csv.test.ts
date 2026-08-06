import { describe, it, expect } from 'vitest';
import { transactionsToCsv } from './csv';
import { makeTransaction } from '../test/factories';

describe('transactionsToCsv', () => {
  it('writes a header row followed by one row per transaction', () => {
    const csv = transactionsToCsv([
      makeTransaction({
        date: '2026-08-01',
        description: 'Groceries',
        category: 'Food',
        type: 'expense',
        amount: 1250.5,
      }),
    ]);

    expect(csv.split('\n')).toEqual([
      'Date,Description,Category,Type,Amount',
      '2026-08-01,Groceries,Food,expense,1250.50',
    ]);
  });

  it('quotes a description containing a comma so columns do not shift', () => {
    const csv = transactionsToCsv([
      makeTransaction({ description: 'Coffee, pastry and a tip' }),
    ]);

    expect(csv).toContain('"Coffee, pastry and a tip"');
  });

  it('escapes embedded quotes by doubling them', () => {
    const csv = transactionsToCsv([
      makeTransaction({ description: 'Bought a 24" monitor' }),
    ]);

    expect(csv).toContain('"Bought a 24"" monitor"');
  });

  it('quotes a description containing a newline', () => {
    const csv = transactionsToCsv([
      makeTransaction({ description: 'Line one\nLine two' }),
    ]);

    expect(csv).toContain('"Line one\nLine two"');
  });

  it('writes an empty field for a missing description', () => {
    const csv = transactionsToCsv([
      makeTransaction({ date: '2026-08-01', description: undefined, amount: 10 }),
    ]);

    expect(csv.split('\n')[1]).toBe('2026-08-01,,Food,expense,10.00');
  });
});
