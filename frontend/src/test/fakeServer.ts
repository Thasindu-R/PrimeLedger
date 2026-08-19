import type { Account, Budget, Notification, Transaction } from '../types';
import type { CategoryOption } from '../api/categories';
import type { AnalyticsScope, AnalyticsSummary } from '../api/analytics';
import type { AccountInput } from '../api/accounts';
import type { BudgetInput } from '../api/budgets';
import type { TransferInput, TransferPair } from '../api/transfers';
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

/** The account every seeded transaction belongs to unless a test says otherwise. */
export const DEFAULT_ACCOUNT: Account = {
  id: 'acc-1',
  name: 'Everyday',
  type: 'CHECKING',
  currency: 'USD',
  openingBalance: 0,
  balance: 0,
  isArchived: false,
  transactionCount: 0,
};

interface Store {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  notifications: Notification[];
  nextId: number;
}

const store: Store = {
  transactions: [],
  accounts: [],
  budgets: [],
  notifications: [],
  nextId: 0,
};

export function resetFakeServer(
  seed: Transaction[] = [],
  options: { accounts?: Account[]; budgets?: Budget[]; notifications?: Notification[] } = {},
): void {
  store.transactions = seed.map((transaction) => ({ ...transaction }));
  store.accounts = (options.accounts ?? [DEFAULT_ACCOUNT]).map((account) => ({ ...account }));
  store.budgets = (options.budgets ?? []).map((budget) => ({ ...budget }));
  store.notifications = (options.notifications ?? []).map((entry) => ({ ...entry }));
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
  if (filters.accountId) rows = rows.filter((row) => row.accountId === filters.accountId);
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

export async function createTransaction(
  input: TransactionInput,
  context?: { accountId: string },
): Promise<Transaction> {
  store.nextId += 1;
  const created: Transaction = {
    id: `server-${store.nextId}`,
    type: input.type,
    category: nameOf(input.categoryId),
    categoryId: input.categoryId,
    accountId: context?.accountId ?? store.accounts[0]?.id ?? DEFAULT_ACCOUNT.id,
    isTransfer: false,
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
  // A transfer leg takes its partner with it, as the real endpoint does.
  const row = store.transactions.find((t) => t.id === id);
  const doomed = [id, row?.transferPairId].filter(Boolean);
  store.transactions = store.transactions.filter((t) => !doomed.includes(t.id));
}

export async function bulkDeleteTransactions(ids: string[]): Promise<number> {
  const before = store.transactions.length;
  store.transactions = store.transactions.filter((row) => !ids.includes(row.id));
  return before - store.transactions.length;
}

export async function listCategories(): Promise<CategoryOption[]> {
  return FAKE_CATEGORIES;
}

// ------------------------------------------------------------------ accounts

/** Balance and transaction count are derived, exactly as the server derives them. */
function withDerived(account: Account): Account {
  const rows = store.transactions.filter((row) => row.accountId === account.id);
  const movement = rows.reduce(
    (total, row) => total + (row.type === 'income' ? row.amount : -row.amount),
    0,
  );
  return {
    ...account,
    balance: account.openingBalance + movement,
    transactionCount: rows.length,
  };
}

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  return store.accounts
    .filter((account) => includeArchived || !account.isArchived)
    .map(withDerived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function ensureDefaultAccount(): Promise<Account> {
  const existing = store.accounts.find((account) => !account.isArchived);
  if (existing) return withDerived(existing);

  const created = { ...DEFAULT_ACCOUNT, id: `acc-${store.accounts.length + 1}` };
  store.accounts.push(created);
  return withDerived(created);
}

export async function createAccount(input: AccountInput): Promise<Account> {
  if (store.accounts.some((a) => a.name.toLowerCase() === input.name.toLowerCase())) {
    throw new Error(`An account called ${input.name} already exists`);
  }
  const created: Account = {
    id: `acc-${store.accounts.length + 1}`,
    name: input.name,
    type: input.type,
    currency: input.currency,
    openingBalance: input.openingBalance,
    balance: input.openingBalance,
    colour: input.colour,
    isArchived: false,
    transactionCount: 0,
  };
  store.accounts.push(created);
  return created;
}

export async function updateAccount(id: string, input: AccountInput): Promise<Account> {
  const account = store.accounts.find((a) => a.id === id);
  if (!account) throw new Error(`No account ${id}`);

  const derived = withDerived(account);
  if (derived.transactionCount > 0 && input.currency !== account.currency) {
    throw new Error('An account holding transactions cannot change currency');
  }

  Object.assign(account, {
    name: input.name,
    type: input.type,
    currency: input.currency,
    openingBalance: input.openingBalance,
    colour: input.colour,
  });
  return withDerived(account);
}

export async function setAccountArchived(id: string, archived: boolean): Promise<Account> {
  const account = store.accounts.find((a) => a.id === id);
  if (!account) throw new Error(`No account ${id}`);

  const remaining = store.accounts.filter((a) => !a.isArchived && a.id !== id);
  if (archived && remaining.length === 0) {
    throw new Error('Your last open account cannot be archived');
  }

  account.isArchived = archived;
  return withDerived(account);
}

export async function deleteAccount(id: string): Promise<void> {
  const account = store.accounts.find((a) => a.id === id);
  if (!account) throw new Error(`No account ${id}`);
  if (withDerived(account).transactionCount > 0) {
    throw new Error('Archive it instead — this account holds transactions');
  }
  store.accounts = store.accounts.filter((a) => a.id !== id);
}

// ----------------------------------------------------------------- transfers

export async function createTransfer(input: TransferInput): Promise<TransferPair> {
  const from = store.accounts.find((a) => a.id === input.fromAccountId);
  const to = store.accounts.find((a) => a.id === input.toAccountId);
  if (!from || !to) throw new Error('Both accounts must exist');
  if (from.id === to.id) throw new Error('An account cannot transfer to itself');
  if (from.currency !== to.currency) throw new Error('Currencies must match');

  store.nextId += 1;
  const outId = `server-${store.nextId}`;
  store.nextId += 1;
  const inId = `server-${store.nextId}`;

  // Two rows, cross-linked, with no category — the shape V5 enforces.
  const expense: Transaction = {
    id: outId,
    type: 'expense',
    category: 'Transfer',
    accountId: from.id,
    isTransfer: true,
    transferPairId: inId,
    amount: input.amount,
    date: input.date,
    description: input.description,
  };
  const income: Transaction = {
    id: inId,
    type: 'income',
    category: 'Transfer',
    accountId: to.id,
    isTransfer: true,
    transferPairId: outId,
    amount: input.amount,
    date: input.date,
    description: input.description,
  };

  store.transactions.push(expense, income);
  return { from: expense, to: income };
}

export async function deleteTransfer(legId: string): Promise<void> {
  const leg = store.transactions.find((row) => row.id === legId);
  if (!leg) throw new Error(`No transaction ${legId}`);
  const ids = [leg.id, leg.transferPairId].filter(Boolean);
  store.transactions = store.transactions.filter((row) => !ids.includes(row.id));
}

// ------------------------------------------------------------------- budgets

export async function listBudgets(): Promise<Budget[]> {
  return store.budgets.map(withPosition);
}

/** Spend excludes transfers, exactly as the server's `reporting` specification does. */
function withPosition(budget: Budget): Budget {
  const spent = store.transactions
    .filter(
      (row) =>
        !row.isTransfer &&
        row.type === 'expense' &&
        row.categoryId === budget.categoryId &&
        row.date >= budget.periodStart &&
        row.date <= budget.periodEnd,
    )
    .reduce((total, row) => total + row.amount, 0);

  const percentUsed = budget.limit === 0 ? 0 : (spent / budget.limit) * 100;

  return {
    ...budget,
    spent,
    remaining: budget.limit - spent,
    percentUsed,
    status: percentUsed >= 100 ? 'EXCEEDED' : percentUsed >= 80 ? 'WARNING' : 'OK',
  };
}

function periodBounds(period: Budget['period'], on: Date): [string, string] {
  const year = on.getUTCFullYear();
  const month = on.getUTCMonth();

  if (period === 'YEARLY') {
    return [`${year}-01-01`, `${year}-12-31`];
  }
  if (period === 'WEEKLY') {
    // ISO weeks start on Monday.
    const start = new Date(Date.UTC(year, month, on.getUTCDate()));
    const offset = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - offset);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  }
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

export async function createBudget(input: BudgetInput): Promise<Budget> {
  const category = FAKE_CATEGORIES.find((c) => c.id === input.categoryId);
  if (!category) throw new Error(`No category ${input.categoryId}`);
  if (category.kind === 'income') throw new Error('Income cannot be budgeted');

  const [periodStart, periodEnd] = periodBounds(input.period, new Date());
  const created: Budget = {
    id: `budget-${store.budgets.length + 1}`,
    categoryId: category.id,
    category: category.name,
    categoryColour: category.colour,
    period: input.period,
    limit: input.limit,
    startsOn: input.startsOn ?? periodStart,
    periodStart,
    periodEnd,
    spent: 0,
    remaining: input.limit,
    percentUsed: 0,
    status: 'OK',
  };
  store.budgets.push(created);
  return withPosition(created);
}

export async function updateBudget(id: string, input: BudgetInput): Promise<Budget> {
  const budget = store.budgets.find((b) => b.id === id);
  if (!budget) throw new Error(`No budget ${id}`);
  budget.limit = input.limit;
  budget.period = input.period;
  return withPosition(budget);
}

export async function deleteBudget(id: string): Promise<void> {
  store.budgets = store.budgets.filter((b) => b.id !== id);
}

// ------------------------------------------------------------- notifications

export async function listNotifications(): Promise<Notification[]> {
  return [...store.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchUnreadCount(): Promise<number> {
  return store.notifications.filter((entry) => !entry.isRead).length;
}

export async function markNotificationRead(id: string): Promise<void> {
  const entry = store.notifications.find((n) => n.id === id);
  if (entry) entry.isRead = true;
}

export async function markAllNotificationsRead(): Promise<number> {
  const unread = store.notifications.filter((entry) => !entry.isRead);
  unread.forEach((entry) => {
    entry.isRead = true;
  });
  return unread.length;
}

/** The aggregates, computed over every row — as the real endpoint does. */
export async function fetchSummary(scope: AnalyticsScope = {}): Promise<AnalyticsSummary> {
  // Transfers are excluded here and only here: they still count towards account
  // balances above. A 250 transfer counted naively would add 250 of income and
  // 250 of expense, inflating the month by 500 and reporting a balance change
  // that never happened.
  const rows = store.transactions.filter(
    (row) => !row.isTransfer && (!scope.accountId || row.accountId === scope.accountId),
  );

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
    // The fake ledger is single-currency, as the real one is for most users, so
    // nothing is ever unconvertible here. A test that wants the warning banner
    // overrides this.
    currency: 'USD',
    unconverted: 0,
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
