import { useState } from 'react';
import { Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { GoalForm } from './GoalForm';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './ui/EmptyState';
import { ErrorState } from './ui/ErrorState';
import { SkeletonList } from './ui/Skeleton';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import type { Account, Goal } from '../types';
import type { GoalInput } from '../api/goals';

interface GoalsContentProps {
  goals: Goal[];
  accounts: Account[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  isMutating: boolean;
  onCreate: (input: GoalInput) => void;
  onEdit: (id: string, input: GoalInput) => void;
  onDelete: (id: string) => void;
}

export function GoalsContent({
  goals,
  accounts,
  isLoading,
  error,
  onRetry,
  isMutating,
  onCreate,
  onEdit,
  onDelete,
}: GoalsContentProps) {
  const [editing, setEditing] = useState<Goal | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Goal | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setFormSession((n) => n + 1);
    setIsFormOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setFormSession((n) => n + 1);
    setIsFormOpen(true);
  };

  if (error) {
    return <ErrorState error={error} subject="your goals" onRetry={onRetry} />;
  }

  const achieved = goals.filter((goal) => goal.isAchieved).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Goals</h1>
          <p className="text-sm text-gray-500">
            {goals.length === 0
              ? 'Nothing being saved for yet'
              : achieved > 0
                ? `${achieved} of ${goals.length} reached`
                : `${goals.length} goal${goals.length === 1 ? '' : 's'} in progress`}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={accounts.length === 0}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
        >
          <Plus size={15} />
          New goal
        </button>
      </div>

      {isLoading ? (
        <SkeletonList rows={2} />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No savings goals"
          hint="Name a target and a date, and we will tell you what it takes each month — and whether what you are actually putting aside will get you there."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              isBusy={isMutating}
              onEdit={() => openEdit(goal)}
              onDelete={() => setPendingDelete(goal)}
            />
          ))}
        </ul>
      )}

      <GoalForm
        key={formSession}
        isOpen={isFormOpen}
        goal={editing}
        accounts={accounts}
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
        title={`Remove "${pendingDelete?.name ?? ''}"?`}
        message="The target goes; the account and every rupee in it stay exactly as they are."
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

function GoalCard({
  goal,
  isBusy,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  isBusy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const currency = goal.currency;
  const barWidth = Math.max(0, Math.min(100, goal.progressPercent));

  const bar = goal.isAchieved
    ? 'bg-green-500'
    : goal.isOnTrack === false
      ? 'bg-amber-500'
      : 'bg-green-500';

  return (
    <li className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-8 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: goal.accountColour || '#D1D5DB' }}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800">{goal.name}</p>
          <p className="text-xs text-gray-400">
            {goal.accountName ?? 'Account'}
            {goal.targetDate ? ` · by ${formatDate(goal.targetDate)}` : ' · no deadline'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Edit ${goal.name}`}
            title={`Edit ${goal.name}`}
            onClick={onEdit}
            disabled={isBusy}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 disabled:opacity-40"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            aria-label={`Remove ${goal.name}`}
            title={`Remove ${goal.name}`}
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
          aria-label={`${goal.name} progress`}
          aria-valuenow={Math.round(goal.progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
        >
          <div
            className={`h-full rounded-full transition-all ${bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
          <span className="text-gray-500">
            {formatCurrency(goal.currentAmount, currency)} of{' '}
            {formatCurrency(goal.targetAmount, currency)}
          </span>
          <span className="text-gray-500">{Math.round(goal.progressPercent)}%</span>
        </div>
      </div>

      {/* The projection, which is the reason this is not a progress bar. Three
          different things can be true and each needs its own sentence. */}
      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        {goal.isAchieved ? (
          <span className="font-medium text-green-600">Reached. Nice.</span>
        ) : goal.monthlyRate <= 0 ? (
          <>
            Nothing has gone in since {formatDate(goal.contributionFrom)}, so there is
            no rate to project from.
            {goal.requiredMonthly !== undefined && (
              <> Hitting the date needs {formatCurrency(goal.requiredMonthly, currency)} a month.</>
            )}
          </>
        ) : (
          <>
            At {formatCurrency(goal.monthlyRate, currency)} a month —your actual rate
            since {formatDate(goal.contributionFrom)}—{' '}
            {goal.projectedCompletion ? (
              <>
                you get there around{' '}
                <span className="font-medium text-gray-700">
                  {formatDate(goal.projectedCompletion)}
                </span>
                .
              </>
            ) : (
              <>this target is further off than a projection can usefully say.</>
            )}
            {goal.requiredMonthly !== undefined && (
              <>
                {' '}
                The date needs {formatCurrency(goal.requiredMonthly, currency)}.
              </>
            )}
          </>
        )}
      </p>

      {goal.isOnTrack === false && !goal.isAchieved && (
        <p className="mt-1 text-xs font-medium text-amber-600">
          Not on track for {goal.targetDate ? formatDate(goal.targetDate) : 'the target date'}.
        </p>
      )}
      {goal.isOnTrack === true && !goal.isAchieved && (
        <p className="mt-1 text-xs font-medium text-green-600">On track.</p>
      )}
    </li>
  );
}
