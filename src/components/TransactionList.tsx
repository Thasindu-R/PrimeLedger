import React from 'react';
import { Search, Inbox, ArrowDownUp } from 'lucide-react';
import type { Transaction } from '../types';
import type { TransactionFilters, SortConfig, SortField } from '../hooks/useTransactions';
import TransactionItem from './TransactionItem';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  filters: TransactionFilters;
  onFilterChange: (patch: Partial<TransactionFilters>) => void;
  sort: SortConfig;
  onSortChange: (field: SortField) => void;
}

type FilterType = 'All' | 'Income' | 'Expense';

export default function TransactionList({
  transactions,
  onDelete,
  filters,
  onFilterChange,
  sort,
  onSortChange,
}: TransactionListProps): React.ReactElement {
  const activeType: FilterType = filters.type ?? 'All';

  function handleTypeFilter(value: FilterType) {
    if (value === 'All') {
      onFilterChange({ type: undefined });
    } else {
      onFilterChange({ type: value });
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Transactions</h2>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions…"
            value={filters.search ?? ''}
            onChange={(e) => onFilterChange({ search: e.target.value || undefined })}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
          />
        </div>

        {/* Type Filter Buttons */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          {(['All', 'Income', 'Expense'] as FilterType[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTypeFilter(value)}
              className={`px-4 py-2 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                activeType === value
                  ? value === 'Income'
                    ? 'bg-emerald-500 text-white'
                    : value === 'Expense'
                      ? 'bg-red-500 text-white'
                      : 'bg-blue-600 text-white'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <ArrowDownUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <select
            value={sort.field}
            onChange={(e) => onSortChange(e.target.value as SortField)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition appearance-none cursor-pointer"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="category">Category</option>
            <option value="type">Type</option>
          </select>
        </div>
      </div>

      {/* Result Count */}
      <p className="text-xs text-gray-400 font-medium">
        {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
      </p>

      {/* Transaction List */}
      {transactions.length > 0 ? (
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {transactions.map((t) => (
            <TransactionItem key={t.id} transaction={t} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Inbox className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-sm font-medium">No transactions found</p>
          <p className="text-xs mt-1">Add your first transaction to get started</p>
        </div>
      )}
    </div>
  );
}
