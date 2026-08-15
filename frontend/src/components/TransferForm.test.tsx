import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransferForm } from './TransferForm';
import { makeAccount } from '../test/factories';

const ACCOUNTS = [
  makeAccount({ id: 'a', name: 'Everyday' }),
  makeAccount({ id: 'b', name: 'Savings' }),
  makeAccount({ id: 'c', name: 'Euros', currency: 'EUR' }),
];

function renderForm() {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <TransferForm isOpen accounts={ACCOUNTS} onClose={onClose} onSubmit={onSubmit} />,
  );
  return { onSubmit, onClose };
}

describe('TransferForm', () => {
  it('submits a transfer between two accounts', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.selectOptions(screen.getByLabelText(/^from$/i), 'a');
    await user.selectOptions(screen.getByLabelText(/^to$/i), 'b');
    await user.type(screen.getByLabelText(/amount/i), '250');
    await user.click(screen.getByRole('button', { name: /^transfer$/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ fromAccountId: 'a', toAccountId: 'b', amount: 250 }),
    );
  });

  it('refuses a transfer to the same account', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.selectOptions(screen.getByLabelText(/^from$/i), 'a');
    await user.selectOptions(screen.getByLabelText(/^to$/i), 'a');
    await user.type(screen.getByLabelText(/amount/i), '250');
    await user.click(screen.getByRole('button', { name: /^transfer$/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/two different accounts/i);
  });

  it('refuses to move money between currencies', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.selectOptions(screen.getByLabelText(/^from$/i), 'a');
    await user.selectOptions(screen.getByLabelText(/^to$/i), 'c');
    await user.type(screen.getByLabelText(/amount/i), '250');
    await user.click(screen.getByRole('button', { name: /^transfer$/i }));

    // Conversion is F-05. Writing 250 USD out and 250 EUR in would invent money.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/USD.*EUR|EUR.*USD/);
  });

  it('refuses an amount of zero', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.selectOptions(screen.getByLabelText(/^from$/i), 'a');
    await user.selectOptions(screen.getByLabelText(/^to$/i), 'b');
    await user.type(screen.getByLabelText(/amount/i), '0');
    await user.click(screen.getByRole('button', { name: /^transfer$/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/greater than zero/i);
  });

  it('says that a transfer is not income or expense', () => {
    renderForm();
    expect(screen.getByText(/neither earning nor spending/i)).toBeInTheDocument();
  });
});
