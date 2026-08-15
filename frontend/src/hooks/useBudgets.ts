import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
  type BudgetInput,
} from '../api/budgets';
import { queryKeys } from '../lib/queryClient';
import { ApiError } from '../api/client';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info') => void;

/**
 * Budgets and where they currently stand (F-02).
 *
 * <p>Spend comes from the server with the budget, rather than being computed
 * here from the category breakdown. Two reasons, and both are correctness rather
 * than convenience: the breakdown covers whatever the dashboard is scoped to
 * while a budget covers its own period, and the server excludes transfers from
 * spend — telling someone they blew their grocery budget by moving money into
 * savings would be worse than having no budgets at all.
 */
export function useBudgets({ showToast }: { showToast: ShowToast }) {
  const queryClient = useQueryClient();

  const budgets = useQuery({
    queryKey: queryKeys.budgets,
    queryFn: listBudgets,
  });

  /**
   * Budgets, and the bell.
   *
   * <p>Creating a budget against spending that has already happened puts it over
   * the limit immediately, and the server emits the alert as part of the same
   * request. Leaving the notification query alone would hide that alert until
   * something else happened to refetch it.
   */
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }, [queryClient]);

  const reportFailure = useCallback(
    (action: string, error: unknown) => {
      const detail =
        error instanceof ApiError ? error.message : 'The server could not be reached.';
      showToast(`Could not ${action}. ${detail}`, 'error');
    },
    [showToast],
  );

  const create = useMutation({
    mutationFn: (input: BudgetInput) => createBudget(input),
    onSuccess: (budget) => showToast(`Budget set for ${budget.category}.`, 'success'),
    onError: (error) => reportFailure('set that budget', error),
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: BudgetInput }) =>
      updateBudget(id, input),
    onSuccess: (budget) => showToast(`${budget.category} budget updated.`, 'success'),
    onError: (error) => reportFailure('change that budget', error),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => showToast('Budget removed.', 'info'),
    onError: (error) => reportFailure('remove that budget', error),
    onSettled: invalidate,
  });

  return {
    budgets: budgets.data ?? [],

    isLoading: budgets.isPending,
    isFetching: budgets.isFetching,
    error: budgets.error,
    refetch: () => void budgets.refetch(),
    isMutating: create.isPending || update.isPending || remove.isPending,

    addBudget: (input: BudgetInput) => create.mutate(input),
    editBudget: (id: string, input: BudgetInput) => update.mutate({ id, input }),
    deleteBudget: (id: string) => remove.mutate(id),
  };
}
