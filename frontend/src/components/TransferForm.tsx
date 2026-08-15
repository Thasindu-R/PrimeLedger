import { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { maxTransactionDate, today } from '../utils/dates';
import type { Account } from '../types';
import type { TransferInput } from '../api/transfers';

interface TransferFormProps {
  isOpen: boolean;
  /** Active accounts only — an archived one will not accept a transaction. */
  accounts: Account[];
  onClose: () => void;
  onSubmit: (input: TransferInput) => void;
}

/**
 * Moving money between the user's own accounts (F-01).
 *
 * <p>Its own form rather than an option on the transaction form, because a
 * transfer is not a transaction with a different category — it is two rows, has
 * no category at all, and is deliberately excluded from income and expense. A
 * shared form would have to hide the category picker, hide the type toggle, and
 * change what "amount" means.
 */
export function TransferForm({ isOpen, accounts, onClose, onSubmit }: TransferFormProps) {
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | undefined>();

  if (!isOpen) return null;

  const from = accounts.find((account) => account.id === fromAccountId);
  const to = accounts.find((account) => account.id === toAccountId);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!from || !to) {
      setError('Choose both accounts.');
      return;
    }
    // Checked here as well as on the server, because both are mistakes the user
    // can see the moment they make them and neither is worth a round trip.
    if (from.id === to.id) {
      setError('Pick two different accounts — money cannot move to where it already is.');
      return;
    }
    if (from.currency !== to.currency) {
      setError(
        `${from.name} is in ${from.currency} and ${to.name} is in ${to.currency}. Converting between currencies is not supported yet.`,
      );
      return;
    }

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    setError(undefined);
    onSubmit({
      fromAccountId: from.id,
      toAccountId: to.id,
      amount: value,
      date,
      description: description.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">Transfer between accounts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="transfer-from" className="mb-1 block text-sm text-gray-600">
                From
              </label>
              <select
                id="transfer-from"
                value={fromAccountId}
                onChange={(event) => setFromAccountId(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
              >
                <option value="">Select…</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight size={16} className="mb-3 shrink-0 text-gray-400" />

            <div className="flex-1">
              <label htmlFor="transfer-to" className="mb-1 block text-sm text-gray-600">
                To
              </label>
              <select
                id="transfer-to"
                value={toAccountId}
                onChange={(event) => setToAccountId(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
              >
                <option value="">Select…</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="transfer-amount" className="mb-1 block text-sm text-gray-600">
              Amount {from ? `(${from.currency})` : ''}
            </label>
            <input
              id="transfer-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label htmlFor="transfer-date" className="mb-1 block text-sm text-gray-600">
              Date
            </label>
            <input
              id="transfer-date"
              type="date"
              value={date}
              max={maxTransactionDate()}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label htmlFor="transfer-note" className="mb-1 block text-sm text-gray-600">
              Note <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="transfer-note"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              placeholder="Moving to savings"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </div>

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            A transfer is recorded on both accounts and left out of your income and
            expense totals — moving your own money is neither earning nor spending.
          </p>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
