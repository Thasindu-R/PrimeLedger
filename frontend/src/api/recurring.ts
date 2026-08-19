import { apiJson } from './client';
import { recurringRuleSchema, type WireRecurringRule } from '../schemas/api';
import type { Frequency, RecurringRule, TransactionType } from '../types';
import { z } from 'zod';

export interface RecurringRuleInput {
  name: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  description?: string;
  frequency: Frequency;
  interval: number;
  startsOn: string;
  endsOn?: string;
  paused?: boolean;
}

/**
 * Every rule, soonest occurrence first.
 *
 * <p>Paused and finished rules come back too, flagged rather than filtered. A
 * rule that has quietly stopped firing is the one a user most needs to be able
 * to find, and a list that hid it would leave them wondering why their rent
 * stopped appearing.
 */
export async function listRecurringRules(): Promise<RecurringRule[]> {
  const body = await apiJson<unknown>('/recurring');
  return recurringRuleSchema.array().parse(body).map(toRule);
}

export async function createRecurringRule(input: RecurringRuleInput): Promise<RecurringRule> {
  const body = await apiJson<unknown>('/recurring', {
    method: 'POST',
    body: JSON.stringify(toWire(input)),
  });
  return toRule(recurringRuleSchema.parse(body));
}

export async function updateRecurringRule(
  id: string,
  input: RecurringRuleInput,
): Promise<RecurringRule> {
  const body = await apiJson<unknown>(`/recurring/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toWire(input)),
  });
  return toRule(recurringRuleSchema.parse(body));
}

/** The rule goes; the transactions it created stay, severed from it. */
export async function deleteRecurringRule(id: string): Promise<void> {
  await apiJson<void>(`/recurring/${id}`, { method: 'DELETE' });
}

/**
 * Materialise anything due now, rather than waiting for tonight's job.
 *
 * <p>Idempotent by construction — it is the same path the scheduler takes — so
 * a user who presses it twice gets nothing the second time.
 *
 * @returns how many transactions were created
 */
export async function runRecurringNow(): Promise<number> {
  const body = await apiJson<unknown>('/recurring/run', { method: 'POST' });
  return z.object({ created: z.number() }).parse(body).created;
}

function toWire(input: RecurringRuleInput) {
  return {
    name: input.name,
    accountId: input.accountId,
    categoryId: input.categoryId,
    // The app speaks lower case; the API sends and expects upper (see
    // schemas/api.ts). The translation lives here, as it does for transactions.
    type: input.type.toUpperCase(),
    amount: input.amount.toFixed(2),
    description: input.description || undefined,
    frequency: input.frequency,
    interval: input.interval,
    startsOn: input.startsOn,
    endsOn: input.endsOn || undefined,
    paused: input.paused ?? false,
  };
}

export function toRule(wire: WireRecurringRule): RecurringRule {
  return {
    id: wire.id,
    name: wire.name,
    accountId: wire.accountId,
    accountName: wire.accountName ?? undefined,
    categoryId: wire.categoryId,
    category: wire.categoryName,
    categoryColour: wire.categoryColour ?? undefined,
    type: wire.type === 'INCOME' ? 'income' : 'expense',
    amount: Number(wire.amount),
    currency: wire.currency,
    description: wire.description ?? undefined,
    frequency: wire.frequency,
    interval: wire.interval,
    startsOn: wire.startsOn,
    nextRunOn: wire.nextRunOn ?? undefined,
    endsOn: wire.endsOn ?? undefined,
    isPaused: wire.paused,
    isFinished: wire.finished,
    lastRunOn: wire.lastRunOn ?? undefined,
    generatedCount: wire.generatedCount,
  };
}
