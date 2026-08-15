import { useState } from 'react';
import { Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { BudgetForm } from './BudgetForm';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './ui/EmptyState';
import { ErrorState } from './ui/ErrorState';
import { SkeletonList } from './ui/Skeleton';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import { BUDGET_PERIOD_LABELS, type Budget, type BudgetStatus } from '../types';
import type { BudgetInput } from '../api/budgets';
import type { CategoryOption } from '../api/categories';

interface BudgetsContentProps {
  budgets: Budget[];
  /** Expense categories, for the form. */
  categories: CategoryOption[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  isMutating: boolean;
  onCreate: (input: BudgetInput) => void;
  onEdit: (id: string, input: BudgetInput) => void;
  onDelete: (id: string) => void;
}

/** How each state reads and looks. Amber at 80%, red at 100% — the server decides which. */
const STATUS_STYLES: Record<BudgetStatus, { bar: string; text: string; label: string }> = {
  OK: { bar: 'bg-green-500', text: 'text-green-600', label: 'On track' },
  WARNING: { bar: 'bg-amber-500', text: 'text-amber-600', label: 'Nearly over' },
  EXCEEDED: { bar: 'bg-red-500', text: 'text-red-600', label: 'Over budget' },
};

export function BudgetsContent({
  budgets,
  categories,
  isLoading,
  error,
  onRetry,
  isMutating,
  onCreate,
  onEdit,
  onDelete,
}: BudgetsContentProps) {
  const [editing, setEditing] = useState<Budget | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Budget | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setFormSession((n) => n + 1);
    setIsFormOpen(true);
  };

  const openEdit = (budget: Budget) => {
    setEditing(budget);
    setFormSession((n) => n + 1);
    setIsFormOpen(true);
  };

  if (error) {
    return <ErrorState error={error} subject="your budgets" onRetry={onRetry} />;
  }

  const overCount = budgets.filter((budget) => budget.status === 'EXCEEDED').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Budgets</h1>
          <p className="text-sm text-gray-500">
            {budgets.length === 0
              ? 'No limits set'
              : overCount > 0
                ? `${overCount} of ${budgets.length} over budget`
                : `${budgets.length} budget${budgets.length === 1 ? '' : 's'} on track`}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={categories.length === 0}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
        >
          <Plus size={15} />
          New budget
        </button>
      </div>

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No budgets yet"
          hint="Set a limit on a category and we will tell you at 80% and again if you go over — before the month ends, not after."
        />
      ) : (
        <ul className="space-y-2">
          {budgets.map((budget) => (
            <BudgetRow
              key={budget.id}
              budget={budget}
              isBusy={isMutating}
              onEdit={() => openEdit(budget)}
              onDelete={() => setPendingDelete(budget)}
            />
          ))}
        </ul>
      )}

      <BudgetForm
        key={formSession}
        isOpen={isFormOpen}
        budget={editing}
        categories={categories}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(undefined);
        }}
        onSubmit={(input) => {
          if (editing) onEdit(editing.id, input);
          else onCreate(input);
        }}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== undefined}
        title={`Remove the ${pendingDelete?.category ?? ''} budget?`}
        message="Your transactions are untouched — only the limit and its alerts go away."
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(undefined);
        }}
        onCancel={() => setPendingDelete(undefined)}
      />
    </div>
  );
}

function BudgetRow({
  budget,
  isBusy,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  isBusy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const style = STATUS_STYLES[budget.status];
  // The bar stops at full; the number does not. A bar cannot show 340% without
  // becoming a different shape, but "340%" is the fact the user needs to see.
  const barWidth = Math.min(100, budget.percentUsed);

  return (
    <li className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="h-8 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: budget.categoryColour || '#D1D5DB' }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-800">
              {budget.category}
            </span>
            <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
          </div>
          <p className="text-xs text-gray-400">
            {BUDGET_PERIOD_LABELS[budget.period]} · {formatDate(budget.periodStart)} –{' '}
            {formatDate(budget.periodEnd)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Edit the ${budget.category} budget`}
            title={`Edit the ${budget.category} budget`}
            onClick={onEdit}
            disabled={isBusy}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 disabled:opacity-40"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            aria-label={`Remove the ${budget.category} budget`}
            title={`Remove the ${budget.category} budget`}
            onClick={onDelete}
            disabled={isBusy}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <div
          role="progressbar"
          aria-label={`${budget.category} budget`}
          aria-valuenow={Math.round(budget.percentUsed)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
        >
          <div
            className={`h-full rounded-full transition-all ${style.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
          <span className="text-gray-500">
            {formatCurrency(budget.spent)} of {formatCurrency(budget.limit)}
          </span>
          <span className={style.text}>
            {Math.round(budget.percentUsed)}% ·{' '}
            {budget.remaining >= 0
              ? `${formatCurrency(budget.remaining)} left`
              : `${formatCurrency(Math.abs(budget.remaining))} over`}
          </span>
        </div>
      </div>
    </li>
  );
}
