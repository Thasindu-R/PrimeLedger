import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRecurringRule,
  deleteRecurringRule,
  listRecurringRules,
  runRecurringNow,
  updateRecurringRule,
  type RecurringRuleInput,
} from '../api/recurring';
import { queryKeys } from '../lib/queryClient';
import { ApiError } from '../api/client';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info') => void;

/**
 * Recurring rules, and the button that runs them (F-03).
 *
 * <p>Every write here invalidates the transaction and analytics queries as well
 * as the rules themselves. Not defensiveness: materialising a rule creates real
 * ledger rows, and deleting one severs rows that are already there. A list that
 * kept showing the ledger as it was thirty seconds ago would be showing
 * something that is no longer true.
 */
export function useRecurring({ showToast }: { showToast: ShowToast }) {
  const queryClient = useQueryClient();

  const rules = useQuery({
    queryKey: queryKeys.recurring,
    queryFn: listRecurringRules,
  });

  const invalidateRules = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurring });
  }, [queryClient]);

  /** Everything a materialised occurrence touches. */
  const invalidateLedger = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurring });
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
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
    mutationFn: (input: RecurringRuleInput) => createRecurringRule(input),
    onSuccess: (rule) => showToast(`"${rule.name}" will repeat from now on.`, 'success'),
    onError: (error) => reportFailure('create that rule', error),
    onSettled: invalidateRules,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecurringRuleInput }) =>
      updateRecurringRule(id, input),
    onSuccess: (rule) =>
      showToast(
        rule.isPaused ? `"${rule.name}" is paused.` : `"${rule.name}" updated.`,
        'success',
      ),
    onError: (error) => reportFailure('change that rule', error),
    onSettled: invalidateRules,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRecurringRule(id),
    // Worth saying out loud: the obvious fear when deleting a rule is that a
    // year of rent goes with it.
    onSuccess: () => showToast('Rule removed. The transactions it created are kept.', 'info'),
    onError: (error) => reportFailure('remove that rule', error),
    onSettled: invalidateLedger,
  });

  const runNow = useMutation({
    mutationFn: runRecurringNow,
    onSuccess: (created) =>
      showToast(
        created === 0
          ? 'Nothing was due — everything is already up to date.'
          : `${created} transaction${created === 1 ? '' : 's'} created.`,
        created === 0 ? 'info' : 'success',
      ),
    onError: (error) => reportFailure('run the due rules', error),
    onSettled: invalidateLedger,
  });

  return {
    rules: rules.data ?? [],

    isLoading: rules.isPending,
    isFetching: rules.isFetching,
    error: rules.error,
    refetch: () => void rules.refetch(),
    isMutating: create.isPending || update.isPending || remove.isPending,
    isRunning: runNow.isPending,

    addRule: (input: RecurringRuleInput) => create.mutate(input),
    editRule: (id: string, input: RecurringRuleInput) => update.mutate({ id, input }),
    deleteRule: (id: string) => remove.mutate(id),
    runDueNow: () => runNow.mutate(),
  };
}
