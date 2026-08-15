import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsMenu } from './NotificationsMenu';
import type { Notification } from '../types';

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    kind: 'BUDGET_THRESHOLD',
    title: 'Groceries is nearly over budget',
    body: 'You have spent 812.40 of your 1000.00 limit for August 2026.',
    budgetId: 'budget-1',
    periodStart: '2026-08-01',
    threshold: 80,
    isRead: false,
    createdAt: '2026-08-15T09:00:00Z',
    ...overrides,
  };
}

function renderMenu(notifications: Notification[], isLoading = false) {
  const onMarkRead = vi.fn();
  const onMarkAllRead = vi.fn();
  render(
    <NotificationsMenu
      notifications={notifications}
      isLoading={isLoading}
      onMarkRead={onMarkRead}
      onMarkAllRead={onMarkAllRead}
    />,
  );
  return { onMarkRead, onMarkAllRead };
}

describe('NotificationsMenu', () => {
  it('points at what to do when there is nothing to report', () => {
    renderMenu([]);
    expect(screen.getByText(/nothing needs your attention/i)).toBeInTheDocument();
    expect(screen.getByText(/set a budget/i)).toBeInTheDocument();
  });

  it('shows the alert the server wrote', () => {
    renderMenu([makeNotification()]);
    expect(screen.getByText(/groceries is nearly over budget/i)).toBeInTheDocument();
    expect(screen.getByText(/812\.40 of your 1000\.00/)).toBeInTheDocument();
  });

  it('marks one read when it is opened', async () => {
    const user = userEvent.setup();
    const { onMarkRead } = renderMenu([makeNotification()]);

    await user.click(screen.getByText(/groceries is nearly over budget/i));
    expect(onMarkRead).toHaveBeenCalledWith('n-1');
  });

  it('does not mark an already-read alert again', async () => {
    const user = userEvent.setup();
    const { onMarkRead } = renderMenu([makeNotification({ isRead: true })]);

    await user.click(screen.getByText(/groceries is nearly over budget/i));
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it('disables "mark all read" when nothing is unread', () => {
    renderMenu([makeNotification({ isRead: true })]);
    expect(screen.getByRole('button', { name: /mark all read/i })).toBeDisabled();
  });

  it('distinguishes an unread alert from a read one', () => {
    renderMenu([
      makeNotification({ id: 'n-1', isRead: false }),
      makeNotification({ id: 'n-2', title: 'Transport is over budget', isRead: true }),
    ]);
    expect(screen.getAllByLabelText('Unread')).toHaveLength(1);
  });
});
