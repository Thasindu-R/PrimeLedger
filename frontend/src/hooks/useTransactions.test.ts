import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTransactions } from './useTransactions';
import { makeTransaction, seedStorage, STORAGE_KEY } from '../test/factories';

describe('useTransactions persistence', () => {
  it('loads what is already in storage', () => {
    seedStorage([makeTransaction({ description: 'Rent' })]);

    const { result } = renderHook(() => useTransactions());

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].description).toBe('Rent');
  });

  it('survives corrupt storage rather than crashing the app', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');

    const { result } = renderHook(() => useTransactions());

    expect(result.current.transactions).toEqual([]);
  });
});

describe('useTransactions CRUD', () => {
  it('adds a transaction with a generated id', () => {
    const { result } = renderHook(() => useTransactions());

    act(() =>
      result.current.addTransaction({
        type: 'income',
        category: 'Salary',
        amount: 100,
        date: '2026-08-01',
        description: 'Pay',
      }),
    );

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].id).toBeTruthy();
  });

  it('edits an existing transaction in place (D-07)', () => {
    seedStorage([makeTransaction({ id: 'fixed', amount: 100 })]);
    const { result } = renderHook(() => useTransactions());

    act(() => result.current.editTransaction('fixed', { amount: 250 }));

    expect(result.current.transactions[0].amount).toBe(250);
    expect(result.current.transactions[0].id).toBe('fixed');
  });

  it('deletes and clears', () => {
    seedStorage([makeTransaction({ id: 'a' }), makeTransaction({ id: 'b' })]);
    const { result } = renderHook(() => useTransactions());

    act(() => result.current.deleteTransaction('a'));
    expect(result.current.transactions.map((t) => t.id)).toEqual(['b']);

    act(() => result.current.clearAll());
    expect(result.current.transactions).toEqual([]);
  });
});

describe('useTransactions sorting (D-04)', () => {
  it('applies a sort config supplied wholesale by the sort control', () => {
    seedStorage([
      makeTransaction({ id: 'small', amount: 10 }),
      makeTransaction({ id: 'large', amount: 900 }),
    ]);
    const { result } = renderHook(() => useTransactions());

    act(() => result.current.setSort({ field: 'amount', order: 'desc' }));

    expect(result.current.sortedTransactions.map((t) => t.id)).toEqual([
      'large',
      'small',
    ]);

    act(() => result.current.setSort({ field: 'amount', order: 'asc' }));

    expect(result.current.sortedTransactions.map((t) => t.id)).toEqual([
      'small',
      'large',
    ]);
  });

  it('still toggles order when the same column header is clicked twice', () => {
    seedStorage([
      makeTransaction({ id: 'old', date: '2026-01-01' }),
      makeTransaction({ id: 'new', date: '2026-08-01' }),
    ]);
    const { result } = renderHook(() => useTransactions());

    // Default is date/desc, so the first click on the Date header flips to asc.
    act(() => result.current.updateSort('date'));
    expect(result.current.sortedTransactions[0].id).toBe('old');

    act(() => result.current.updateSort('date'));
    expect(result.current.sortedTransactions[0].id).toBe('new');
  });
});

describe('useTransactions filtering', () => {
  it('filters by type, search term and amount range', () => {
    seedStorage([
      makeTransaction({ id: 'a', type: 'income', amount: 500, description: 'Salary run' }),
      makeTransaction({ id: 'b', type: 'expense', amount: 50, description: 'Coffee' }),
      makeTransaction({ id: 'c', type: 'expense', amount: 5000, description: 'Laptop' }),
    ]);
    const { result } = renderHook(() => useTransactions());

    act(() => result.current.updateFilters({ type: 'expense' }));
    expect(result.current.filteredTransactions.map((t) => t.id)).toEqual(['b', 'c']);

    act(() => result.current.updateFilters({ minAmount: 100 }));
    expect(result.current.filteredTransactions.map((t) => t.id)).toEqual(['c']);

    act(() => result.current.resetFilters());
    expect(result.current.filteredTransactions).toHaveLength(3);

    act(() => result.current.updateFilters({ search: 'coffee' }));
    expect(result.current.filteredTransactions.map((t) => t.id)).toEqual(['b']);
  });
});

describe('useTransactions summaries', () => {
  it('sums income, expense and balance', () => {
    seedStorage([
      makeTransaction({ type: 'income', amount: 1000 }),
      makeTransaction({ type: 'expense', amount: 400 }),
    ]);
    const { result } = renderHook(() => useTransactions());

    expect(result.current.summary).toEqual({
      totalIncome: 1000,
      totalExpense: 400,
      balance: 600,
    });
  });

  it('builds a category breakdown that sums to 100 percent', () => {
    seedStorage([
      makeTransaction({ type: 'expense', category: 'Food', amount: 750 }),
      makeTransaction({ type: 'expense', category: 'Transport', amount: 250 }),
    ]);
    const { result } = renderHook(() => useTransactions());

    expect(result.current.expenseByCategory).toEqual([
      { category: 'Food', total: 750, count: 1, percentage: 75 },
      { category: 'Transport', total: 250, count: 1, percentage: 25 },
    ]);
  });
});
