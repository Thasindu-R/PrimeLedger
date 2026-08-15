import { useState } from 'react';
import { X } from 'lucide-react';
import { BUDGET_PERIOD_LABELS, type Budget, type BudgetPeriod } from '../types';
import type { BudgetInput } from '../api/budgets';
import type { CategoryOption } from '../api/categories';

interface BudgetFormProps {
  isOpen: boolean;
  /** Present when editing; absent when creating. */
  budget?: Budget;
  /** Expense categories only — see the note below. */
  categories: CategoryOption[];
  onClose: () => void;
  onSubmit: (input: BudgetInput) => void;
}

const PERIODS = Object.keys(BUDGET_PERIOD_LABELS) as BudgetPeriod[];

export function BudgetForm({
  isOpen,
  budget,
  categories,
  onClose,
  onSubmit,
}: BudgetFormProps) {
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? categories[0]?.id ?? '');
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? 'MONTHLY');
  const [limit, setLimit] = useState(budget ? String(budget.limit) : '');
  const [error, setError] = useState<string | undefined>();

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!categoryId) {
      setError('Choose a category to budget.');
      return;
    }

    const value = Number(limit);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a limit greater than zero.');
      return;
    }

    setError(undefined);
    // startsOn is left to the server, which defaults it to the start of the
    // period containing today. Letting the user pick it would mean explaining
    // that a monthly budget cannot start on the 17th, to solve a problem nobody
    // has on the way to setting their first budget.
    onSubmit({ categoryId, period, limit: value });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">
            {budget ? 'Edit budget' : 'New budget'}
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
            <label htmlFor="budget-category" className="mb-1 block text-sm text-gray-600">
              Category
            </label>
            <select
              id="budget-category"
              value={categoryId}
              // Changing which category a budget belongs to would silently move
              // its history onto a different one; delete and re-create instead.
              disabled={budget !== undefined}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500 disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">Select…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {/* Income cannot be budgeted, and the server says so with a 422. A
                budget is a ceiling on spending; a ceiling on earning is not a
                thing anyone wants. */}
            <p className="mt-1 text-xs text-gray-400">
              Expense categories only — there is no such thing as spending too little.
            </p>
          </div>

          <div>
            <label htmlFor="budget-period" className="mb-1 block text-sm text-gray-600">
              Resets
            </label>
            <select
              id="budget-period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as BudgetPeriod)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            >
              {PERIODS.map((option) => (
                <option key={option} value={option}>
                  {BUDGET_PERIOD_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="budget-limit" className="mb-1 block text-sm text-gray-600">
              Limit
            </label>
            <input
              id="budget-limit"
              type="number"
              step="0.01"
              min="0"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
            />
          </div>

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            You will hear from us once at 80% and once if you go over. Transfers
            between your own accounts are not counted as spending.
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
              {budget ? 'Save' : 'Set budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
