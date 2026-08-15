import { AccountsContent } from '../../components/AccountsContent';
import { useLedger } from '../ledgerContext';

/**
 * Where money is held, and moving it between places (F-01).
 *
 * <p>The accounts themselves come from the shell rather than from a hook called
 * here, because the header's selector is reading the same list — two copies
 * would mean the page and the selector could disagree about what exists.
 */
export function AccountsPage() {
  const { accounts } = useLedger();

  return (
    <AccountsContent
      accounts={accounts.all}
      activeAccounts={accounts.active}
      includeArchived={accounts.includeArchived}
      onIncludeArchivedChange={accounts.setIncludeArchived}
      isLoading={accounts.isLoading}
      error={accounts.error}
      onRetry={accounts.refetch}
      isMutating={accounts.isMutating}
      onCreate={accounts.add}
      onEdit={accounts.edit}
      onSetArchived={accounts.setArchived}
      onDelete={accounts.remove}
      onTransfer={accounts.transfer}
    />
  );
}
