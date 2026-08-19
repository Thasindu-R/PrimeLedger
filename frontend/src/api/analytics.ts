import { apiJson } from './client';
import { summarySchema } from '../schemas/api';
import { fromWireType } from './transactions';
import type { Summary, TransactionType } from '../types';

/** One bucket of the monthly series, as the server computed it. */
export interface MonthlyBucket {
  /** `YYYY-MM` — the bucket identity, unique across years. */
  key: string;
  income: number;
  expense: number;
}

export interface CategoryTotal {
  categoryId: string;
  category: string;
  type: TransactionType;
  total: number;
  count: number;
}

export interface AnalyticsSummary {
  totals: Summary;
  /** How many transactions the ledger holds — not how many are on this page. */
  count: number;
  /** The largest single expense across every row, for the dashboard card. */
  highestExpense: number;
  byCategory: CategoryTotal[];
  /** Oldest first. Only months with activity appear. */
  monthly: MonthlyBucket[];
  /**
   * The currency every figure above is expressed in — the profile's base,
   * converted per transaction at the rate on its own date (F-05).
   */
  currency?: string;
  /**
   * How many of `count` had no exchange rate and are therefore *missing* from
   * the totals. Normally zero; anything else means the figures understate the
   * ledger and the page has to say so rather than present them as complete.
   */
  unconverted: number;
}

/** What the figures below describe. Empty means the whole ledger. */
export interface AnalyticsScope {
  accountId?: string;
}

/**
 * The aggregates the dashboard draws, over every row the ledger holds.
 *
 * <p>These used to be reduced in the browser from the full transaction array.
 * That stopped being possible when the list became paginated: summing the
 * twenty-five rows on screen would report the current page's totals as the
 * ledger's totals, and would change every time the user turned a page.
 *
 * <p>The scope is the account selected in the header, and nothing else. It is
 * not the transactions page's filter: the user narrowing a search to groceries
 * over 50 should not silently redraw the dashboard's twelve-month chart. The
 * account is different in kind — picking one is a statement about which ledger
 * you are looking at.
 *
 * <p>Transfers are excluded from these totals by the server while still counting
 * towards account balances, so the income and expense here stay honest about
 * what was actually earned and spent (F-01).
 */
export async function fetchSummary(scope: AnalyticsScope = {}): Promise<AnalyticsSummary> {
  const query = new URLSearchParams();
  if (scope.accountId) query.set('accountId', scope.accountId);

  const suffix = query.toString() ? `?${query}` : '';
  const body = await apiJson<unknown>(`/analytics/summary${suffix}`);
  const parsed = summarySchema.parse(body);

  return {
    totals: {
      totalIncome: Number(parsed.totals.income),
      totalExpense: Number(parsed.totals.expense),
      balance: Number(parsed.totals.balance),
    },
    count: parsed.totals.count,
    highestExpense: Number(parsed.totals.highestExpense),
    byCategory: parsed.byCategory.map((row) => ({
      categoryId: row.categoryId,
      category: row.categoryName,
      type: fromWireType(row.type),
      total: Number(row.total),
      count: row.count,
    })),
    monthly: parsed.monthly.map((row) => ({
      key: row.month,
      income: Number(row.income),
      expense: Number(row.expense),
    })),
    currency: parsed.totals.currency ?? undefined,
    unconverted: parsed.totals.unconverted,
  };
}
