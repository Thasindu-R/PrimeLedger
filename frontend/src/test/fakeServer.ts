import type { Transaction } from '../types';
import type { CategoryOption } from '../api/categories';
import type { AnalyticsSummary } from '../api/analytics';
import type {
  ListParams,
  Page,
  TransactionInput,
} from '../api/transactions';
import { monthKey } from '../utils/timeSeries';

/**
 * An in-memory stand-in for the API, for tests that drive the whole app.
 *
 * <p>Before Phase 4 these tests seeded `localStorage` and the app read it back.
 * The app reads a server now, so the seam moved: this holds the rows, applies
 * the same filtering, sorting and pagination the server does, and computes the
 * same aggregates. It is not a mock that returns fixed answers — a write through
 * the UI has to be visible to the next read, or the D-07 tests would prove
 * nothing.
 */

export const FAKE_CATEGORIES: CategoryOption[] = [
  { id: 'cat-salary', name: 'Salary', kind: 'income', system: true, sortOrder: 0 },
  { id: 'cat-freelance', name: 'Freelance', kind: 'income', system: true, sortOrder: 1 },
  { id: 'cat-food', name: 'Food', kind: 'expense', system: true, sortOrder: 2 },
  { id: 'cat-transport', name: 'Transport', kind: 'expense', system: true, sortOrder: 3 },
];

const store: { transactions: Transaction[]; nextId: number } = {
  transactions: [],
  nextId: 0,
};

export function resetFakeServer(seed: Transaction[] = []): void {
  store.transactions = seed.map((transaction) => ({ ...transaction }));
  store.nextId = 0;
}

function nameOf(categoryId: string): string {
  return FAKE_CATEGORIES.find((category) => category.id === categoryId)?.name ?? 'Other';
}

export async function listTransactions({
  filters = {},
  sort,
  page = 0,
  size = 25,
}: ListParams = {}): Promise<Page<Transaction>> {
  let rows = [...store.transactions];

  if (filters.type) rows = rows.filter((row) => row.type === filters.type);
  if (filters.categoryId) rows = rows.filter((row) => row.categoryId === filters.categoryId);
  if (filters.startDate) rows = rows.filter((row) => row.date >= filters.startDate!);
  if (filters.endDate) rows = rows.filter((row) => row.date <= filters.endDate!);
  if (filters.minAmount !== undefined) {
    rows = rows.filter((row) => row.amount >= filters.minAmount!);
  }
  if (filters.maxAmount !== undefined) {
    rows = rows.filter((row) => row.amount <= filters.maxAmount!);
  }
  if (filters.search?.trim()) {
    const term = filters.search.trim().toLowerCase();
    rows = rows.filter((row) => (row.description ?? '').toLowerCase().includes(term));
  }

  const { field, order } = sort ?? { field: 'date' as const, order: 'desc' as const };
  const direction = order === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    switch (field) {
      case 'amount':
        return direction * (a.amount - b.amount);
      case 'category':
        return direction * a.category.localeCompare(b.category);
      case 'type':
        return direction * a.type.localeCompare(b.type);
      default:
        return direction * a.date.localeCompare(b.date);
    }
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const items = rows.slice(page * size, (page + 1) * size);

  return {
    items,
    page,
    size,
    totalElements: rows.length,
    totalPages,
    first: page === 0,
    last: page >= totalPages - 1,
  };
}

// The account and currency the real client sends are not modelled here: the
// fake has one account, and Phase 6 is where currency starts to matter.
export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  store.nextId += 1;
  const created: Transaction = {
    id: `server-${store.nextId}`,
    type: input.type,
    category: nameOf(input.categoryId),
    categoryId: input.categoryId,
    amount: input.amount,
    date: input.date,
    description: input.description,
  };
  store.transactions.push(created);
  return created;
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<Transaction> {
  const index = store.transactions.findIndex((row) => row.id === id);
  if (index === -1) throw new Error(`No transaction ${id}`);

  const updated: Transaction = {
    ...store.transactions[index],
    type: input.type,
    category: nameOf(input.categoryId),
    categoryId: input.categoryId,
    amount: input.amount,
    date: input.date,
    description: input.description,
  };
  store.transactions[index] = updated;
  return updated;
}

export async function deleteTransaction(id: string): Promise<void> {
  store.transactions = store.transactions.filter((row) => row.id !== id);
}

export async function bulkDeleteTransactions(ids: string[]): Promise<number> {
  const before = store.transactions.length;
  store.transactions = store.transactions.filter((row) => !ids.includes(row.id));
  return before - store.transactions.length;
}

export async function listCategories(): Promise<CategoryOption[]> {
  return FAKE_CATEGORIES;
}

export async function ensureDefaultAccount() {
  return { id: 'acc-1', name: 'Everyday', currency: 'USD' };
}

/** The aggregates, computed over every row — as the real endpoint does. */
export async function fetchSummary(): Promise<AnalyticsSummary> {
  const rows = store.transactions;

  const totalIncome = sum(rows.filter((row) => row.type === 'income'));
  const totalExpense = sum(rows.filter((row) => row.type === 'expense'));

  const categories = new Map<string, { total: number; count: number; type: string }>();
  for (const row of rows) {
    const key = `${row.type}:${row.category}`;
    const entry = categories.get(key) ?? { total: 0, count: 0, type: row.type };
    entry.total += row.amount;
    entry.count += 1;
    categories.set(key, entry);
  }

  const months = new Map<string, { income: number; expense: number }>();
  for (const row of rows) {
    const key = monthKey(row.date);
    const bucket = months.get(key) ?? { income: 0, expense: 0 };
    if (row.type === 'income') bucket.income += row.amount;
    else bucket.expense += row.amount;
    months.set(key, bucket);
  }

  const expenses = rows.filter((row) => row.type === 'expense');

  return {
    totals: { totalIncome, totalExpense, balance: totalIncome - totalExpense },
    count: rows.length,
    highestExpense: expenses.length === 0 ? 0 : Math.max(...expenses.map((r) => r.amount)),
    byCategory: [...categories.entries()].map(([key, value]) => ({
      categoryId: key,
      category: key.split(':')[1],
      type: value.type as 'income' | 'expense',
      total: value.total,
      count: value.count,
    })),
    monthly: [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, income: value.income, expense: value.expense })),
  };
}

function sum(rows: Transaction[]): number {
  return rows.reduce((total, row) => total + row.amount, 0);
}
