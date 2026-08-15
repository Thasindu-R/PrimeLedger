import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createTransaction,
  listTransactions,
  toTransaction,
  toWireType,
  fromWireType,
} from './transactions';
import type { WireTransaction } from '../schemas/api';

const originalFetch = globalThis.fetch;

function respondWith(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function wireTransaction(overrides: Partial<WireTransaction> = {}): WireTransaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    categoryName: 'Groceries',
    type: 'EXPENSE',
    amount: '42.50',
    currency: 'USD',
    occurredOn: '2026-08-10',
    description: 'Weekly shop',
    transfer: false,
    ...overrides,
  };
}

function wirePage(items: unknown[]) {
  return {
    content: items,
    page: 0,
    size: 25,
    totalElements: items.length,
    totalPages: 1,
    first: true,
    last: true,
  };
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('the enum casing boundary', () => {
  it('translates between the app vocabulary and the wire vocabulary', () => {
    // The API sends "EXPENSE" and rejects ?type=expense with a 400. Getting this
    // backwards is a silent 400 on every filtered request.
    expect(toWireType('expense')).toBe('EXPENSE');
    expect(toWireType('income')).toBe('INCOME');
    expect(fromWireType('EXPENSE')).toBe('expense');
    expect(fromWireType('INCOME')).toBe('income');
  });

  it('sends the upper-case form when filtering by type', async () => {
    const fetchMock = respondWith(wirePage([]));

    await listTransactions({ filters: { type: 'income' } });

    expect(String(fetchMock.mock.calls[0][0])).toContain('type=INCOME');
  });
});

describe('mapping a transaction off the wire', () => {
  it('parses the decimal string into a number for display', () => {
    expect(toTransaction(wireTransaction()).amount).toBe(42.5);
  });

  it('carries both the category name and the id it belongs to', () => {
    const mapped = toTransaction(wireTransaction());

    expect(mapped.category).toBe('Groceries');
    expect(mapped.categoryId).toBe('cat-1');
  });

  it('renames occurredOn to the date the UI has always called it', () => {
    expect(toTransaction(wireTransaction()).date).toBe('2026-08-10');
  });

  it('treats an absent description as undefined rather than null', () => {
    const mapped = toTransaction(wireTransaction({ description: undefined }));
    expect(mapped.description).toBeUndefined();
  });
});

describe('building the list query', () => {
  it('maps the UI sort names onto the properties the server accepts', async () => {
    const fetchMock = respondWith(wirePage([]));

    await listTransactions({ sort: { field: 'category', order: 'asc' } });

    // 'category' is category.name on the entity; sending 'category' would be
    // rejected outright, and 'date' would be too — it is occurredOn.
    expect(decodeURIComponent(String(fetchMock.mock.calls[0][0]))).toContain(
      'sort=category.name,asc',
    );
  });

  it('sends the date bounds under the names the filter uses', async () => {
    const fetchMock = respondWith(wirePage([]));

    await listTransactions({
      filters: { startDate: '2026-01-01', endDate: '2026-12-31' },
    });

    const url = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(url).toContain('from=2026-01-01');
    expect(url).toContain('to=2026-12-31');
  });

  it('omits filters that are not set rather than sending empty ones', async () => {
    const fetchMock = respondWith(wirePage([]));

    await listTransactions({ filters: { search: '   ' } });

    expect(String(fetchMock.mock.calls[0][0])).not.toContain('search=');
  });
});

describe('writing a transaction', () => {
  it('sends the amount as a two-decimal string, not a float', async () => {
    const fetchMock = respondWith(wireTransaction(), 201);

    await createTransaction(
      { type: 'expense', categoryId: 'cat-1', amount: 42.5, date: '2026-08-10' },
      { accountId: 'acc-1', currency: 'USD' },
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    // "42.5" would be a valid number but not a valid NUMERIC(15,2) rendering,
    // and 0.1 + 0.2 is why this is a string at all (§7.3).
    expect(body.amount).toBe('42.50');
    expect(typeof body.amount).toBe('string');
  });

  it('attaches the account and currency the caller is writing under', async () => {
    const fetchMock = respondWith(wireTransaction(), 201);

    await createTransaction(
      { type: 'income', categoryId: 'cat-2', amount: 1, date: '2026-08-10' },
      { accountId: 'acc-9', currency: 'LKR' },
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({
      accountId: 'acc-9',
      currency: 'LKR',
      type: 'INCOME',
      occurredOn: '2026-08-10',
    });
  });
});

describe('transfer legs', () => {
  // The bug this exists to prevent: Phase 4 declared categoryId and categoryName
  // as required strings, which was true until V5 made a transfer categoryless.
  // One transfer in the ledger would then have failed the whole page's parse,
  // and the user would have seen an empty list with an error over real data.
  it('parses a leg that carries no category', () => {
    const leg = toTransaction({
      id: 'txn-out',
      accountId: 'acc-1',
      categoryId: null,
      categoryName: null,
      type: 'EXPENSE',
      amount: '250.00',
      currency: 'USD',
      occurredOn: '2026-08-10',
      description: 'To savings',
      transfer: true,
      transferPairId: 'txn-in',
    });

    expect(leg.isTransfer).toBe(true);
    expect(leg.categoryId).toBeUndefined();
    // A label for the absence of a category, not a category — inventing a real
    // "Transfer" row would put it in every picker, breakdown and budget.
    expect(leg.category).toBe('Transfer');
    expect(leg.transferPairId).toBe('txn-in');
  });

  it('reads a whole page containing a transfer', async () => {
    respondWith(
      wirePage([
        wireTransaction(),
        {
          id: 'txn-out',
          accountId: 'acc-1',
          categoryId: null,
          categoryName: null,
          type: 'EXPENSE',
          amount: '250.00',
          currency: 'USD',
          occurredOn: '2026-08-10',
          transfer: true,
          transferPairId: 'txn-in',
        },
      ]),
    );

    const page = await listTransactions();
    expect(page.items).toHaveLength(2);
    expect(page.items[1].isTransfer).toBe(true);
  });

  it('treats an ordinary transaction as not a transfer', () => {
    const ordinary = toTransaction(wireTransaction());
    expect(ordinary.isTransfer).toBe(false);
    expect(ordinary.transferPairId).toBeUndefined();
  });

  it('sends the account filter the header selector sets', async () => {
    const fetchMock = respondWith(wirePage([]));

    await listTransactions({ filters: { accountId: 'acc-7' } });

    expect(String(fetchMock.mock.calls[0][0])).toContain('accountId=acc-7');
  });
});
