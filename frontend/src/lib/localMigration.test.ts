import { describe, expect, it } from 'vitest';
import {
  LEGACY_STORAGE_KEY,
  discardLegacyTransactions,
  hasAnsweredMigration,
  prepareMigration,
  readLegacyTransactions,
  rememberMigrationAnswer,
  type LegacyTransaction,
} from './localMigration';
import type { CategoryOption } from '../api/categories';

const CATEGORIES: CategoryOption[] = [
  { id: 'cat-salary', name: 'Salary', kind: 'income', system: true, sortOrder: 0 },
  { id: 'cat-food', name: 'Food', kind: 'expense', system: true, sortOrder: 1 },
];

function legacy(overrides: Partial<LegacyTransaction> = {}): LegacyTransaction {
  return {
    id: 'old-1',
    type: 'expense',
    category: 'Food',
    amount: 250,
    date: '2026-07-01',
    description: 'Lunch',
    ...overrides,
  };
}

function seed(value: unknown) {
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(value));
}

describe('reading what the old app left behind (FR-46)', () => {
  it('finds transactions written under the Phase 1 key', () => {
    seed([legacy(), legacy({ id: 'old-2' })]);

    expect(readLegacyTransactions()).toHaveLength(2);
  });

  it('returns nothing when there is nothing there', () => {
    expect(readLegacyTransactions()).toEqual([]);
  });

  it('survives a value that is not JSON at all', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, 'not json {{{');

    expect(readLegacyTransactions()).toEqual([]);
  });

  it('survives JSON that is not an array', () => {
    seed({ nope: true });

    expect(readLegacyTransactions()).toEqual([]);
  });

  it('drops rows that do not look like transactions instead of failing entirely', () => {
    // A single hand-edited row must not be able to block the migration of the
    // hundred good ones next to it.
    seed([
      legacy(),
      { type: 'expense' },
      { ...legacy(), amount: 'lots' },
      { ...legacy(), date: 'yesterday' },
      { ...legacy(), amount: -5 },
      null,
    ]);

    expect(readLegacyTransactions()).toHaveLength(1);
  });
});

describe('matching old rows to real categories', () => {
  it('resolves a category name to the id the API addresses', () => {
    const { ready, unmatched } = prepareMigration([legacy()], CATEGORIES);

    expect(unmatched).toEqual([]);
    expect(ready).toEqual([
      {
        type: 'expense',
        categoryId: 'cat-food',
        amount: 250,
        date: '2026-07-01',
        description: 'Lunch',
      },
    ]);
  });

  it('matches regardless of the casing the old data used', () => {
    const { ready } = prepareMigration([legacy({ category: '  food ' })], CATEGORIES);

    expect(ready[0]?.categoryId).toBe('cat-food');
  });

  it('will not file an expense under a category of the other kind', () => {
    // 'Salary' exists, but only as income. Matching on name alone would build a
    // request the server rejects with a 422.
    const { ready, unmatched } = prepareMigration(
      [legacy({ category: 'Salary', type: 'expense' })],
      CATEGORIES,
    );

    expect(ready).toEqual([]);
    expect(unmatched).toEqual(['Salary']);
  });

  it('reports an unknown category once and carries the rest through', () => {
    const { ready, unmatched } = prepareMigration(
      [legacy(), legacy({ category: 'Crypto' }), legacy({ category: 'Crypto' })],
      CATEGORIES,
    );

    expect(ready).toHaveLength(1);
    expect(unmatched).toEqual(['Crypto']);
  });
});

describe('remembering the answer', () => {
  it('does not offer again once the user has answered', () => {
    expect(hasAnsweredMigration()).toBe(false);

    rememberMigrationAnswer();

    expect(hasAnsweredMigration()).toBe(true);
  });

  it('removes the local copy only when asked to', () => {
    seed([legacy()]);

    discardLegacyTransactions();

    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });
});
