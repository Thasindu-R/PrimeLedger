import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionForm } from './TransactionForm';
import { makeTransaction, daysFromToday } from '../test/factories';
import type { CategoryOption } from '../api/categories';

/**
 * Stands in for `GET /categories`. Since Phase 4 the options are rows, not a
 * compile-time union, so the fixture is what the server would have sent.
 */
const CATEGORIES: CategoryOption[] = [
  { id: 'cat-salary', name: 'Salary', kind: 'income', system: true, sortOrder: 0 },
  { id: 'cat-freelance', name: 'Freelance', kind: 'income', system: true, sortOrder: 1 },
  { id: 'cat-food', name: 'Food', kind: 'expense', system: true, sortOrder: 2 },
  { id: 'cat-transport', name: 'Transport', kind: 'expense', system: true, sortOrder: 3 },
  // A user-defined category: the case the old hard-coded union could not express.
  { id: 'cat-cat-food', name: 'Cat food', kind: 'expense', system: false, sortOrder: 0 },
];

function renderForm(props: Partial<React.ComponentProps<typeof TransactionForm>> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <TransactionForm
      isOpen
      onClose={onClose}
      onSubmit={onSubmit}
      categories={CATEGORIES}
      {...props}
    />,
  );
  return { onSubmit, onClose };
}

function optionNames(): string[] {
  const select = screen.getByLabelText(/category/i);
  return Array.from(select.querySelectorAll('option')).map((o) => o.textContent ?? '');
}

describe('TransactionForm categories (D-01, FR-17)', () => {
  it('offers the income categories the server sent, and no expense ones', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /income/i }));

    expect(optionNames()).toEqual(['Salary', 'Freelance']);
  });

  it('offers the expense categories, including one the user defined', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /expense/i }));

    // In the order the server sent them — `listCategories` sorts, the form only
    // filters. 'Cat food' has no literal type to belong to, so before Phase 4 it
    // could not have been offered at all: the half of D-01 that FR-17 closes.
    expect(optionNames()).toEqual(['Food', 'Transport', 'Cat food']);
  });

  it('submits the category id, which is what the API addresses', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole('button', { name: /expense/i }));
    await user.type(screen.getByLabelText(/description/i), 'Kibble');
    await user.type(screen.getByLabelText(/amount/i), '12');
    await user.selectOptions(screen.getByLabelText(/category/i), 'cat-food');
    await user.click(screen.getByRole('button', { name: /add transaction/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-food', type: 'expense' }),
    );
  });

  it('moves off a category of the wrong kind when the type is switched', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByRole('button', { name: /expense/i }));
    await user.selectOptions(screen.getByLabelText(/category/i), 'cat-food');
    // Switching to income must not leave an expense category selected — the
    // server rejects that pairing with a 422.
    await user.click(screen.getByRole('button', { name: /income/i }));

    await user.type(screen.getByLabelText(/description/i), 'Payday');
    await user.type(screen.getByLabelText(/amount/i), '900');
    await user.click(screen.getByRole('button', { name: /add transaction/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'income', categoryId: 'cat-salary' }),
    );
  });

  it('cannot be submitted while the account or categories are unavailable', () => {
    renderForm({ canSubmit: false });

    expect(screen.getByRole('button', { name: /add transaction/i })).toBeDisabled();
  });
});

describe('TransactionForm date validation (D-09)', () => {
  it('rejects a date far in the future instead of accepting it', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/description/i), 'Time travel');
    await user.type(screen.getByLabelText(/amount/i), '500');
    await user.clear(screen.getByLabelText(/^date$/i));
    await user.type(screen.getByLabelText(/^date$/i), '3000-01-01');
    await user.click(screen.getByRole('button', { name: /add transaction/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/date cannot be more than one day in the future/i)).toBeInTheDocument();
  });

  it('caps the date input so the picker cannot offer far-future dates', () => {
    renderForm();
    expect(screen.getByLabelText(/^date$/i)).toHaveAttribute('max', daysFromToday(1));
  });

  it('accepts tomorrow, which the server rule also allows', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/description/i), 'Post-dated cheque');
    await user.type(screen.getByLabelText(/amount/i), '500');
    await user.clear(screen.getByLabelText(/^date$/i));
    await user.type(screen.getByLabelText(/^date$/i), daysFromToday(1));
    await user.click(screen.getByRole('button', { name: /add transaction/i }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

describe('TransactionForm edit mode (D-07)', () => {
  it('prefills from the transaction being edited and submits the changes', async () => {
    const user = userEvent.setup();
    const existing = makeTransaction({
      description: 'Weekly shop',
      amount: 4200,
      type: 'expense',
      category: 'Food',
      categoryId: 'cat-food',
      date: '2026-07-15',
    });
    const { onSubmit } = renderForm({ transaction: existing });

    expect(screen.getByLabelText(/description/i)).toHaveValue('Weekly shop');
    expect(screen.getByLabelText(/amount/i)).toHaveValue(4200);
    expect(screen.getByLabelText(/^date$/i)).toHaveValue('2026-07-15');

    await user.clear(screen.getByLabelText(/amount/i));
    await user.type(screen.getByLabelText(/amount/i), '4500');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4500, description: 'Weekly shop' }),
    );
  });
});
