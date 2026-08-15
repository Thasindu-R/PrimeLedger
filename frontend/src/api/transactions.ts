import { apiJson } from './client';
import {
  pageSchema,
  transactionSchema,
  type WireTransaction,
  type WireType,
} from '../schemas/api';
import type { Transaction, TransactionType } from '../types';

export interface TransactionFilters {
  type?: TransactionType;
  categoryId?: string;
  /** Undefined means every account, which is the default the app opens on. */
  accountId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
}

/** The orderings the server will accept; see TransactionController.SORTABLE. */
export type SortField = 'date' | 'amount' | 'category' | 'type';
export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface ListParams {
  filters?: TransactionFilters;
  sort?: SortConfig;
  page?: number;
  size?: number;
}

export const DEFAULT_PAGE_SIZE = 25;

/**
 * The client's sort vocabulary translated into JPA property paths.
 *
 * <p>`date` and `category` are what the UI calls them; `occurredOn` and
 * `category.name` are what the entity calls them. The server rejects anything
 * not on its list with a 400 rather than silently ignoring it, so this map has
 * to stay in step with `TransactionController.SORTABLE` — which is the point of
 * having it in one place.
 */
const SORT_PROPERTY: Record<SortField, string> = {
  date: 'occurredOn',
  amount: 'amount',
  category: 'category.name',
  type: 'type',
};

export async function listTransactions({
  filters = {},
  sort,
  page = 0,
  size = DEFAULT_PAGE_SIZE,
}: ListParams = {}): Promise<Page<Transaction>> {
  const query = new URLSearchParams();

  if (filters.type) query.set('type', toWireType(filters.type));
  if (filters.categoryId) query.set('categoryId', filters.categoryId);
  if (filters.accountId) query.set('accountId', filters.accountId);
  if (filters.startDate) query.set('from', filters.startDate);
  if (filters.endDate) query.set('to', filters.endDate);
  if (filters.search?.trim()) query.set('search', filters.search.trim());
  if (filters.minAmount !== undefined) query.set('minAmount', String(filters.minAmount));
  if (filters.maxAmount !== undefined) query.set('maxAmount', String(filters.maxAmount));

  query.set('page', String(page));
  query.set('size', String(size));
  if (sort) query.set('sort', `${SORT_PROPERTY[sort.field]},${sort.order}`);

  const body = await apiJson<unknown>(`/transactions?${query}`);
  const parsed = pageSchema(transactionSchema).parse(body);

  return {
    items: parsed.content.map(toTransaction),
    page: parsed.page,
    size: parsed.size,
    totalElements: parsed.totalElements,
    totalPages: parsed.totalPages,
    first: parsed.first,
    last: parsed.last,
  };
}

export interface TransactionInput {
  type: TransactionType;
  categoryId: string;
  amount: number;
  date: string;
  description?: string;
}

export interface WriteContext {
  accountId: string;
  currency: string;
}

export async function createTransaction(
  input: TransactionInput,
  context: WriteContext,
): Promise<Transaction> {
  const body = await apiJson<unknown>('/transactions', {
    method: 'POST',
    body: JSON.stringify(toWire(input, context)),
  });
  return toTransaction(transactionSchema.parse(body));
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
  context: WriteContext,
): Promise<Transaction> {
  const body = await apiJson<unknown>(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toWire(input, context)),
  });
  return toTransaction(transactionSchema.parse(body));
}

/** Soft delete: the row is retained server-side and reads stop returning it. */
export async function deleteTransaction(id: string): Promise<void> {
  await apiJson<void>(`/transactions/${id}`, { method: 'DELETE' });
}

export async function bulkDeleteTransactions(ids: string[]): Promise<number> {
  const body = await apiJson<{ deleted: number }>('/transactions/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
  return body.deleted;
}

function toWire(input: TransactionInput, context: WriteContext) {
  return {
    accountId: context.accountId,
    categoryId: input.categoryId,
    type: toWireType(input.type),
    // Sent as a string with two decimals so the value the server stores is the
    // value the user typed, not the nearest double to it.
    amount: input.amount.toFixed(2),
    currency: context.currency,
    occurredOn: input.date,
    description: input.description?.trim() || undefined,
  };
}

export function toTransaction(wire: WireTransaction): Transaction {
  return {
    id: wire.id,
    type: fromWireType(wire.type),
    // A transfer leg has no category. "Transfer" is a label for the absence of
    // one, applied here at the boundary rather than by every component that
    // renders a row — and deliberately not a real category, which would then be
    // offered in the add form and counted in the breakdown.
    category: wire.categoryName ?? (wire.transfer ? 'Transfer' : ''),
    categoryId: wire.categoryId ?? undefined,
    accountId: wire.accountId,
    isTransfer: wire.transfer,
    transferPairId: wire.transferPairId ?? undefined,
    amount: Number(wire.amount),
    date: wire.occurredOn,
    description: wire.description ?? undefined,
  };
}

export function toWireType(type: TransactionType): WireType {
  return type === 'income' ? 'INCOME' : 'EXPENSE';
}

export function fromWireType(type: WireType): TransactionType {
  return type === 'INCOME' ? 'income' : 'expense';
}
