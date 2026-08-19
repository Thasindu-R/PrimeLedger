import { useState } from 'react';
import { X } from 'lucide-react';
import type { Account, Goal } from '../types';
import type { GoalInput } from '../api/goals';

interface GoalFormProps {
  isOpen: boolean;
  /** Present when editing; absent when creating. */
  goal?: Goal;
  accounts: Account[];
  onClose: () => void;
  onSubmit: (input: GoalInput) => void;
}

export function GoalForm({ isOpen, goal, accounts, onClose, onSubmit }: GoalFormProps) {
  const [name, setName] = useState(goal?.name ?? '');
  const [accountId, setAccountId] = useState(goal?.accountId ?? accounts[0]?.id ?? '');
  const [targetAmount, setTargetAmount] = useState(goal ? String(goal.targetAmount) : '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [error, setError] = useState<string | undefined>();

  const selectedAccount = accounts.find((account) => account.id === accountId);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      setError('Give the goal a name — "Emergency fund".');
      return;
    }
    if (!accountId) {
      setError('Choose the account you are saving into.');
      return;
    }

    const value = Number(targetAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a target greater than zero.');
      return;
    }

    setError(undefined);
    onSubmit({
      name: name.trim(),
      accountId,
      targetAmount: value,
      targetDate: targetDate || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            {goal ? 'Edit goal' : 'New savings goal'}
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
            <label htmlFor="goal-name" className="mb-1 block text-sm text-gray-600">
              Name
            </label>
            <input
              id="goal-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Emergency fund"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label htmlFor="goal-account" className="mb-1 block text-sm text-gray-600">
              Account
            </label>
            <select
              id="goal-account"
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
            {/* The goal holds no money of its own — this is the sentence that
                stops someone expecting a separate pot. */}
            <p className="mt-1 text-xs text-gray-400">
              This account's balance is the progress. Move money into it as a
              transfer and the goal follows.
            </p>
          </div>

          <div>
            <label htmlFor="goal-target" className="mb-1 block text-sm text-gray-600">
              Target{selectedAccount ? ` (${selectedAccount.currency})` : ''}
            </label>
            <input
              id="goal-target"
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={(event) => setTargetAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label htmlFor="goal-date" className="mb-1 block text-sm text-gray-600">
              By <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              With a date, we tell you whether you will make it. Without one, we
              tell you when you will get there.
            </p>
          </div>

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
              {goal ? 'Save' : 'Create goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
