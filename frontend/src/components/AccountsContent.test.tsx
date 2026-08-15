import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountsContent } from './AccountsContent';
import { makeAccount } from '../test/factories';

function renderContent(props: Partial<React.ComponentProps<typeof AccountsContent>> = {}) {
  const handlers = {
    onIncludeArchivedChange: vi.fn(),
    onRetry: vi.fn(),
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onSetArchived: vi.fn(),
    onDelete: vi.fn(),
    onTransfer: vi.fn(),
  };

  const accounts = props.accounts ?? [];
  render(
    <AccountsContent
      accounts={accounts}
      activeAccounts={accounts.filter((account) => !account.isArchived)}
      includeArchived={false}
      isLoading={false}
      error={null}
      isMutating={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('AccountsContent', () => {
  it('shows each account with the balance the server derived', () => {
    renderContent({
      accounts: [
        makeAccount({ id: 'a', name: 'Everyday', balance: 1240.75, transactionCount: 12 }),
        makeAccount({ id: 'b', name: 'Savings', type: 'SAVINGS', balance: 8000 }),
      ],
    });

    expect(screen.getByText('$1,240.75')).toBeInTheDocument();
    expect(screen.getByText('$8,000.00')).toBeInTheDocument();
  });

  it('adds up only what can honestly be added up', () => {
    // Two currencies cannot be summed without a rate, which is F-05. Showing a
    // total anyway would produce a number that is not money in any currency.
    renderContent({
      accounts: [
        makeAccount({ id: 'a', name: 'Everyday', balance: 100 }),
        makeAccount({ id: 'b', name: 'Euros', currency: 'EUR', balance: 100 }),
      ],
    });
    expect(screen.queryByText(/across .* open account/i)).not.toBeInTheDocument();
  });

  it('sums balances when every account is in one currency', () => {
    renderContent({
      accounts: [
        makeAccount({ id: 'a', name: 'Everyday', balance: 100 }),
        makeAccount({ id: 'b', name: 'Savings', balance: 250 }),
      ],
    });
    expect(screen.getByText(/\$350\.00 across 2 open accounts/)).toBeInTheDocument();
  });

  it('offers delete only while the account is empty', () => {
    renderContent({
      accounts: [
        makeAccount({ id: 'a', name: 'Empty', transactionCount: 0 }),
        makeAccount({ id: 'b', name: 'Used', transactionCount: 5 }),
      ],
    });

    // An account with history cannot be deleted — archiving is what closing one
    // means — so a live button would exist purely to produce a 422.
    expect(screen.getByRole('button', { name: /delete empty/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete used/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /archive used/i })).toBeInTheDocument();
  });

  it('archives through the callback rather than deleting', async () => {
    const user = userEvent.setup();
    const { onSetArchived } = renderContent({
      accounts: [makeAccount({ id: 'a', name: 'Old card', transactionCount: 3 })],
    });

    await user.click(screen.getByRole('button', { name: /archive old card/i }));
    expect(onSetArchived).toHaveBeenCalledWith('a', true);
  });

  it('offers to reopen an archived account', async () => {
    const user = userEvent.setup();
    const { onSetArchived } = renderContent({
      accounts: [makeAccount({ id: 'a', name: 'Old card', isArchived: true })],
      includeArchived: true,
    });

    // Exact, so the "Show archived" checkbox above does not also match.
    expect(screen.getByText('Archived')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reopen old card/i }));
    expect(onSetArchived).toHaveBeenCalledWith('a', false);
  });

  it('cannot start a transfer without two open accounts', () => {
    renderContent({ accounts: [makeAccount({ id: 'a' })] });
    expect(screen.getByRole('button', { name: /transfer/i })).toBeDisabled();
  });

  it('enables the transfer once there are two', () => {
    renderContent({
      accounts: [makeAccount({ id: 'a' }), makeAccount({ id: 'b', name: 'Savings' })],
    });
    expect(screen.getByRole('button', { name: /transfer/i })).toBeEnabled();
  });
});
