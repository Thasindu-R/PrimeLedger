import { RecurringContent } from '../../components/RecurringContent';
import { useRecurring } from '../../hooks/useRecurring';
import { useLedger } from '../ledgerContext';

/**
 * Standing instructions and the job that carries them out (F-03).
 *
 * <p>Its own hook rather than another field on the ledger context, for the same
 * reason as budgets: exactly one page reads rules, and loading them on every
 * route would fetch them for the five that never show them.
 */
export function RecurringPage() {
  const { showToast, categories, accounts } = useLedger();
  const recurring = useRecurring({ showToast });

  return (
    <RecurringContent
      rules={recurring.rules}
      // Active accounts only: a rule that pays into an archived account cannot
      // be created, and the server rejects it with a 422. Leaving them out of
      // the picker is a better way to learn that than an error afterwards.
      accounts={accounts.active}
      categories={categories}
      isLoading={recurring.isLoading}
      error={recurring.error}
      onRetry={recurring.refetch}
      isMutating={recurring.isMutating}
      isRunning={recurring.isRunning}
      onCreate={recurring.addRule}
      onEdit={recurring.editRule}
      onDelete={recurring.deleteRule}
      onRunDue={recurring.runDueNow}
    />
  );
}
