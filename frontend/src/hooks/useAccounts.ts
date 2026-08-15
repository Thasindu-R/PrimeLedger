import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAccount,
  deleteAccount,
  listAccounts,
  setAccountArchived,
  updateAccount,
  type AccountInput,
} from '../api/accounts';
import { createTransfer, type TransferInput } from '../api/transfers';
import { queryKeys } from '../lib/queryClient';
import { ApiError } from '../api/client';
import type { Account } from '../types';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info') => void;

/**
 * The accounts page's data and writes (F-01).
 *
 * <p>Nothing here is optimistic, unlike the transaction list. An account's
 * balance is a figure the server derives from every row filed under it, and
 * guessing at it locally would show a number that is wrong in a way the user
 * cannot detect — the whole point of the balance is that it is authoritative.
 * These operations are also rare and deliberate, so the round trip is not the
 * friction FR-44 exists to remove.
 */
export function useAccounts({ showToast }: { showToast: ShowToast }) {
  const queryClient = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);

  const accounts = useQuery({
    queryKey: [...queryKeys.accounts, { includeArchived }] as const,
    queryFn: () => listAccounts(includeArchived),
  });

  /**
   * Everything a write touches.
   *
   * <p>A transfer moves two balances and writes two transactions, so the list,
   * the totals and the accounts themselves are all stale afterwards. Archiving
   * changes which accounts the pickers offer. Invalidating the lot is cheap
   * next to showing a balance that disagrees with the rows behind it.
   */
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
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
    mutationFn: (input: AccountInput) => createAccount(input),
    onSuccess: (account) => showToast(`${account.name} added.`, 'success'),
    onError: (error) => reportFailure('create that account', error),
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AccountInput }) =>
      updateAccount(id, input),
    onSuccess: (account) => showToast(`${account.name} updated.`, 'success'),
    onError: (error) => reportFailure('save that account', error),
    onSettled: invalidate,
  });

  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      setAccountArchived(id, archived),
    onSuccess: (account) =>
      showToast(
        account.isArchived
          ? `${account.name} archived. Its history is intact.`
          : `${account.name} reopened.`,
        'info',
      ),
    onError: (error, { archived }) =>
      reportFailure(archived ? 'archive that account' : 'reopen that account', error),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => showToast('Account deleted.', 'info'),
    onError: (error) => reportFailure('delete that account', error),
    onSettled: invalidate,
  });

  const transfer = useMutation({
    mutationFn: (input: TransferInput) => createTransfer(input),
    onSuccess: () => showToast('Transfer recorded.', 'success'),
    onError: (error) => reportFailure('record that transfer', error),
    onSettled: invalidate,
  });

  const all = useMemo(() => accounts.data ?? [], [accounts.data]);

  // What the pickers offer. An archived account will not accept a transaction,
  // so offering one would be inviting a 422.
  const active = useMemo(
    (): Account[] => all.filter((account) => !account.isArchived),
    [all],
  );

  return {
    accounts: all,
    activeAccounts: active,
    includeArchived,
    setIncludeArchived,

    isLoading: accounts.isPending,
    isFetching: accounts.isFetching,
    error: accounts.error,
    refetch: () => void accounts.refetch(),
    isMutating:
      create.isPending ||
      update.isPending ||
      archive.isPending ||
      remove.isPending ||
      transfer.isPending,

    addAccount: (input: AccountInput) => create.mutate(input),
    editAccount: (id: string, input: AccountInput) => update.mutate({ id, input }),
    setArchived: (id: string, archived: boolean) => archive.mutate({ id, archived }),
    deleteAccount: (id: string) => remove.mutate(id),
    transferBetween: (input: TransferInput) => transfer.mutate(input),
  };
}
