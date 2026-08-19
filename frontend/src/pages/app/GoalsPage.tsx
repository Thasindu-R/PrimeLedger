import { GoalsContent } from '../../components/GoalsContent';
import { useGoals } from '../../hooks/useGoals';
import { useLedger } from '../ledgerContext';

/** Savings targets, their progress and their projections (F-04). */
export function GoalsPage() {
  const { showToast, accounts } = useLedger();
  const goals = useGoals({ showToast });

  return (
    <GoalsContent
      goals={goals.goals}
      accounts={accounts.active}
      isLoading={goals.isLoading}
      error={goals.error}
      onRetry={goals.refetch}
      isMutating={goals.isMutating}
      onCreate={goals.addGoal}
      onEdit={goals.editGoal}
      onDelete={goals.deleteGoal}
    />
  );
}
