import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryHarness } from '../test/queryHarness';
import { useTransactions } from './useTransactions';
import { makeAccount, makeTransaction } from '../test/factories';
import type { Page } from '../api/transactions';
import type { Transaction } from '../types';
import { ApiError } from '../api/client';

vi.mock('../api/transactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/transactions')>();
  return {
    ...actual,
    listTransactions: vi.fn(),
    createTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    bulkDeleteTransactions: vi.fn(),
  };
});
vi.mock('../api/accounts');
vi.mock('../api/categories');
vi.mock('../api/analytics');

import {
  createTransaction,
  listTransactions,
  updateTransaction,
} from '../api/transactions';
import { ensureDefaultAccount } from '../api/accounts';
import { listCategories } from '../api/categories';
import { fetchSummary } from '../api/analytics';

const showToast = vi.fn();

function page(items: Transaction[], overrides: Partial<Page<Transaction>> = {}): Page<Transaction> {
  return {
    items,
    page: 0,
    size: 25,
    totalElements: items.length,
    totalPages: 1,
    first: true,
    last: true,
    ...overrides,
  };
}

const GROCERIES = 'cat-groceries';

beforeEach(() => {
  vi.mocked(ensureDefaultAccount).mockResolvedValue(makeAccount());
  vi.mocked(listCategories).mockResolvedValue([
    { id: GROCERIES, name: 'Groceries', kind: 'expense', system: true, sortOrder: 1 },
    { id: 'cat-salary', name: 'Salary', kind: 'income', system: true, sortOrder: 0 },
  ]);
  vi.mocked(fetchSummary).mockResolvedValue({
    totals: { totalIncome: 5000, totalExpense: 2000, balance: 3000 },
    count: 42,
    highestExpense: 900,
    byCategory: [
      {
        categoryId: GROCERIES,
        category: 'Groceries',
        type: 'expense',
        total: 2000,
        count: 4,
      },
    ],
    monthly: [],
  });
  vi.mocked(listTransactions).mockResolvedValue(page([makeTransaction()]));
});

function render() {
  return renderHook(() => useTransactions({ showToast }), { wrapper: QueryHarness });
}

describe('useTransactions', () => {
  it('reads the current page from the server rather than local storage', async () => {
    const { result } = render();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.transactions).toHaveLength(1);
    expect(listTransactions).toHaveBeenCalled();
    expect(localStorage.getItem('finance_tracker_transactions')).toBeNull();
  });

  it('takes the totals from the summary endpoint, not from the rows on screen', async () => {
    // The page holds one 1000 expense. Summing it would give 1000 / 0 / -1000.
    // The ledger actually holds far more, and this is the whole reason the
    // aggregates moved to the server.
    const { result } = render();

    await waitFor(() => expect(result.current.analyticsLoading).toBe(false));

    expect(result.current.summary).toEqual({
      totalIncome: 5000,
      totalExpense: 2000,
      balance: 3000,
    });
  });

  it('asks the server to filter instead of filtering the page it already has', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.updateFilters({ type: 'income' }));

    await waitFor(() =>
      expect(listTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { type: 'income' } }),
      ),
    );
  });

  it('asks the server to sort, and toggles direction on a repeated field', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.updateSort('amount'));
    expect(result.current.sort).toEqual({ field: 'amount', order: 'desc' });

    act(() => result.current.updateSort('amount'));
    expect(result.current.sort).toEqual({ field: 'amount', order: 'asc' });

    await waitFor(() =>
      expect(listTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: { field: 'amount', order: 'asc' } }),
      ),
    );
  });

  it('returns to the first page when the filter changes', async () => {
    vi.mocked(listTransactions).mockResolvedValue(
      page([makeTransaction()], { totalPages: 5, totalElements: 120, last: false }),
    );
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));

    // Page 3 of the old result set is not page 3 of the new one, and may not
    // exist at all — which would show an empty table over a non-empty result.
    act(() => result.current.updateFilters({ search: 'coffee' }));
    expect(result.current.page).toBe(0);
  });

  it('shows a created transaction immediately, before the server answers', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolve: (value: Transaction) => void = () => {};
    vi.mocked(createTransaction).mockReturnValue(
      new Promise<Transaction>((r) => {
        resolve = r;
      }),
    );

    act(() =>
      result.current.addTransaction({
        type: 'expense',
        categoryId: GROCERIES,
        amount: 42.5,
        date: '2026-08-10',
        description: 'Optimistic',
      }),
    );

    await waitFor(() => expect(result.current.transactions).toHaveLength(2));
    expect(result.current.transactions[0]).toMatchObject({
      amount: 42.5,
      category: 'Groceries',
      description: 'Optimistic',
    });

    await act(async () => {
      resolve(makeTransaction());
    });
  });

  it('rolls the optimistic row back and reports why when the server refuses', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(createTransaction).mockRejectedValue(
      new ApiError(422, "Category 'Salary' is an income category"),
    );

    await act(async () => {
      result.current.addTransaction({
        type: 'expense',
        categoryId: 'cat-salary',
        amount: 10,
        date: '2026-08-10',
      });
    });

    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("Category 'Salary' is an income category"),
      'error',
    );
  });

  it('applies an edit optimistically and keeps the category name in step', async () => {
    const existing = makeTransaction({ id: 'txn-edit', amount: 10, category: 'Salary' });
    vi.mocked(listTransactions).mockResolvedValue(page([existing]));

    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Held open deliberately: once the mutation settles the list is refetched
    // and the server's answer replaces the optimistic patch, so the patch is
    // only observable while the request is in flight.
    let resolve: (value: Transaction) => void = () => {};
    vi.mocked(updateTransaction).mockReturnValue(
      new Promise<Transaction>((r) => {
        resolve = r;
      }),
    );

    act(() =>
      result.current.editTransaction('txn-edit', {
        type: 'expense',
        categoryId: GROCERIES,
        amount: 99,
        date: '2026-08-11',
      }),
    );

    await waitFor(() =>
      expect(result.current.transactions[0]).toMatchObject({
        amount: 99,
        category: 'Groceries',
      }),
    );

    await act(async () => {
      resolve({ ...existing, amount: 99, category: 'Groceries', categoryId: GROCERIES });
    });
  });

  it('derives the category breakdown from the server totals with percentages', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.analyticsLoading).toBe(false));

    expect(result.current.expenseByCategory).toEqual([
      { category: 'Groceries', total: 2000, count: 4, percentage: 100 },
    ]);
    expect(result.current.incomeByCategory).toEqual([]);
  });

  it('cannot write until an account and categories are available', async () => {
    vi.mocked(ensureDefaultAccount).mockRejectedValue(new ApiError(500, 'boom'));
    const { result } = render();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canWrite).toBe(false);
  });
});
