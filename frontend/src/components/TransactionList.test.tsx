import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionList } from './TransactionList';
import { makeTransaction } from '../test/factories';

function renderList(
  props: Partial<React.ComponentProps<typeof TransactionList>> = {},
) {
  const onSortChange = vi.fn();
  const onDelete = vi.fn();
  const onEdit = vi.fn();
  const onSearchChange = vi.fn();
  const onTypeFilter = vi.fn();
  render(
    <TransactionList
      transactions={[makeTransaction()]}
      onDelete={onDelete}
      onEdit={onEdit}
      onSearchChange={onSearchChange}
      onTypeFilter={onTypeFilter}
      onSortChange={onSortChange}
      sort={{ field: 'date', order: 'desc' }}
      {...props}
    />,
  );
  return { onSortChange, onDelete, onEdit };
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /filter/i }));
}

describe('TransactionList sort control (D-04)', () => {
  it('emits a sort config the hook can apply, not a dead string', async () => {
    const user = userEvent.setup();
    const { onSortChange } = renderList();
    await openFilters(user);

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'amount-high');

    expect(onSortChange).toHaveBeenCalledWith({ field: 'amount', order: 'desc' });
  });

  it('maps every option to a field and order', async () => {
    const user = userEvent.setup();
    const { onSortChange } = renderList();
    await openFilters(user);
    const select = screen.getByLabelText(/sort by/i);

    const expected = [
      ['date-newest', { field: 'date', order: 'desc' }],
      ['date-oldest', { field: 'date', order: 'asc' }],
      ['amount-high', { field: 'amount', order: 'desc' }],
      ['amount-low', { field: 'amount', order: 'asc' }],
      ['category', { field: 'category', order: 'asc' }],
    ] as const;

    for (const [value, config] of expected) {
      await user.selectOptions(select, value);
      expect(onSortChange).toHaveBeenLastCalledWith(config);
    }
  });

  it('reflects the sort the parent is actually applying', async () => {
    const user = userEvent.setup();
    renderList({ sort: { field: 'amount', order: 'asc' } });
    await openFilters(user);

    expect(screen.getByLabelText(/sort by/i)).toHaveValue('amount-low');
  });
});

describe('TransactionList rows', () => {
  it('offers an edit affordance per row (D-07)', async () => {
    const user = userEvent.setup();
    const transaction = makeTransaction({ description: 'Bus fare' });
    const { onEdit } = renderList({ transactions: [transaction] });

    await user.click(screen.getByRole('button', { name: /edit bus fare/i }));

    expect(onEdit).toHaveBeenCalledWith(transaction);
  });

  it('shows an empty state when there is nothing to list', () => {
    renderList({ transactions: [] });
    expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
  });
});
