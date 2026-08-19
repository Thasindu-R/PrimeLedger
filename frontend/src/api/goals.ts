import { apiJson } from './client';
import { goalSchema, type WireGoal } from '../schemas/api';
import type { Goal } from '../types';

export interface GoalInput {
  name: string;
  accountId: string;
  targetAmount: number;
  targetDate?: string;
}

/**
 * Savings goals with progress and projection.
 *
 * <p>Every derived number comes from the server rather than being computed here
 * from the account balance. The projection reads the account's trailing three
 * months of transactions, which the client does not hold — it has one page of
 * them — so computing it here would produce a confident answer from a fraction
 * of the data.
 */
export async function listGoals(): Promise<Goal[]> {
  const body = await apiJson<unknown>('/goals');
  return goalSchema.array().parse(body).map(toGoal);
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const body = await apiJson<unknown>('/goals', {
    method: 'POST',
    body: JSON.stringify(toWire(input)),
  });
  return toGoal(goalSchema.parse(body));
}

export async function updateGoal(id: string, input: GoalInput): Promise<Goal> {
  const body = await apiJson<unknown>(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toWire(input)),
  });
  return toGoal(goalSchema.parse(body));
}

/** Removes the target only; the account and its money are untouched. */
export async function deleteGoal(id: string): Promise<void> {
  await apiJson<void>(`/goals/${id}`, { method: 'DELETE' });
}

function toWire(input: GoalInput) {
  return {
    name: input.name,
    accountId: input.accountId,
    targetAmount: input.targetAmount.toFixed(2),
    targetDate: input.targetDate || undefined,
  };
}

export function toGoal(wire: WireGoal): Goal {
  return {
    id: wire.id,
    name: wire.name,
    accountId: wire.accountId,
    accountName: wire.accountName ?? undefined,
    accountColour: wire.accountColour ?? undefined,
    currency: wire.currency ?? undefined,
    targetAmount: Number(wire.targetAmount),
    targetDate: wire.targetDate ?? undefined,
    currentAmount: Number(wire.currentAmount),
    remaining: Number(wire.remaining),
    progressPercent: wire.progressPercent,
    isAchieved: wire.achieved,
    requiredMonthly:
      wire.requiredMonthly === null || wire.requiredMonthly === undefined
        ? undefined
        : Number(wire.requiredMonthly),
    monthlyRate: Number(wire.monthlyRate),
    projectedCompletion: wire.projectedCompletion ?? undefined,
    // Deliberately not `?? undefined` on a boolean: `false` is a real answer
    // ("you will not make it") and coercing it to absent would render the goal
    // as having no deadline at all.
    isOnTrack: wire.onTrack === null || wire.onTrack === undefined ? undefined : wire.onTrack,
    contributionFrom: wire.contributionFrom,
    contributionTo: wire.contributionTo,
  };
}
