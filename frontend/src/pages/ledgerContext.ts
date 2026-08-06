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
 * seam described in the proposal survives routing — and survives Phase 4, when
 * the shell swaps `useTransactions` for TanStack Query.
 */
export interface LedgerContext {
  transactions: Transaction[];
  sortedTransactions: Transaction[];
  summary: Summary;
  deltas: PeriodDeltas;
  monthlySeries: MonthlyPoint[];
  averageMonthly: { income: number; expense: number };
  incomeByCategory: CategoryBreakdown[];
  expenseByCategory: CategoryBreakdown[];
  filters: TransactionFilters;
  updateFilters: (patch: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
  sort: SortConfig;
  setSort: (sort: SortConfig) => void;
  updateSort: (field: SortField) => void;
  requestDelete: (id: string) => void;
  requestEdit: (transaction: Transaction) => void;
  /** Already confirmed by the settings page's own dialog. */
  clearAll: () => void;
  userName: string;
  onUserNameChange: (name: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useLedger(): LedgerContext {
  return useOutletContext<LedgerContext>();
}
