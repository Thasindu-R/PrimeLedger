import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { makeTransaction, seedStorage, daysFromToday } from './test/factories';
import { TestAuthProvider } from './test/authHarness';

// These tests are about the ledger, so they run as an already signed-in user.
// The guards themselves are covered in auth/RequireAuth.test.tsx.
function renderApp(route = '/overview') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <TestAuthProvider>
        <App />
      </TestAuthProvider>
    </MemoryRouter>,
  );
}

describe('routing', () => {
  it('redirects the root path to the overview', () => {
    renderApp('/');
    expect(screen.getByRole('heading', { name: /statistics/i })).toBeInTheDocument();
  });

  it('renders the analytics page at its own URL', () => {
    renderApp('/analytics');
    expect(screen.getByRole('heading', { name: /monthly net savings/i })).toBeInTheDocument();
  });

  it('renders the transactions page at its own URL', () => {
    renderApp('/transactions');
    expect(screen.getByRole('heading', { name: /all transactions/i })).toBeInTheDocument();
  });

  it('renders the settings page at its own URL', () => {
    renderApp('/settings');
    expect(screen.getByRole('heading', { name: /^profile$/i })).toBeInTheDocument();
  });

  it('sends an unknown URL back to the overview', () => {
    renderApp('/does-not-exist');
    expect(screen.getByRole('heading', { name: /statistics/i })).toBeInTheDocument();
  });

  it('navigates between tabs through real links, not tab state', async () => {
    const user = userEvent.setup();
    renderApp('/overview');

    const nav = screen.getByRole('navigation', { name: /sections/i });
    const analyticsLink = within(nav).getByRole('link', { name: /analytics/i });
    expect(analyticsLink).toHaveAttribute('href', '/analytics');

    await user.click(analyticsLink);
    expect(screen.getByRole('heading', { name: /monthly net savings/i })).toBeInTheDocument();
  });

  it('marks the current section as active for assistive technology', () => {
    renderApp('/transactions');
    const nav = screen.getByRole('navigation', { name: /sections/i });
    expect(within(nav).getByRole('link', { name: /transactions/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('overview panels (D-06)', () => {
  it('renders the income panel alongside the expenses panel', () => {
    seedStorage([
      makeTransaction({ type: 'income', category: 'Salary', amount: 5000, date: daysFromToday(-1) }),
      makeTransaction({ type: 'expense', category: 'Food', amount: 800, date: daysFromToday(-1) }),
    ]);
    renderApp('/overview');

    expect(screen.getByRole('heading', { name: /all income/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /all expenses/i })).toBeInTheDocument();
  });
});

describe('period deltas (D-05)', () => {
  it('does not present fabricated month-over-month percentages', () => {
    seedStorage([
      makeTransaction({ type: 'income', amount: 5000, date: daysFromToday(0) }),
    ]);
    renderApp('/overview');

    for (const fabricated of ['6.7%', '9.8%', '-8.6%', '8.7%']) {
      expect(screen.queryByText(new RegExp(fabricated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeNull();
    }
  });

  it('says so plainly when there is no prior month to compare against', () => {
    seedStorage([
      makeTransaction({ type: 'income', amount: 5000, date: daysFromToday(0) }),
    ]);
    renderApp('/overview');

    expect(screen.getAllByText(/no prior month/i).length).toBeGreaterThan(0);
  });
});

describe('adding and editing transactions (D-07)', () => {
  it('adds a transaction through the form and shows it in the list', async () => {
    const user = userEvent.setup();
    renderApp('/overview');

    await user.click(screen.getByRole('button', { name: /add transaction/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/description/i), 'Consulting fee');
    await user.type(within(dialog).getByLabelText(/amount/i), '12000');
    await user.click(within(dialog).getByRole('button', { name: /^add transaction$/i }));

    expect(await screen.findByText('Consulting fee')).toBeInTheDocument();
  });

  it('edits an existing transaction through the same form', async () => {
    const user = userEvent.setup();
    seedStorage([
      makeTransaction({ description: 'Bus fare', amount: 100, date: daysFromToday(0) }),
    ]);
    renderApp('/overview');

    await user.click(screen.getByRole('button', { name: /edit bus fare/i }));
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

describe('identity (D-08)', () => {
  it('greets a generic user rather than a hard-coded name', () => {
    renderApp('/overview');
    expect(screen.getByRole('heading', { name: /good morning, guest/i })).toBeInTheDocument();
    expect(screen.queryByText('@thasindu')).toBeNull();
  });
});
