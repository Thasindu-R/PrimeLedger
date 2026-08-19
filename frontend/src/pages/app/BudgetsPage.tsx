import { useMemo } from 'react';
import { BudgetsContent } from '../../components/BudgetsContent';
import { useBudgets } from '../../hooks/useBudgets';
import { categoriesOfKind } from '../../api/categories';
import { useLedger } from '../ledgerContext';

/**
 * Spending limits and where they stand (F-02).
 *
 * <p>Its own hook rather than another field on the ledger context: budgets are
 * read by exactly this page, and loading them on every route would fetch them
 * for the three pages that never show them.
 */
export function BudgetsPage() {
  const { showToast, categories, baseCurrency } = useLedger();
  const budgets = useBudgets({ showToast });

  // Income cannot be budgeted, and the server enforces that with a 422. Offering
  // "Salary" in the picker only to have it rejected would be a worse way to
  // learn the rule than not offering it.
  const expenseCategories = useMemo(
    () => categoriesOfKind(categories, 'expense'),
    [categories],
  );

  return (
    <BudgetsContent
      budgets={budgets.budgets}
      categories={expenseCategories}
      baseCurrency={baseCurrency}
      isLoading={budgets.isLoading}
      error={budgets.error}
      onRetry={budgets.refetch}
      isMutating={budgets.isMutating}
      onCreate={budgets.addBudget}
      onEdit={budgets.editBudget}
      onDelete={budgets.deleteBudget}
    />
  );
}
