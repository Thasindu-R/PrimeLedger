import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalsContent } from './GoalsContent';
import type { Account, Goal } from '../types';

const ACCOUNTS: Account[] = [
  {
    id: 'acc-savings',
    name: 'Savings',
    type: 'SAVINGS',
    currency: 'USD',
    openingBalance: 0,
    balance: 2000,
    isArchived: false,
    transactionCount: 3,
  },
];

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    name: 'Emergency fund',
    accountId: 'acc-savings',
    accountName: 'Savings',
    currency: 'USD',
    targetAmount: 5000,
    targetDate: '2027-08-31',
    currentAmount: 2000,
    remaining: 3000,
    progressPercent: 40,
    isAchieved: false,
    requiredMonthly: 250,
    monthlyRate: 500,
    projectedCompletion: '2027-02-19',
    isOnTrack: true,
    contributionFrom: '2026-05-19',
    contributionTo: '2026-08-19',
    ...overrides,
  };
}

function renderContent(props: Partial<React.ComponentProps<typeof GoalsContent>> = {}) {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onRetry: vi.fn(),
  };

  render(
    <GoalsContent
      goals={[]}
      accounts={ACCOUNTS}
      isLoading={false}
      error={null}
      isMutating={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('GoalsContent', () => {
  it('offers first-run guidance rather than an empty panel', () => {
    renderContent();
    expect(screen.getByText(/no savings goals/i)).toBeInTheDocument();
  });

  /**
   * The projection is what makes this more than a progress bar, so the card has
   * to say both numbers: what the user is actually saving, and what the date
   * asks for. One without the other answers the wrong question.
   */
  it('reports the observed rate and the required one, not just progress', () => {
    renderContent({ goals: [makeGoal()] });

    expect(screen.getByText(/\$500\.00 a month/)).toBeInTheDocument();
    expect(screen.getByText(/19 Feb 2027/)).toBeInTheDocument();
    expect(screen.getByText(/\$250\.00/)).toBeInTheDocument();
    expect(screen.getByText('On track.')).toBeInTheDocument();
  });

  it('says plainly when the current rate will not make the deadline', () => {
    renderContent({
      goals: [makeGoal({ isOnTrack: false, monthlyRate: 50, projectedCompletion: '2031-01-31' })],
    });

    expect(screen.getByText(/not on track for 31 aug 2027/i)).toBeInTheDocument();
  });

  /**
   * A rate of zero has no projection to offer, and inventing one would be
   * worse than saying so — "you will arrive never" is not a date.
   */
  it('explains the absence of a projection when nothing is going in', () => {
    renderContent({ goals: [makeGoal({ monthlyRate: 0, projectedCompletion: undefined })] });

    expect(screen.getByText(/nothing has gone in since/i)).toBeInTheDocument();
  });

  it('congratulates a met goal instead of projecting past it', () => {
    renderContent({
      goals: [
        makeGoal({
          isAchieved: true,
          currentAmount: 5200,
          remaining: 0,
          progressPercent: 104,
          requiredMonthly: undefined,
          projectedCompletion: undefined,
        }),
      ],
    });

    expect(screen.getByText(/reached\. nice\./i)).toBeInTheDocument();
  });

  it('shows an undated goal as having no deadline rather than a missing one', () => {
    renderContent({
      goals: [makeGoal({ targetDate: undefined, isOnTrack: undefined, requiredMonthly: undefined })],
    });

    expect(screen.getByText(/no deadline/i)).toBeInTheDocument();
    expect(screen.queryByText(/not on track/i)).not.toBeInTheDocument();
    expect(screen.queryByText('On track.')).not.toBeInTheDocument();
  });

  /**
   * A goal owns no money. Deleting one must not read as though it might take
   * the savings with it.
   */
  it('promises the account survives before deleting a goal', async () => {
    const user = userEvent.setup();
    renderContent({ goals: [makeGoal()] });

    await user.click(screen.getByRole('button', { name: /remove emergency fund/i }));

    expect(screen.getByText(/the account and every rupee in it stay/i)).toBeInTheDocument();
  });

  it('renders amounts in the account\'s own currency, not the app default', () => {
    renderContent({ goals: [makeGoal({ currency: 'EUR' })] });

    expect(screen.getByText(/€2,000\.00 of €5,000\.00/)).toBeInTheDocument();
  });
});
