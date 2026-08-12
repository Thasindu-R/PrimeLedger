import { apiJson } from './client';
import { accountSchema } from '../schemas/api';

export interface Account {
  id: string;
  name: string;
  currency: string;
}

/**
 * The account new transactions are filed under, created on first use.
 *
 * <p>`transactions.account_id` is NOT NULL, so the app cannot write anything
 * until the user owns an account, and a freshly signed-up user owns none. The
 * endpoint is idempotent — it returns the existing account when there is one —
 * so calling it as part of loading the ledger converges rather than
 * accumulating accounts.
 *
 * <p>Choosing between several accounts is Phase 5 (F-01).
 */
export async function ensureDefaultAccount(): Promise<Account> {
  const body = await apiJson<unknown>('/accounts/default', { method: 'POST' });
  return accountSchema.parse(body);
}
