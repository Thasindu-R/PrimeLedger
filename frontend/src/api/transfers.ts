import { apiJson } from './client';
import { transferSchema } from '../schemas/api';
import { toTransaction } from './transactions';
import type { Transaction } from '../types';

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  description?: string;
}

export interface TransferPair {
  /** The expense leg, on the source account. */
  from: Transaction;
  /** The income leg, on the destination account. */
  to: Transaction;
}

/**
 * Moves money between two of the caller's own accounts (F-01).
 *
 * <p>Both legs come back rather than one synthetic transfer object, because both
 * are real rows the user will see in their ledger and either is the one they
 * might click on.
 *
 * <p>Refused with 422: the same account twice, two accounts in different
 * currencies (conversion is F-05), an archived account, or a future date. The
 * form checks the first two before submitting so the common mistakes are caught
 * without a round trip; the server checks all of them regardless.
 */
export async function createTransfer(input: TransferInput): Promise<TransferPair> {
  const body = await apiJson<unknown>('/transfers', {
    method: 'POST',
    body: JSON.stringify({
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amount: input.amount.toFixed(2),
      occurredOn: input.date,
      description: input.description?.trim() || undefined,
    }),
  });

  const parsed = transferSchema.parse(body);
  return { from: toTransaction(parsed.from), to: toTransaction(parsed.to) };
}

/**
 * Deletes both legs, given either one.
 *
 * <p>Money that left an account and arrived nowhere is the one state a ledger
 * must not reach, so there is no way to delete half a transfer — deleting a leg
 * through the ordinary transaction endpoint does the same thing.
 */
export async function deleteTransfer(legId: string): Promise<void> {
  await apiJson<void>(`/transfers/${legId}`, { method: 'DELETE' });
}
