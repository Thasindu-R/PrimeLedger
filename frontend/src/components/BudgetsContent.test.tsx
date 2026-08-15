import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetsContent } from './BudgetsContent';
import type { Budget } from '../types';
import type { CategoryOption } from '../api/categories';

const CATEGORIES: CategoryOption[] = [
  { id: 'cat-food', name: 'Food', kind: 'expense', system: true, sortOrder: 0 },
  { id: 'cat-transport', name: 'Transport', kind: 'expense', system: true, sortOrder: 1 },
];

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  const limit = overrides.limit ?? 1000;
  const spent = overrides.spent ?? 0;
  return {
    id: 'budget-1',
    categoryId: 'cat-food',
    category: 'Food',
    period: 'MONTHLY',
    limit,
    startsOn: '2026-08-01',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    spent,
    remaining: limit - spent,
    percentUsed: (spent / limit) * 100,
    status: 'OK',
    ...overrides,
  };
}

function renderContent(props: Partial<React.ComponentProps<typeof BudgetsContent>> = {}) {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onRetry: vi.fn(),
  };

  render(
    <BudgetsContent
      budgets={[]}
      categories={CATEGORIES}
      isLoading={false}
      error={null}
      isMutating={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('BudgetsContent', () => {
  it('offers first-run guidance rather than an empty panel', () => {
    renderContent();
    expect(screen.getByText(/no budgets yet/i)).toBeInTheDocument();
  });

  it('reports the position the server computed, not one it recalculates', () => {
    renderContent({
      budgets: [makeBudget({ limit: 1000, spent: 812.4, percentUsed: 81.24, status: 'WARNING' })],
    });

    // The server owns these figures because it is the only party that can see
    // every row; the component's job is to render them faithfully.
    expect(screen.getByRole('progressbar', { name: /food budget/i })).toHaveAttribute(
      'aria-valuenow',
      '81',
    );
    expect(screen.getByText(/nearly over/i)).toBeInTheDocument();
    expect(screen.getByText(/187\.60 left/)).toBeInTheDocument();
  });

  it('shows how far over the limit is, uncapped', () => {
    renderContent({
      budgets: [makeBudget({ limit: 100, spent: 340, percentUsed: 340, status: 'EXCEEDED' })],
    });

    // 340% cannot be drawn as a bar, but it is the number the user needs.
    expect(screen.getByText(/340%/)).toBeInTheDocument();
    expect(screen.getByText(/240\.00 over/)).toBeInTheDocument();
    // Exact, because the heading above also says "over budget".
    expect(screen.getByText('Over budget')).toBeInTheDocument();
  });

  it('caps the bar at full while the figure runs past it', () => {
    renderContent({
      budgets: [makeBudget({ limit: 100, spent: 340, percentUsed: 340, status: 'EXCEEDED' })],
    });

    const bar = screen.getByRole('progressbar', { name: /food budget/i });
    expect(bar.firstElementChild).toHaveStyle({ width: '100%' });
  });

  it('summarises how many budgets are over', () => {
    renderContent({
      budgets: [
        makeBudget({ id: 'b1', status: 'EXCEEDED' }),
        makeBudget({ id: 'b2', categoryId: 'cat-transport', category: 'Transport' }),
      ],
    });
    expect(screen.getByText(/1 of 2 over budget/i)).toBeInTheDocument();
  });

  it('confirms before removing a budget', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderContent({ budgets: [makeBudget()] });

    await user.click(screen.getByRole('button', { name: /remove the food budget/i }));
    expect(screen.getByText(/only the limit and its alerts go away/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^remove$/i }));
    expect(onDelete).toHaveBeenCalledWith('budget-1');
  });

  it('reports a failure to load instead of showing no budgets', () => {
    renderContent({ error: new Error('boom') });
    // "No budgets yet" would be a lie the user would act on by creating one.
    expect(screen.queryByText(/no budgets yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
