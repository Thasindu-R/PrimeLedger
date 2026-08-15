import { useState } from 'react';
import { X } from 'lucide-react';
import { ACCOUNT_TYPE_LABELS, type Account, type AccountType } from '../types';
import type { AccountInput } from '../api/accounts';

interface AccountFormProps {
  isOpen: boolean;
  /** Present when editing; absent when creating. */
  account?: Account;
  /** What a new account defaults to, so the common case is one field. */
  defaultCurrency: string;
  onClose: () => void;
  onSubmit: (input: AccountInput) => void;
}

const TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export function AccountForm({
  isOpen,
  account,
  defaultCurrency,
  onClose,
  onSubmit,
}: AccountFormProps) {
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'CHECKING');
  const [currency, setCurrency] = useState(account?.currency ?? defaultCurrency);
  const [openingBalance, setOpeningBalance] = useState(
    account ? String(account.openingBalance) : '0',
  );
  const [colour, setColour] = useState(account?.colour ?? '#4F46E5');
  const [error, setError] = useState<string | undefined>();

  if (!isOpen) return null;

  /**
   * An account's currency is immutable once it holds transactions.
   *
   * <p>The server refuses the change with a 422 — reinterpreting every amount in
   * an account is not something a dropdown should be able to do silently — and
   * the field is disabled here so the user finds out before typing rather than
   * after submitting.
   */
  const currencyLocked = account !== undefined && account.transactionCount > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setError('Give the account a name.');
      return;
    }
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
      setError('Currency must be a three-letter code, like USD or LKR.');
      return;
    }

    const balance = Number(openingBalance);
    if (!Number.isFinite(balance)) {
      setError('Opening balance must be a number.');
      return;
    }

    setError(undefined);
    onSubmit({
      name: name.trim(),
      type,
      currency: currency.trim().toUpperCase(),
      openingBalance: balance,
      colour,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            {account ? 'Edit account' : 'New account'}
          </h2>
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
          <Field label="Name" htmlFor="account-name">
            <input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              placeholder="Everyday"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </Field>

          <Field label="Type" htmlFor="account-type">
            <select
              id="account-type"
              value={type}
              onChange={(event) => setType(event.target.value as AccountType)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            >
              {TYPES.map((option) => (
                <option key={option} value={option}>
                  {ACCOUNT_TYPE_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency" htmlFor="account-currency">
              <input
                id="account-currency"
                value={currency}
                disabled={currencyLocked}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                maxLength={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase outline-none focus:border-green-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
              {currencyLocked && (
                <p className="mt-1 text-xs text-gray-400">
                  Fixed — this account already holds {account.transactionCount}{' '}
                  transaction{account.transactionCount === 1 ? '' : 's'}.
                </p>
              )}
            </Field>

            <Field label="Opening balance" htmlFor="account-opening">
              <input
                id="account-opening"
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(event) => setOpeningBalance(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </Field>
          </div>

          <Field label="Colour" htmlFor="account-colour">
            <input
              id="account-colour"
              type="color"
              value={colour}
              onChange={(event) => setColour(event.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-gray-200"
            />
          </Field>

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
              {account ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}
