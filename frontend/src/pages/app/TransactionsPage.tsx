import { TransactionsContent } from '../../components/TransactionsContent';
import { useLedger } from '../ledgerContext';

export function TransactionsPage() {
  const ledger = useLedger();

  return (
    <TransactionsContent
      onDelete={ledger.requestDelete}
      onEdit={ledger.requestEdit}
      updateFilters={ledger.updateFilters}
      resetFilters={ledger.resetFilters}
      filters={ledger.filters}
      transactions={ledger.transactions}
      sort={ledger.sort}
      updateSort={ledger.updateSort}
      isLoading={ledger.isLoading}
      isFetching={ledger.isFetching}
      error={ledger.error}
      refetch={ledger.refetch}
      page={ledger.page}
      setPage={ledger.setPage}
      pageSize={ledger.pageSize}
      totalPages={ledger.totalPages}
      totalElements={ledger.totalElements}
      fetchAllMatching={ledger.fetchAllMatching}
    />
  );
}
