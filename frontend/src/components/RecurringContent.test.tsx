import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecurringContent } from './RecurringContent';
import type { Account, RecurringRule } from '../types';
import type { CategoryOption } from '../api/categories';

const CATEGORIES: CategoryOption[] = [
  { id: 'cat-rent', name: 'Rent', kind: 'expense', system: true, sortOrder: 0 },
  { id: 'cat-salary', name: 'Salary', kind: 'income', system: true, sortOrder: 1 },
];

const ACCOUNTS: Account[] = [
  {
    id: 'acc-1',
    name: 'Everyday',
    type: 'CHECKING',
    currency: 'USD',
    openingBalance: 0,
    balance: 0,
    isArchived: false,
    transactionCount: 0,
  },
];

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-1',
    name: 'Rent',
    accountId: 'acc-1',
    accountName: 'Everyday',
    categoryId: 'cat-rent',
    category: 'Rent',
    type: 'expense',
    amount: 1500,
    currency: 'USD',
    frequency: 'MONTHLY',
    interval: 1,
    startsOn: '2026-01-31',
    nextRunOn: '2026-09-30',
    isPaused: false,
    isFinished: false,
    generatedCount: 0,
    ...overrides,
  };
}

function renderContent(props: Partial<React.ComponentProps<typeof RecurringContent>> = {}) {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onRetry: vi.fn(),
    onRunDue: vi.fn(),
  };

  render(
    <RecurringContent
      rules={[]}
      accounts={ACCOUNTS}
      categories={CATEGORIES}
      isLoading={false}
      error={null}
      isMutating={false}
      isRunning={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('RecurringContent', () => {
  it('offers first-run guidance rather than an empty panel', () => {
    renderContent();
    expect(screen.getByText(/no recurring rules/i)).toBeInTheDocument();
  });

  it('shows the schedule in words and the next occurrence', () => {
    renderContent({ rules: [makeRule({ frequency: 'WEEKLY', interval: 2 })] });

    expect(screen.getByText(/every 2 weeks/i)).toBeInTheDocument();
    // The month abbreviation is ICU's, not ours — "Sep" on some runtimes and
    // "Sept" on others — so the assertion is about the date, not the locale.
    expect(screen.getByText(/next 30 sept? 2026/i)).toBeInTheDocument();
  });

  it('shows a paused rule as paused, and offers to resume it', () => {
    renderContent({ rules: [makeRule({ isPaused: true })] });

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume rent/i })).toBeEnabled();
  });

  /**
   * Three states, not two. A finished rule is not something the user paused and
   * cannot be resumed by them, so an enabled button here would be offering a
   * click that does nothing.
   */
  it('shows a finished rule as finished, with nothing left to pause', () => {
    renderContent({ rules: [makeRule({ isFinished: true, nextRunOn: undefined })] });

    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(screen.getByText(/no more due/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause rent/i })).toBeDisabled();
  });

  it('pauses a rule by editing the one field, leaving the rest of it alone', async () => {
    const user = userEvent.setup();
    const { onEdit } = renderContent({ rules: [makeRule({ amount: 1500 })] });

    await user.click(screen.getByRole('button', { name: /pause rent/i }));

    expect(onEdit).toHaveBeenCalledWith(
      'rule-1',
      expect.objectContaining({ paused: true, amount: 1500, frequency: 'MONTHLY' }),
    );
  });

  /**
   * The obvious fear when deleting a rule is that a year of rent goes with it.
   * The dialog has to answer that before the user clicks, not after.
   */
  it('promises the generated transactions survive before deleting a rule', async () => {
    const user = userEvent.setup();
    renderContent({ rules: [makeRule({ generatedCount: 7 })] });

    await user.click(screen.getByRole('button', { name: /delete rent/i }));

    expect(screen.getByText(/7 transactions it has already created stay/i)).toBeInTheDocument();
  });

  it('runs the due rules on demand so the nightly job can be seen working', async () => {
    const user = userEvent.setup();
    const { onRunDue } = renderContent({ rules: [makeRule()] });

    await user.click(screen.getByRole('button', { name: /run due now/i }));

    expect(onRunDue).toHaveBeenCalled();
  });

  it('has nothing to run when there are no rules', () => {
    renderContent();
    expect(screen.getByRole('button', { name: /run due now/i })).toBeDisabled();
  });
});
