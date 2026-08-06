import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionForm } from './TransactionForm';
import { makeTransaction, daysFromToday } from '../test/factories';

function renderForm(props: Partial<React.ComponentProps<typeof TransactionForm>> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <TransactionForm isOpen onClose={onClose} onSubmit={onSubmit} {...props} />,
  );
  return { onSubmit, onClose };
}

describe('TransactionForm categories (D-01)', () => {
  it('offers every income category the type system allows, including Investment', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /income/i }));

    const select = screen.getByLabelText(/category/i);
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual([
      'Salary',
      'Freelance',
      'Investment',
      'Gift',
      'Other',
    ]);
  });

  it('offers every expense category the type system allows, including Shopping', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /expense/i }));

    const select = screen.getByLabelText(/category/i);
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual([
      'Food',
      'Transport',
      'Shopping',
      'Utilities',
      'Entertainment',
      'Health',
      'Education',
      'Other',
    ]);
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
