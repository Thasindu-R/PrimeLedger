import { apiJson } from './client';
import { budgetSchema, type WireBudget } from '../schemas/api';
import type { Budget, BudgetPeriod } from '../types';

export interface BudgetInput {
  categoryId: string;
  period: BudgetPeriod;
  limit: number;
  /** Optional; the server defaults to the start of the period containing today. */
  startsOn?: string;
  /**
   * Optional, and deliberately not sent by the form. The server defaults it to
   * the caller's base currency on create and refuses to change it on update, so
   * the client naming it could only ever agree with the server or be rejected.
   */
  currency?: string;
}

/**
 * The budgets in force, with spend for the current period.
 *
 * <p>One entry per category and period length: the most recent limit that had
 * already started. Superseded limits stay in the table so past periods keep
 * reporting against the limit that actually applied — raising August's grocery
 * budget must not rewrite what July was measured against.
 */
export async function listBudgets(): Promise<Budget[]> {
  const body = await apiJson<unknown>('/budgets');
  return budgetSchema.array().parse(body).map(toBudget);
}

export async function createBudget(input: BudgetInput): Promise<Budget> {
  const body = await apiJson<unknown>('/budgets', {
    method: 'POST',
    body: JSON.stringify(toWire(input)),
  });
  return toBudget(budgetSchema.parse(body));
}

/** Only for a period that has not ended; editing a finished one is a 422. */
export async function updateBudget(id: string, input: BudgetInput): Promise<Budget> {
  const body = await apiJson<unknown>(`/budgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toWire(input)),
  });
  return toBudget(budgetSchema.parse(body));
}

export async function deleteBudget(id: string): Promise<void> {
  await apiJson<void>(`/budgets/${id}`, { method: 'DELETE' });
}

function toWire(input: BudgetInput) {
  return {
    categoryId: input.categoryId,
    period: input.period,
    limitAmount: input.limit.toFixed(2),
    startsOn: input.startsOn || undefined,
    currency: input.currency || undefined,
  };
}

export function toBudget(wire: WireBudget): Budget {
  return {
    id: wire.id,
    categoryId: wire.categoryId,
    category: wire.categoryName,
    categoryColour: wire.categoryColour ?? undefined,
    period: wire.period,
    limit: Number(wire.limitAmount),
    currency: wire.currency,
    startsOn: wire.startsOn,
    periodStart: wire.periodStart,
    periodEnd: wire.periodEnd,
    spent: Number(wire.spent),
    remaining: Number(wire.remaining),
    percentUsed: wire.percentUsed,
    status: wire.status,
    unconverted: wire.unconverted,
  };
}
