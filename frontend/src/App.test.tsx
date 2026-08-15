import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { makeTransaction, daysFromToday } from './test/factories';
import { TestAuthProvider } from './test/authHarness';
import { QueryHarness } from './test/queryHarness';
import { resetFakeServer } from './test/fakeServer';

// The ledger lives on a server now, so these tests seed one rather than seeding
// localStorage. The fake applies the same filtering, sorting and aggregation the
// real API does, so a write made through the UI is visible to the next read —
// which is what the D-07 tests below actually assert.
vi.mock('./api/transactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/transactions')>();
  const fake = await import('./test/fakeServer');
  return {
    ...actual,
    listTransactions: fake.listTransactions,
    createTransaction: fake.createTransaction,
    updateTransaction: fake.updateTransaction,
    deleteTransaction: fake.deleteTransaction,
    bulkDeleteTransactions: fake.bulkDeleteTransactions,
  };
});
vi.mock('./api/categories', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/categories')>();
  const fake = await import('./test/fakeServer');
  return { ...actual, listCategories: fake.listCategories };
});
vi.mock('./api/accounts', async () => {
  const fake = await import('./test/fakeServer');
  return {
    ensureDefaultAccount: fake.ensureDefaultAccount,
    listAccounts: fake.listAccounts,
    createAccount: fake.createAccount,
    updateAccount: fake.updateAccount,
    setAccountArchived: fake.setAccountArchived,
    deleteAccount: fake.deleteAccount,
  };
});
vi.mock('./api/transfers', async () => {
  const fake = await import('./test/fakeServer');
  return { createTransfer: fake.createTransfer, deleteTransfer: fake.deleteTransfer };
});
vi.mock('./api/budgets', async () => {
  const fake = await import('./test/fakeServer');
  return {
    listBudgets: fake.listBudgets,
    createBudget: fake.createBudget,
    updateBudget: fake.updateBudget,
    deleteBudget: fake.deleteBudget,
  };
});
vi.mock('./api/notifications', async () => {
  const fake = await import('./test/fakeServer');
  return {
    listNotifications: fake.listNotifications,
    fetchUnreadCount: fake.fetchUnreadCount,
    markNotificationRead: fake.markNotificationRead,
    markAllNotificationsRead: fake.markAllNotificationsRead,
  };
});
vi.mock('./api/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/analytics')>();
  const fake = await import('./test/fakeServer');
  return { ...actual, fetchSummary: fake.fetchSummary };
});

beforeEach(() => resetFakeServer());

// These tests are about the ledger, so they run as an already signed-in user.
// The guards themselves are covered in auth/RequireAuth.test.tsx.
function renderApp(route = '/overview') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryHarness>
        <TestAuthProvider>
          <App />
        </TestAuthProvider>
      </QueryHarness>
    </MemoryRouter>,
  );
}

describe('routing', () => {
  // A chart needs data to render its heading, and the pages now wait for the
  // server before drawing anything — hence the seed and the `find` queries.
  beforeEach(() =>
    resetFakeServer([
      makeTransaction({ type: 'income', category: 'Salary', categoryId: 'cat-salary', amount: 5000, date: daysFromToday(-1) }),
      makeTransaction({ type: 'expense', category: 'Food', categoryId: 'cat-food', amount: 800, date: daysFromToday(-1) }),
    ]),
  );

  it('redirects the root path to the overview', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /statistics/i })).toBeInTheDocument();
  });

  it('renders the analytics page at its own URL', async () => {
    renderApp('/analytics');
    expect(
      await screen.findByRole('heading', { name: /monthly net savings/i }),
    ).toBeInTheDocument();
  });

  it('renders the transactions page at its own URL', async () => {
    renderApp('/transactions');
    expect(
      await screen.findByRole('heading', { name: /all transactions/i }),
    ).toBeInTheDocument();
  });

  // The two Phase 5 pages, mounted through the real shell and the real hooks
  // rather than rendered in isolation — which is what proves the wiring, not
  // just the components.
  it('renders the accounts page at its own URL', async () => {
    renderApp('/accounts');
    expect(
      await screen.findByRole('heading', { name: /^accounts$/i }),
    ).toBeInTheDocument();
    // The provisioned default account, read through useAccounts.
    expect(await screen.findByText('Everyday')).toBeInTheDocument();
  });

  it('renders the budgets page at its own URL', async () => {
    renderApp('/budgets');
    expect(
      await screen.findByRole('heading', { name: /^budgets$/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/no budgets yet/i)).toBeInTheDocument();
  });

  it('renders the settings page at its own URL', async () => {
    renderApp('/settings');
    expect(await screen.findByRole('heading', { name: /^profile$/i })).toBeInTheDocument();
  });

  it('sends an unknown URL back to the overview', async () => {
    renderApp('/does-not-exist');
    expect(await screen.findByRole('heading', { name: /statistics/i })).toBeInTheDocument();
  });

  it('navigates between tabs through real links, not tab state', async () => {
    const user = userEvent.setup();
    renderApp('/overview');

    const nav = await screen.findByRole('navigation', { name: /sections/i });
    const analyticsLink = within(nav).getByRole('link', { name: /analytics/i });
    expect(analyticsLink).toHaveAttribute('href', '/analytics');

    await user.click(analyticsLink);
    expect(
      await screen.findByRole('heading', { name: /monthly net savings/i }),
    ).toBeInTheDocument();
  });

  it('marks the current section as active for assistive technology', async () => {
    renderApp('/transactions');
    const nav = await screen.findByRole('navigation', { name: /sections/i });
    expect(within(nav).getByRole('link', { name: /transactions/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('overview panels (D-06)', () => {
  it('renders the income panel alongside the expenses panel', async () => {
    resetFakeServer([
      makeTransaction({ type: 'income', category: 'Salary', categoryId: 'cat-salary', amount: 5000, date: daysFromToday(-1) }),
      makeTransaction({ type: 'expense', category: 'Food', categoryId: 'cat-food', amount: 800, date: daysFromToday(-1) }),
    ]);
    renderApp('/overview');

    expect(await screen.findByRole('heading', { name: /all income/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /all expenses/i })).toBeInTheDocument();
  });
});

describe('period deltas (D-05)', () => {
  it('does not present fabricated month-over-month percentages', async () => {
    resetFakeServer([
      makeTransaction({ type: 'income', amount: 5000, date: daysFromToday(0) }),
    ]);
    renderApp('/overview');

    await screen.findByRole('heading', { name: /statistics/i });

    for (const fabricated of ['6.7%', '9.8%', '-8.6%', '8.7%']) {
      expect(screen.queryByText(new RegExp(fabricated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeNull();
    }
  });

  it('says so plainly when there is no prior month to compare against', async () => {
    resetFakeServer([
      makeTransaction({ type: 'income', amount: 5000, date: daysFromToday(0) }),
    ]);
    renderApp('/overview');

    // The deltas are computed from the server's monthly buckets now, but the
    // honesty rule is unchanged: no prior month means no percentage.
    expect((await screen.findAllByText(/no prior month/i)).length).toBeGreaterThan(0);
  });
});

describe('adding and editing transactions (D-07)', () => {
  it('adds a transaction through the form and shows it in the list', async () => {
    const user = userEvent.setup();
    renderApp('/overview');

    await user.click(await screen.findByRole('button', { name: /add transaction/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/description/i), 'Consulting fee');
    await user.type(within(dialog).getByLabelText(/amount/i), '12000');
    await user.click(within(dialog).getByRole('button', { name: /^add transaction$/i }));

    expect(await screen.findByText('Consulting fee')).toBeInTheDocument();
  });

  it('edits an existing transaction through the same form', async () => {
    const user = userEvent.setup();
    resetFakeServer([
      makeTransaction({
        description: 'Bus fare',
        amount: 100,
        category: 'Food',
        categoryId: 'cat-food',
        date: daysFromToday(0),
      }),
    ]);
    renderApp('/overview');

    await user.click(await screen.findByRole('button', { name: /edit bus fare/i }));
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByLabelText(/amount/i);
    await user.clear(amount);
    await user.type(amount, '175');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    // The figure appears in the row and in the summary panels alongside it.
    expect(await screen.findAllByText(/175\.00/)).not.toHaveLength(0);
    expect(screen.queryAllByText(/100\.00/)).toHaveLength(0);
  });
});

describe('figures that describe the ledger, not the page', () => {
  // 30 rows against a 25-row page. Everything below was computed by reducing
  // over the array the client held; once that array became one page, each of
  // these silently started describing 25 rows and calling it the ledger.
  function seedMoreThanOnePage() {
    const rows = Array.from({ length: 29 }, (_, i) =>
      makeTransaction({
        type: 'expense',
        category: 'Food',
        categoryId: 'cat-food',
        amount: 10,
        date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
      }),
    );
    // Dated oldest, so the default newest-first sort pushes it off page one.
    rows.push(
      makeTransaction({
        type: 'expense',
        category: 'Food',
        categoryId: 'cat-food',
        amount: 9999,
        date: '2025-01-01',
      }),
    );
    resetFakeServer(rows);
  }

  it('counts every transaction, not the 25 on screen', async () => {
    seedMoreThanOnePage();
    renderApp('/analytics');

    expect(await screen.findByText('30')).toBeInTheDocument();
  });

  it('finds the highest expense even when it is not on the current page', async () => {
    seedMoreThanOnePage();
    renderApp('/analytics');

    // 9,999 is the oldest row and therefore absent from page one entirely.
    expect(await screen.findByText(/9,999\.00/)).toBeInTheDocument();
  });

  it('reports the whole ledger in the settings count and its delete warning', async () => {
    const user = userEvent.setup();
    seedMoreThanOnePage();
    renderApp('/settings');

    expect(await screen.findByText(/30 transactions/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear all transactions/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/all 30 transactions/i)).toBeInTheDocument();
  });
});

describe('identity (D-08)', () => {
  it('greets a generic user rather than a hard-coded name', async () => {
    renderApp('/overview');
    expect(
      await screen.findByRole('heading', { name: /good morning, guest/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('@thasindu')).toBeNull();
  });
});
