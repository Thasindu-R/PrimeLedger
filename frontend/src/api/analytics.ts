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
}

/**
 * The aggregates the dashboard draws, over every row the ledger holds.
 *
 * <p>These used to be reduced in the browser from the full transaction array.
 * That stopped being possible when the list became paginated: summing the
 * twenty-five rows on screen would report the current page's totals as the
 * ledger's totals, and would change every time the user turned a page.
 */
export async function fetchSummary(): Promise<AnalyticsSummary> {
  const body = await apiJson<unknown>('/analytics/summary');
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
  };
}
