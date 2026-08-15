import { apiJson } from './client';
import { accountSchema, type WireAccount } from '../schemas/api';
import type { Account, AccountType } from '../types';

export interface AccountInput {
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: number;
  colour?: string;
}

/**
 * The caller's accounts, with balances, ordered by name.
 *
 * <p>Archived accounts are left out unless asked for: an account is archived
 * precisely so it stops appearing in pickers, and the accounts page is the one
 * place that offers to show them anyway.
 */
export async function listAccounts(includeArchived = false): Promise<Account[]> {
  const query = includeArchived ? '?includeArchived=true' : '';
  const body = await apiJson<unknown>(`/accounts${query}`);
  return accountSchema.array().parse(body).map(toAccount);
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const body = await apiJson<unknown>('/accounts', {
    method: 'POST',
    body: JSON.stringify(toWire(input)),
  });
  return toAccount(accountSchema.parse(body));
}

export async function updateAccount(id: string, input: AccountInput): Promise<Account> {
  const body = await apiJson<unknown>(`/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toWire(input)),
  });
  return toAccount(accountSchema.parse(body));
}

/**
 * Closes an account without losing what happened in it.
 *
 * <p>The operation that matches closing a real account. `transactions.account_id`
 * is `ON DELETE RESTRICT`, so a hard delete either fails or takes a year of
 * history with it; archiving hides the account from pickers and refuses new
 * transactions while keeping every row already filed under it.
 */
export async function setAccountArchived(id: string, archived: boolean): Promise<Account> {
  const body = await apiJson<unknown>(
    `/accounts/${id}/${archived ? 'archive' : 'unarchive'}`,
    { method: 'POST' },
  );
  return toAccount(accountSchema.parse(body));
}

/** Only permitted while the account is empty; the server answers 422 otherwise. */
export async function deleteAccount(id: string): Promise<void> {
  await apiJson<void>(`/accounts/${id}`, { method: 'DELETE' });
}

/**
 * The account new transactions are filed under, created on first use.
 *
 * <p>`transactions.account_id` is NOT NULL, so the app cannot write anything
 * until the user owns an account, and a freshly signed-up user owns none. The
 * endpoint is idempotent — it returns the existing account when there is one —
 * so calling it as part of loading the ledger converges rather than
 * accumulating accounts.
 */
export async function ensureDefaultAccount(): Promise<Account> {
  const body = await apiJson<unknown>('/accounts/default', { method: 'POST' });
  return toAccount(accountSchema.parse(body));
}

function toWire(input: AccountInput) {
  return {
    name: input.name.trim(),
    type: input.type,
    currency: input.currency.trim().toUpperCase(),
    // A string with two decimals, for the same reason a transaction's amount is.
    openingBalance: input.openingBalance.toFixed(2),
    colour: input.colour || undefined,
  };
}

export function toAccount(wire: WireAccount): Account {
  return {
    id: wire.id,
    name: wire.name,
    type: wire.type,
    currency: wire.currency,
    openingBalance: Number(wire.openingBalance),
    balance: Number(wire.balance),
    colour: wire.colour ?? undefined,
    isArchived: wire.archived,
    transactionCount: wire.transactionCount,
  };
}
