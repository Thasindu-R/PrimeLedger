import { useState } from 'react';
import { Pause, Pencil, Play, Plus, Repeat, Trash2, Zap } from 'lucide-react';
import { RecurringForm } from './RecurringForm';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './ui/EmptyState';
import { ErrorState } from './ui/ErrorState';
import { SkeletonList } from './ui/Skeleton';
import { formatCurrency, formatDate } from '../utils/formatCurrency';
import { describeSchedule, type Account, type RecurringRule } from '../types';
import type { RecurringRuleInput } from '../api/recurring';
import type { CategoryOption } from '../api/categories';

interface RecurringContentProps {
  rules: RecurringRule[];
  accounts: Account[];
  categories: CategoryOption[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  isMutating: boolean;
  isRunning: boolean;
  onCreate: (input: RecurringRuleInput) => void;
  onEdit: (id: string, input: RecurringRuleInput) => void;
  onDelete: (id: string) => void;
  onRunDue: () => void;
}

/** The rule as an input payload, so a pause is an edit of one field. */
function toInput(rule: RecurringRule, changes: Partial<RecurringRuleInput> = {}): RecurringRuleInput {
  return {
    name: rule.name,
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    type: rule.type,
    amount: rule.amount,
    description: rule.description,
    frequency: rule.frequency,
    interval: rule.interval,
    startsOn: rule.startsOn,
    endsOn: rule.endsOn,
    paused: rule.isPaused,
    ...changes,
  };
}

export function RecurringContent({
  rules,
  accounts,
  categories,
  isLoading,
  error,
  onRetry,
  isMutating,
  isRunning,
  onCreate,
  onEdit,
  onDelete,
  onRunDue,
}: RecurringContentProps) {
  const [editing, setEditing] = useState<RecurringRule | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<RecurringRule | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setFormSession((n) => n + 1);
    setIsFormOpen(true);
  };

  const openEdit = (rule: RecurringRule) => {
    setEditing(rule);
    setFormSession((n) => n + 1);
    setIsFormOpen(true);
  };

  if (error) {
    return <ErrorState error={error} subject="your recurring rules" onRetry={onRetry} />;
  }

  const activeCount = rules.filter((rule) => !rule.isPaused && !rule.isFinished).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Recurring</h1>
          <p className="text-sm text-gray-500">
            {rules.length === 0
              ? 'Nothing repeating yet'
              : `${activeCount} active of ${rules.length}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* The nightly job does this at 01:30. The button exists so the
              scheduled behaviour can be watched working rather than taken on
              trust — and because it is the same idempotent path, pressing it
              twice is harmless. */}
          <button
            type="button"
            onClick={onRunDue}
            disabled={isRunning || rules.length === 0}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            title="Create any transactions that are due now, without waiting for tonight"
          >
            <Zap size={15} />
            {isRunning ? 'Running…' : 'Run due now'}
          </button>

          <button
            type="button"
            onClick={openCreate}
            disabled={accounts.length === 0 || categories.length === 0}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
          >
            <Plus size={15} />
            New rule
          </button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring rules"
          hint="Rent, salary and subscriptions are most of a ledger and the most tedious to type. Set one up and it enters itself, every month, on the right day."
        />
      ) : (
        <ul className="space-y-2">
          {rules.map((rule) => (
            <RecurringRow
              key={rule.id}
              rule={rule}
              isBusy={isMutating}
              onEdit={() => openEdit(rule)}
              onTogglePause={() => onEdit(rule.id, toInput(rule, { paused: !rule.isPaused }))}
              onDelete={() => setPendingDelete(rule)}
            />
          ))}
        </ul>
      )}

      <RecurringForm
        key={formSession}
        isOpen={isFormOpen}
        rule={editing}
        accounts={accounts}
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
        title={`Delete the "${pendingDelete?.name ?? ''}" rule?`}
        message={
          pendingDelete && pendingDelete.generatedCount > 0
            ? `The ${pendingDelete.generatedCount} transaction${
                pendingDelete.generatedCount === 1 ? '' : 's'
              } it has already created stay in your ledger. Only the instruction to keep going is removed.`
            : 'Only the instruction is removed. Nothing already in your ledger is touched.'
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(undefined);
        }}
        onCancel={() => setPendingDelete(undefined)}
      />
    </div>
  );
}

function RecurringRow({
  rule,
  isBusy,
  onEdit,
  onTogglePause,
  onDelete,
}: {
  rule: RecurringRule;
  isBusy: boolean;
  onEdit: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
}) {
  // Three states, not two. "Finished" is not the user's doing and cannot be
  // undone by them, so showing it as paused would invite a click that does
  // nothing.
  const status = rule.isFinished
    ? { label: 'Finished', className: 'text-gray-400' }
    : rule.isPaused
      ? { label: 'Paused', className: 'text-amber-600' }
      : { label: 'Active', className: 'text-green-600' };

  return (
    <li
      className={`rounded-2xl border border-gray-100 bg-white px-4 py-3 ${
        rule.isPaused || rule.isFinished ? 'opacity-70' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="h-8 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: rule.categoryColour || '#D1D5DB' }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-gray-800">{rule.name}</span>
            <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
          </div>
          <p className="text-xs text-gray-400">
            {describeSchedule(rule.frequency, rule.interval)} · {rule.category}
            {rule.accountName ? ` · ${rule.accountName}` : ''}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`text-sm font-semibold ${
              rule.type === 'income' ? 'text-green-600' : 'text-gray-800'
            }`}
          >
            {rule.type === 'income' ? '+' : '−'}
            {formatCurrency(rule.amount, rule.currency)}
          </p>
          <p className="text-xs text-gray-400">
            {rule.nextRunOn ? `Next ${formatDate(rule.nextRunOn)}` : 'No more due'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={rule.isPaused ? `Resume ${rule.name}` : `Pause ${rule.name}`}
            title={rule.isPaused ? `Resume ${rule.name}` : `Pause ${rule.name}`}
            onClick={onTogglePause}
            // A finished rule has nothing left to pause or resume.
            disabled={isBusy || rule.isFinished}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 disabled:opacity-40"
          >
            {rule.isPaused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            type="button"
            aria-label={`Edit ${rule.name}`}
            title={`Edit ${rule.name}`}
            onClick={onEdit}
            disabled={isBusy}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 disabled:opacity-40"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            aria-label={`Delete ${rule.name}`}
            title={`Delete ${rule.name}`}
            onClick={onDelete}
            disabled={isBusy}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {rule.generatedCount > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          {rule.generatedCount} transaction{rule.generatedCount === 1 ? '' : 's'} created
          {rule.lastRunOn ? `, most recently ${formatDate(rule.lastRunOn)}` : ''}
        </p>
      )}
    </li>
  );
}
