import { useId, useState } from "react";
import { Search, SlidersHorizontal, Receipt } from "lucide-react";
import type { Transaction } from "../types";
import type { SortConfig } from "../hooks/useTransactions";
import { TransactionItem } from "./TransactionItem";

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onSearchChange: (term: string) => void;
  onTypeFilter: (type: "income" | "expense" | undefined) => void;
  onSortChange: (sort: SortConfig) => void;
  sort: SortConfig;
  activeType?: "income" | "expense";
}

/**
 * The dropdown picks a field and a direction together, so it cannot go through
 * `updateSort`, which only toggles. Mapping here keeps the option values as the
 * single place the two vocabularies meet (D-04).
 */
const SORT_OPTIONS: { value: string; label: string; sort: SortConfig }[] = [
  { value: "date-newest", label: "Date (Newest)", sort: { field: "date", order: "desc" } },
  { value: "date-oldest", label: "Date (Oldest)", sort: { field: "date", order: "asc" } },
  { value: "amount-high", label: "Amount (High)", sort: { field: "amount", order: "desc" } },
  { value: "amount-low", label: "Amount (Low)", sort: { field: "amount", order: "asc" } },
  { value: "category", label: "Category", sort: { field: "category", order: "asc" } },
];

function optionValueFor(sort: SortConfig): string {
  const match = SORT_OPTIONS.find(
    (option) => option.sort.field === sort.field && option.sort.order === sort.order,
  );
  return match?.value ?? "date-newest";
}

export function TransactionList({
  transactions,
  onDelete,
  onEdit,
  onSearchChange,
  onTypeFilter,
  onSortChange,
  sort,
  activeType,
}: TransactionListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const sortId = useId();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearchChange(value);
  };

  const handleTypeFilter = (type: "income" | "expense" | undefined) => {
    onTypeFilter(type);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const option = SORT_OPTIONS.find((o) => o.value === e.target.value);
    if (option) onSortChange(option.sort);
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm">
      {/* Section 1 - Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 border-b border-gray-50">
        {/* Left */}
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            Transaction and invoices
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Stay up to date on recent financial activities
          </p>
        </div>

        {/* Right */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search Input */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full sm:w-64">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              aria-label="Search transactions"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="bg-transparent text-base sm:text-sm outline-none text-gray-600 placeholder-gray-400 w-full"
            />
          </div>

          {/* Filter Dropdown Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-gray-300 cursor-pointer"
          >
            <SlidersHorizontal size={14} className="text-gray-400" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* Section 2 - Filter Bar */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-3 border-b border-gray-50 bg-gray-50/50 flex-wrap">
          {/* Type Filter */}
          <div className="flex gap-1 flex-wrap">
            {[
              { label: "All", value: undefined },
              { label: "Income", value: "income" as const },
              { label: "Expense", value: "expense" as const },
            ].map((filter) => (
              <button
                key={filter.label}
                onClick={() => handleTypeFilter(filter.value)}
                className={`${
                  (activeType === filter.value && filter.value !== undefined) ||
                  (activeType === undefined && filter.value === undefined)
                    ? "bg-white border border-gray-200 shadow-sm text-gray-800"
                    : "text-gray-400 hover:text-gray-600"
                } text-xs font-medium px-3 py-1.5 rounded-lg transition-colors`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <label htmlFor={sortId} className="sr-only">
            Sort by
          </label>
          <select
            id={sortId}
            value={optionValueFor(sort)}
            onChange={handleSortChange}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-500 outline-none bg-white cursor-pointer w-full sm:w-auto"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Results Count */}
          <span className="text-xs text-gray-400 sm:ml-auto">
            Showing {transactions.length} transaction
            {transactions.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Section 3 - Transaction Rows */}
      {transactions.length > 0 ? (
        <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto px-3 divide-y divide-gray-50">
          {transactions.map((transaction) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <Receipt size={40} strokeWidth={1.5} />
          <p className="text-sm mt-3 font-medium">No transactions found</p>
          <p className="text-xs mt-1">
            Add your first transaction using the form above
          </p>
        </div>
      )}
    </div>
  );
}
