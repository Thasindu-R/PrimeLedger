import { useOutletContext } from 'react-router-dom';
import type { Transaction, Summary } from '../types';
import type {
  CategoryBreakdown,
  SortConfig,
  SortField,
  TransactionFilters,
} from '../hooks/useTransactions';
import type { MonthlyPoint } from '../utils/timeSeries';
import type { PeriodDeltas } from '../utils/periodComparison';

/**
 * Everything the routed pages need from the shell. The presentational
 * components below each page still receive plain props, so the single state
 * seam described in the proposal survived Phase 4 — the pages below did not have
 * to learn that their data now comes from a server.
 *
 * <p>What they did have to learn is that it can be absent: `isLoading`, `error`
 * and the page controls are new, because a request can be in flight or fail and
 * an array read from memory could do neither (FR-42, FR-45).
 */
export interface LedgerContext {
  /** The current page of results, in the order the server returned them. */
  transactions: Transaction[];
  summary: Summary;
  /** How many transactions the ledger holds, from the server. */
  ledgerCount: number;
  /** The largest single expense across every row, from the server. */
  highestExpense: number;
  deltas: PeriodDeltas;
  monthlySeries: MonthlyPoint[];
  averageMonthly: { income: number; expense: number };
  incomeByCategory: CategoryBreakdown[];
  expenseByCategory: CategoryBreakdown[];

  // Status of the list itself.
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;

  // The aggregates load separately, so one can fail without blanking the other.
  analyticsLoading: boolean;
  analyticsError: unknown;
  refetchAnalytics: () => void;

  // Server-side pagination.
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  totalPages: number;
  totalElements: number;

  filters: TransactionFilters;
  updateFilters: (patch: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
  sort: SortConfig;
  setSort: (sort: SortConfig) => void;
  updateSort: (field: SortField) => void;
  /** Every matching row, for the CSV export — not just the page on screen. */
  fetchAllMatching: () => Promise<Transaction[]>;
  /** Every row the user owns, ignoring the filters currently on screen. */
  fetchAllTransactions: () => Promise<Transaction[]>;

  requestDelete: (id: string) => void;
  requestEdit: (transaction: Transaction) => void;
  /** Already confirmed by the settings page's own dialog. */
  clearAll: () => void;
  isClearing: boolean;

  userName: string;
  onUserNameChange: (name: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useLedger(): LedgerContext {
  return useOutletContext<LedgerContext>();
}
