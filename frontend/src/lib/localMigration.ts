import type { TransactionType } from '../types';
import type { CategoryOption } from '../api/categories';
import type { TransactionInput } from '../api/transactions';

/** The key Phase 1 wrote to. Never written again — only read, then removed. */
export const LEGACY_STORAGE_KEY = 'finance_tracker_transactions';

/** Set once the user has answered, so the offer is not made on every load. */
export const MIGRATION_ANSWERED_KEY = 'primeledger_local_migration_answered';

export interface LegacyTransaction {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  date: string;
  description?: string;
}

/**
 * Transactions left in this browser by the pre-server version of the app
 * (FR-46).
 *
 * <p>Deliberately forgiving: this data was written by an older build and may be
 * partial, hand-edited, or from a different app that happened to use the key.
 * Anything that does not look like a transaction is dropped rather than allowed
 * to fail the whole migration — the alternative is a user who can never get past
 * one malformed row.
 */
export function readLegacyTransactions(
  storage: Storage = localStorage,
): LegacyTransaction[] {
  let raw: string | null;
  try {
    raw = storage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    // Safari in private mode throws rather than returning null.
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isLegacyTransaction);
}

function isLegacyTransaction(value: unknown): value is LegacyTransaction {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    (candidate.type === 'income' || candidate.type === 'expense') &&
    typeof candidate.category === 'string' &&
    typeof candidate.amount === 'number' &&
    Number.isFinite(candidate.amount) &&
    candidate.amount > 0 &&
    typeof candidate.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.date)
  );
}

export function hasAnsweredMigration(storage: Storage = localStorage): boolean {
  try {
    return storage.getItem(MIGRATION_ANSWERED_KEY) !== null;
  } catch {
    return true; // No storage means no offer to make.
  }
}

export function rememberMigrationAnswer(storage: Storage = localStorage): void {
  try {
    storage.setItem(MIGRATION_ANSWERED_KEY, new Date().toISOString());
  } catch {
    // Not being able to record the answer is not worth failing the migration.
  }
}

export function discardLegacyTransactions(storage: Storage = localStorage): void {
  try {
    storage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Nothing to do; the data simply stays and the answer flag stops the offer.
  }
}

export interface PreparedMigration {
  ready: TransactionInput[];
  /** Names that matched no category the account has, so nothing can be filed under them. */
  unmatched: string[];
}

/**
 * Matches legacy rows to the categories this account actually has.
 *
 * <p>The old data names its category; the API addresses categories by id. The
 * twelve seeded system categories use the same names as the hard-coded list did,
 * so nearly everything matches — but a name that does not is reported rather
 * than quietly refiled under something else. Guessing a category is worse than
 * saying which rows could not be moved.
 */
export function prepareMigration(
  legacy: LegacyTransaction[],
  categories: CategoryOption[],
): PreparedMigration {
  const byKey = new Map(
    categories.map((category) => [key(category.kind, category.name), category.id]),
  );

  const ready: TransactionInput[] = [];
  const unmatched = new Set<string>();

  for (const transaction of legacy) {
    const categoryId = byKey.get(key(transaction.type, transaction.category));

    if (!categoryId) {
      unmatched.add(transaction.category);
      continue;
    }

    ready.push({
      type: transaction.type,
      categoryId,
      amount: transaction.amount,
      date: transaction.date,
      description: transaction.description,
    });
  }

  return { ready, unmatched: [...unmatched] };
}

function key(kind: TransactionType, name: string): string {
  return `${kind}:${name.trim().toLowerCase()}`;
}
