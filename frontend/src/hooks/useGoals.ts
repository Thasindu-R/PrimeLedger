import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
  type GoalInput,
} from '../api/goals';
import { queryKeys } from '../lib/queryClient';
import { ApiError } from '../api/client';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info') => void;

/**
 * Savings goals and their projections (F-04).
 *
 * <p>Read-mostly, and refetched more eagerly than the other resources: a goal's
 * progress is its account's balance, so every transaction anywhere in the app
 * can change what this page should be showing. The staleness that is fine for a
 * category list would show someone a target they have already met.
 */
export function useGoals({ showToast }: { showToast: ShowToast }) {
  const queryClient = useQueryClient();

  const goals = useQuery({
    queryKey: queryKeys.goals,
    queryFn: listGoals,
    // Shorter than the app default. See above: progress is derived from the
    // ledger, and the ledger changes from four other pages.
    staleTime: 5_000,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.goals });
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
    mutationFn: (input: GoalInput) => createGoal(input),
    onSuccess: (goal) => showToast(`Saving towards "${goal.name}".`, 'success'),
    onError: (error) => reportFailure('create that goal', error),
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: GoalInput }) => updateGoal(id, input),
    onSuccess: (goal) => showToast(`"${goal.name}" updated.`, 'success'),
    onError: (error) => reportFailure('change that goal', error),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => showToast('Goal removed. Your account is untouched.', 'info'),
    onError: (error) => reportFailure('remove that goal', error),
    onSettled: invalidate,
  });

  return {
    goals: goals.data ?? [],

    isLoading: goals.isPending,
    isFetching: goals.isFetching,
    error: goals.error,
    refetch: () => void goals.refetch(),
    isMutating: create.isPending || update.isPending || remove.isPending,

    addGoal: (input: GoalInput) => create.mutate(input),
    editGoal: (id: string, input: GoalInput) => update.mutate({ id, input }),
    deleteGoal: (id: string) => remove.mutate(id),
  };
}
