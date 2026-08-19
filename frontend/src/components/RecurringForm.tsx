import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  FREQUENCY_LABELS,
  type Account,
  type Frequency,
  type RecurringRule,
  type TransactionType,
} from '../types';
import type { RecurringRuleInput } from '../api/recurring';
import type { CategoryOption } from '../api/categories';
import { categoriesOfKind } from '../api/categories';

interface RecurringFormProps {
  isOpen: boolean;
  /** Present when editing; absent when creating. */
  rule?: RecurringRule;
  accounts: Account[];
  categories: CategoryOption[];
  onClose: () => void;
  onSubmit: (input: RecurringRuleInput) => void;
}

const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as Frequency[];

/** Today, as `yyyy-MM-dd` in the user's own timezone rather than UTC. */
function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function RecurringForm({
  isOpen,
  rule,
  accounts,
  categories,
  onClose,
  onSubmit,
}: RecurringFormProps) {
  const [name, setName] = useState(rule?.name ?? '');
  const [type, setType] = useState<TransactionType>(rule?.type ?? 'expense');
  const [accountId, setAccountId] = useState(rule?.accountId ?? accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '');
  const [amount, setAmount] = useState(rule ? String(rule.amount) : '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'MONTHLY');
  const [interval, setInterval] = useState(String(rule?.interval ?? 1));
  const [startsOn, setStartsOn] = useState(rule?.startsOn ?? todayIso());
  const [endsOn, setEndsOn] = useState(rule?.endsOn ?? '');
  const [error, setError] = useState<string | undefined>();

  // An expense filed under an income category is rejected by the server with a
  // 422. Narrowing the picker means the rule is learned by the form's shape
  // rather than by an error message after the fact.
  const availableCategories = useMemo(
    () => categoriesOfKind(categories, type),
    [categories, type],
  );

  const selectedAccount = accounts.find((account) => account.id === accountId);

  if (!isOpen) return null;

  const handleTypeChange = (next: TransactionType) => {
    setType(next);
    // The chosen category almost certainly belongs to the other kind now.
    setCategoryId('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setError('Give the rule a name — "Rent", "Netflix".');
      return;
    }
    if (!accountId) {
      setError('Choose the account it comes out of.');
      return;
    }
    if (!categoryId) {
      setError('Choose a category.');
      return;
    }

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    const every = Number(interval);
    if (!Number.isInteger(every) || every < 1) {
      setError('Repeat every whole number of periods, at least one.');
      return;
    }
    if (endsOn && endsOn < startsOn) {
      setError('The end date cannot be before the start date.');
      return;
    }

    setError(undefined);
    onSubmit({
      name: name.trim(),
      accountId,
      categoryId,
      type,
      amount: value,
      description: description.trim() || undefined,
      frequency,
      interval: every,
      startsOn,
      endsOn: endsOn || undefined,
      paused: rule?.isPaused ?? false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            {rule ? 'Edit rule' : 'New recurring rule'}
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
          <div>
            <label htmlFor="rule-name" className="mb-1 block text-sm text-gray-600">
              Name
            </label>
            <input
              id="rule-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Rent"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['expense', 'income'] as TransactionType[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleTypeChange(option)}
                className={`rounded-lg border py-2 text-sm capitalize transition-colors ${
                  type === option
                    ? 'border-green-500 bg-green-50 font-medium text-green-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="rule-account" className="mb-1 block text-sm text-gray-600">
              Account
            </label>
            <select
              id="rule-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            >
              <option value="">Select…</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
            {/* The rule inherits the account's currency, and the server enforces
                it. Saying so here is cheaper than having the user wonder why the
                amount came out in dollars. */}
            {selectedAccount && (
              <p className="mt-1 text-xs text-gray-400">
                Amounts are in {selectedAccount.currency}, the account's currency.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="rule-category" className="mb-1 block text-sm text-gray-600">
              Category
            </label>
            <select
              id="rule-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            >
              <option value="">Select…</option>
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rule-amount" className="mb-1 block text-sm text-gray-600">
              Amount
            </label>
            <input
              id="rule-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rule-frequency" className="mb-1 block text-sm text-gray-600">
                Repeats
              </label>
              <select
                id="rule-frequency"
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as Frequency)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
              >
                {FREQUENCIES.map((option) => (
                  <option key={option} value={option}>
                    {FREQUENCY_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rule-interval" className="mb-1 block text-sm text-gray-600">
                Every
              </label>
              <input
                id="rule-interval"
                type="number"
                min="1"
                step="1"
                value={interval}
                onChange={(event) => setInterval(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rule-starts" className="mb-1 block text-sm text-gray-600">
                Starts
              </label>
              <input
                id="rule-starts"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label htmlFor="rule-ends" className="mb-1 block text-sm text-gray-600">
                Ends <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="rule-ends"
                type="date"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rule-description" className="mb-1 block text-sm text-gray-600">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="rule-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Defaults to the rule's name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </div>

          {/* Backdating is a feature, not an accident, and the consequence is
              worth stating before it happens rather than after fifteen rows
              appear in the ledger. */}
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            A start date in the past is fine — every occurrence since is created
            the next time the rules run. Each one is an ordinary transaction you
            can edit or delete on its own.
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
              {rule ? 'Save' : 'Create rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
