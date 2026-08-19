import { useCallback, useMemo, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  DEFAULT_PAGE_SIZE,
  bulkDeleteTransactions,
  createTransaction,
  deleteTransaction as deleteTransactionRequest,
  listTransactions,
  updateTransaction,
  type Page,
  type SortConfig,
  type SortField,
  type TransactionFilters,
  type TransactionInput,
} from '../api/transactions';
import { ensureDefaultAccount } from '../api/accounts';
import { listCategories } from '../api/categories';
import { fetchSummary } from '../api/analytics';
import { queryKeys } from '../lib/queryClient';
import { buildSeriesFromBuckets } from '../utils/timeSeries';
import { averagePerActiveMonth, deltasFromBuckets } from '../utils/periodComparison';
import { ApiError } from '../api/client';
import type { Account, Summary, Transaction } from '../types';

export type { SortConfig, SortField, SortOrder, TransactionFilters } from '../api/transactions';

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

const EMPTY_SUMMARY: Summary = { totalIncome: 0, totalExpense: 0, balance: 0 };

type ShowToast = (message: string, type?: 'success' | 'error' | 'info') => void;

/**
 * The ledger, read from the server.
 *
 * <p>The shape this returns is deliberately close to what the Phase 1 hook
 * returned, because the pages and presentational components below them are
 * unchanged — the seam the proposal put here (§11.1) is what makes that
 * possible. What changed is everything behind it: the array is a page from the
 * API rather than a parse of localStorage, the filtering and sorting are
 * predicates the database evaluates, and the totals are aggregates computed over
 * rows this browser has never seen.
 *
 * <p>The totals are the subtle part. Summing the rows on screen would have kept
 * working, silently, and reported the current page's totals as the ledger's.
 */
export function useTransactions({
  showToast,
  selectedAccount,
}: {
  showToast: ShowToast;
  /**
   * The account chosen in the header, or undefined for all of them.
   *
   * <p>Separate from {@link TransactionFilters} rather than folded into it,
   * because it is a different kind of thing: the page filters are a search the
   * user is running, and resetting them must not silently widen the ledger back
   * out to every account.
   *
   * <p>The whole account rather than its id, because it is also where new
   * transactions are filed, and a write needs its currency — an amount without
   * one is a number, not money.
   */
  selectedAccount?: Account;
}) {
  const queryClient = useQueryClient();
  const accountId = selectedAccount?.id;

  const [filters, setFilters] = useState<TransactionFilters>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'date', order: 'desc' });
  const [page, setPage] = useState(0);

  // The account new rows are filed under, and the categories the form offers.
  // Both are prerequisites for writing, so a failure here disables writes rather
  // than letting the user fill in a form that cannot be submitted.
  const defaultAccount = useQuery({
    queryKey: queryKeys.defaultAccount,
    queryFn: ensureDefaultAccount,
    staleTime: Infinity,
  });

  const categories = useQuery({
    queryKey: queryKeys.categories,
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });

  const analytics = useQuery({
    queryKey: [...queryKeys.analytics, { accountId }] as const,
    queryFn: () => fetchSummary({ accountId }),
  });

  const scopedFilters = useMemo(
    (): TransactionFilters => (accountId ? { ...filters, accountId } : filters),
    [filters, accountId],
  );

  const listKey = useMemo(
    () => [...queryKeys.transactions, { filters: scopedFilters, sort, page }] as const,
    [scopedFilters, sort, page],
  );

  const list = useQuery({
    queryKey: listKey,
    queryFn: () => listTransactions({ filters: scopedFilters, sort, page }),
    // Keeps the previous page on screen while the next one loads, so paging
    // does not flash an empty table (proposal §11.3).
    placeholderData: keepPreviousData,
  });

  /**
   * The account a new transaction is filed under.
   *
   * <p>Whichever account the header is showing, falling back to the provisioned
   * default when it is showing all of them. Adding a transaction while looking
   * at "Savings" and having it land in "Everyday" would be the wrong answer to
   * an unambiguous question.
   */
  const writeAccount = selectedAccount ?? defaultAccount.data;

  const transactions = useMemo(() => list.data?.items ?? [], [list.data]);

  /**
   * The five newest transactions, for the header menu.
   *
   * <p>Its own query rather than a slice of the page above, which carries
   * whatever filter and sort the transactions page was left on — "recent" would
   * otherwise quietly mean "recent, among expenses over 500, oldest first".
   */
  const recent = useQuery({
    queryKey: [...queryKeys.transactions, 'recent', { accountId }] as const,
    queryFn: () => listTransactions({ filters: accountId ? { accountId } : {}, page: 0, size: 5 }),
  });

  // ---------------------------------------------------------------- writes

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    // The totals moved too; leaving them would show a balance that disagrees
    // with the rows underneath it.
    void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    // So did the account's balance, which the header is showing.
    void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    // And a write can put a budget over its limit, which is an alert.
    void queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }, [queryClient]);

  /**
   * Snapshots every cached page, applies `patch` to each, and returns the
   * snapshot so a failure can put it back (FR-44).
   */
  const patchCachedPages = useCallback(
    (patch: (page: Page<Transaction>) => Page<Transaction>) => {
      const snapshot = queryClient.getQueriesData<Page<Transaction>>({
        queryKey: queryKeys.transactions,
      });

      queryClient.setQueriesData<Page<Transaction>>(
        { queryKey: queryKeys.transactions },
        (cached) => (cached ? patch(cached) : cached),
      );

      return snapshot;
    },
    [queryClient],
  );

  const restore = useCallback(
    (snapshot: [readonly unknown[], Page<Transaction> | undefined][]) => {
      for (const [key, value] of snapshot) {
        queryClient.setQueryData(key, value);
      }
    },
    [queryClient],
  );

  const reportFailure = useCallback(
    (action: string, error: unknown) => {
      const detail =
        error instanceof ApiError
          ? error.message
          : 'The server could not be reached.';
      showToast(`Could not ${action}. ${detail}`, 'error');
    },
    [showToast],
  );

  const create = useMutation({
    mutationFn: (input: TransactionInput) => {
      if (!writeAccount) {
        throw new Error('No account is available to file this transaction under');
      }
      return createTransaction(input, {
        accountId: writeAccount.id,
        currency: writeAccount.currency,
      });
    },
    onMutate: async (input: TransactionInput) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.transactions });

      // The optimistic row goes to the top of every cached page. That is not
      // where the server will necessarily put it — the sort and the page
      // boundaries decide that — so this is a preview, corrected by the
      // invalidation in onSettled. The alternative, waiting for the round trip,
      // is the lag FR-44 exists to remove.
      const optimistic: Transaction = {
        id: `optimistic-${crypto.randomUUID()}`,
        type: input.type,
        category: nameOfCategory(categories.data, input.categoryId),
        categoryId: input.categoryId,
        accountId: writeAccount?.id ?? '',
        // The add form cannot produce one; transfers go through their own
        // endpoint, because a transfer is two rows and this is one.
        isTransfer: false,
        amount: input.amount,
        date: input.date,
        description: input.description,
      };

      return patchCachedPages((cached) => ({
        ...cached,
        items: [optimistic, ...cached.items],
        totalElements: cached.totalElements + 1,
      }));
    },
    onError: (error, _input, snapshot) => {
      if (snapshot) restore(snapshot);
      reportFailure('add that transaction', error);
    },
    onSuccess: () => showToast('Transaction added!', 'success'),
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransactionInput }) => {
      if (!writeAccount) {
        throw new Error('No account is available to file this transaction under');
      }
      return updateTransaction(id, input, {
        accountId: writeAccount.id,
        currency: writeAccount.currency,
      });
    },
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.transactions });

      return patchCachedPages((cached) => ({
        ...cached,
        items: cached.items.map((transaction) =>
          transaction.id === id
            ? {
                ...transaction,
                ...input,
                category: nameOfCategory(categories.data, input.categoryId),
              }
            : transaction,
        ),
      }));
    },
    onError: (error, _variables, snapshot) => {
      if (snapshot) restore(snapshot);
      reportFailure('save that change', error);
    },
    onSuccess: () => showToast('Transaction updated.', 'success'),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTransactionRequest(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.transactions });

      // Deleting one leg of a transfer deletes both, server-side. Removing only
      // the row that was clicked would leave its partner on screen until the
      // refetch — money arriving from an account it never left.
      const clicked = transactions.find((transaction) => transaction.id === id);
      const doomed = new Set([id, clicked?.transferPairId].filter(Boolean) as string[]);

      return patchCachedPages((cached) => {
        const items = cached.items.filter((transaction) => !doomed.has(transaction.id));
        return {
          ...cached,
          items,
          totalElements: Math.max(0, cached.totalElements - (cached.items.length - items.length)),
        };
      });
    },
    onError: (error, _id, snapshot) => {
      if (snapshot) restore(snapshot);
      reportFailure('delete that transaction', error);
    },
    onSuccess: () => showToast('Transaction deleted.', 'info'),
    onSettled: invalidate,
  });

  /**
   * Deletes everything the user owns, a page of ids at a time.
   *
   * <p>There is no "delete all" endpoint and deliberately so — one would be a
   * single request away from erasing an account by accident. This walks the
   * ledger instead, which is slower and much harder to fire unintentionally.
   */
  const clear = useMutation({
    mutationFn: async () => {
      let removed = 0;
      // Always page zero: each batch deletes the rows it just read, so the next
      // page of results moves up to take their place.
      for (;;) {
        const batch = await listTransactions({ page: 0, size: 200 });
        if (batch.items.length === 0) break;

        const deleted = await bulkDeleteTransactions(batch.items.map((item) => item.id));
        removed += deleted;

        // A batch that deletes nothing would be read again, and again. Whatever
        // is refusing to go will not go on the next attempt either, so stop
        // rather than spin forever against the server.
        if (deleted === 0) {
          throw new Error('Some transactions could not be deleted');
        }
        if (batch.last) break;
      }
      return removed;
    },
    onError: (error) => reportFailure('clear your data', error),
    onSuccess: () => showToast('All data cleared.', 'error'),
    onSettled: invalidate,
  });

  // ------------------------------------------------------------- derived

  const summary = analytics.data?.totals ?? EMPTY_SUMMARY;

  // Facts about the whole ledger, which a page of it cannot supply: the count
  // would be the page size, and the largest expense would be the largest one
  // that happened to be on screen.
  const ledgerCount = analytics.data?.count ?? 0;
  const highestExpense = analytics.data?.highestExpense ?? 0;

  // What the aggregates are denominated in, and how much of the ledger could
  // not be converted into it (F-05). The second is the one that matters: an
  // unconvertible transaction is absent from the sums, so a total that looks
  // perfectly ordinary can be understated, and only this number says so.
  const reportingCurrency = analytics.data?.currency;
  const unconvertedCount = analytics.data?.unconverted ?? 0;

  const monthlySeries = useMemo(
    () => buildSeriesFromBuckets(analytics.data?.monthly ?? [], { months: 12 }),
    [analytics.data],
  );

  const deltas = useMemo(
    () => deltasFromBuckets(analytics.data?.monthly ?? []),
    [analytics.data],
  );

  const averageMonthly = useMemo(
    () => averagePerActiveMonth(monthlySeries),
    [monthlySeries],
  );

  const incomeByCategory = useMemo(
    () => breakdown(analytics.data?.byCategory, 'income'),
    [analytics.data],
  );

  const expenseByCategory = useMemo(
    () => breakdown(analytics.data?.byCategory, 'expense'),
    [analytics.data],
  );

  // ------------------------------------------------------------- controls

  const updateFilters = useCallback((patch: Partial<TransactionFilters>): void => {
    setFilters((previous) => ({ ...previous, ...patch }));
    // A narrower filter can leave the current page beyond the last one, which
    // would show an empty table over a non-empty result.
    setPage(0);
  }, []);

  const resetFilters = useCallback((): void => {
    setFilters({});
    setPage(0);
  }, []);

  const updateSort = useCallback((field: SortField): void => {
    setSort((previous) => ({
      field,
      order: previous.field === field && previous.order === 'desc' ? 'asc' : 'desc',
    }));
    setPage(0);
  }, []);

  const applySort = useCallback((config: SortConfig): void => {
    setSort(config);
    setPage(0);
  }, []);

  /**
   * Every row the current filter matches, not just the page on screen.
   *
   * <p>The CSV export has always promised to honour the filters, and before
   * pagination the whole ledger was in memory so that was free. Exporting
   * `transactions` now would quietly hand the user twenty-five rows and call it
   * their data. FR-31 moves this to a server-generated download in Phase 7; until
   * then, paging through is the honest version.
   */
  const fetchAllMatching = useCallback(
    (): Promise<Transaction[]> => fetchEvery(scopedFilters, sort),
    [scopedFilters, sort],
  );

  /**
   * The whole ledger, ignoring the filters currently on screen.
   *
   * <p>Settings offers "export all data", and it means all — a filter the user
   * set on another page two minutes ago must not silently narrow it.
   */
  const fetchAllTransactions = useCallback(
    (): Promise<Transaction[]> => fetchEvery({}, sort),
    [sort],
  );

  return {
    // data
    transactions,
    recentTransactions: recent.data?.items ?? [],
    categories: categories.data ?? [],
    /** The account writes are filed under; needed by the localStorage migration. */
    account: writeAccount,

    // status — every async surface needs these (FR-42)
    isLoading: list.isPending,
    isFetching: list.isFetching,
    error: list.error ?? defaultAccount.error ?? categories.error,
    refetch: () => void list.refetch(),
    analyticsLoading: analytics.isPending,
    analyticsError: analytics.error,
    refetchAnalytics: () => void analytics.refetch(),
    /** Writes need an account and a category list; without them the form cannot submit. */
    canWrite: writeAccount !== undefined && (categories.data?.length ?? 0) > 0,
    isMutating: create.isPending || update.isPending || remove.isPending || clear.isPending,

    // pagination
    page,
    setPage,
    pageSize: list.data?.size ?? DEFAULT_PAGE_SIZE,
    totalPages: list.data?.totalPages ?? 0,
    totalElements: list.data?.totalElements ?? 0,

    // writes
    addTransaction: (input: TransactionInput) => create.mutate(input),
    editTransaction: (id: string, input: TransactionInput) => update.mutate({ id, input }),
    deleteTransaction: (id: string) => remove.mutate(id),
    clearAll: () => clear.mutate(),

    // filtering and sorting, now server-side
    filters,
    updateFilters,
    resetFilters,
    sort,
    updateSort,
    setSort: applySort,
    fetchAllMatching,
    fetchAllTransactions,

    // aggregates
    summary,
    ledgerCount,
    highestExpense,
    reportingCurrency,
    unconvertedCount,
    deltas,
    monthlySeries,
    averageMonthly,
    incomeByCategory,
    expenseByCategory,
  };
}

/** Walks every page of a result set. Used by both export paths. */
async function fetchEvery(
  filters: TransactionFilters,
  sort: SortConfig,
): Promise<Transaction[]> {
  const all: Transaction[] = [];
  for (let current = 0; ; current += 1) {
    const batch = await listTransactions({ filters, sort, page: current, size: 200 });
    all.push(...batch.items);
    if (batch.last || batch.items.length === 0) break;
  }
  return all;
}

function nameOfCategory(
  categories: { id: string; name: string }[] | undefined,
  categoryId: string,
): string {
  return categories?.find((category) => category.id === categoryId)?.name ?? '';
}

/**
 * Turns the server's per-category totals into the shape the charts read.
 *
 * <p>The percentage is computed here rather than sent, because it is a
 * percentage *of the categories shown* — a derived presentation detail, not a
 * fact about the data.
 */
function breakdown(
  rows:
    | { category: string; type: string; total: number; count: number }[]
    | undefined,
  type: 'income' | 'expense',
): CategoryBreakdown[] {
  const matching = (rows ?? []).filter((row) => row.type === type);
  const grandTotal = matching.reduce((sum, row) => sum + row.total, 0);

  return matching
    .map((row) => ({
      category: row.category,
      total: row.total,
      count: row.count,
      percentage: grandTotal > 0 ? (row.total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
