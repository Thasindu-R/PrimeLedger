import { TransactionsContent } from '../../components/TransactionsContent';
import { useLedger } from '../ledgerContext';

export function TransactionsPage() {
  const {
    requestDelete,
    requestEdit,
    updateFilters,
    resetFilters,
    filters,
    sortedTransactions,
    sort,
    updateSort,
  } = useLedger();

  return (
    <TransactionsContent
      onDelete={requestDelete}
      onEdit={requestEdit}
      updateFilters={updateFilters}
      resetFilters={resetFilters}
      filters={filters}
      sortedTransactions={sortedTransactions}
      sort={sort}
      updateSort={updateSort}
    />
  );
}
