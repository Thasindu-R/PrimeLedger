import { useState } from "react";
import {
  Download,
  ChevronUp,
  ChevronDown,
  Pencil,
  Receipt,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDate } from "../utils/formatCurrency";
import { downloadCsv, exportFilename, transactionsToCsv } from "../utils/csv";
import { SkeletonList } from "./ui/Skeleton";
import { ErrorState } from "./ui/ErrorState";
import { EmptyState } from "./ui/EmptyState";
import { Pagination } from "./ui/Pagination";
import type { Transaction } from "../types";
import type {
  TransactionFilters,
  SortConfig,
  SortField,
} from "../hooks/useTransactions";

interface TransactionsContentProps {
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  updateFilters: (patch: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
  filters: TransactionFilters;
  /** The current page, already filtered and sorted by the server. */
  transactions: Transaction[];
  sort: SortConfig;
  updateSort: (field: SortField) => void;

  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;

  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  totalPages: number;
  totalElements: number;

  /** Fetches every matching row, so the export is not just the page on screen. */
  fetchAllMatching: () => Promise<Transaction[]>;
}

export function TransactionsContent({
  onDelete,
  onEdit,
  updateFilters,
  resetFilters,
  filters,
  transactions,
  sort,
  updateSort,
  isLoading,
  isFetching,
  error,
  refetch,
  page,
  setPage,
  pageSize,
  totalPages,
  totalElements,
  fetchAllMatching,
}: TransactionsContentProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Honours the filters, as it always has — but the rows now live on the
      // server, so all of them have to be fetched rather than read from memory.
      const all = await fetchAllMatching();
      downloadCsv(transactionsToCsv(all), exportFilename());
    } finally {
      setExporting(false);
    }
  };

  const hasFilters =
    Boolean(filters.search?.trim()) ||
    filters.type !== undefined ||
    filters.categoryId !== undefined ||
    filters.startDate !== undefined ||
    filters.endDate !== undefined ||
    filters.minAmount !== undefined ||
    filters.maxAmount !== undefined;

  const handleSort = (field: SortField) => {
    updateSort(field);
  };

  const getSortIcon = (field: SortField) => {
    if (sort.field !== field) return null;
    return sort.order === "asc" ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  };

  const isSortActive = (field: SortField) => sort.field === field;

  return (
    <div className="space-y-4">
      {/* Section 1 - Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-800">
            All Transactions
          </h2>
          <span className="text-sm text-gray-400">
            {isLoading ? '…' : `${totalElements} total`}
          </span>
        </div>
        <button
          onClick={() => void handleExport()}
          disabled={exporting || totalElements === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={15} />
          <span>{exporting ? 'Preparing…' : 'Export CSV'}</span>
        </button>
      </div>

      {/* Section 2 - Filter and Sort Bar */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-4">
        {/* Row 1: Search and Type Toggle */}
        <div className="flex flex-col lg:flex-row gap-3 mb-3">
          <input
            type="text"
            placeholder="Search transactions..."
            value={filters.search || ""}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-base sm:text-sm focus:outline-none focus:border-gray-300"
          />
          <div className="flex gap-1 bg-gray-50 rounded-xl p-1 w-full lg:w-auto">
            <button
              onClick={() => (filters.type ? resetFilters() : null)}
              className={`flex-1 lg:flex-none px-4 py-2 text-sm rounded-lg transition-all ${
                !filters.type
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              All
            </button>
            <button
              onClick={() => updateFilters({ type: "income" })}
              className={`flex-1 lg:flex-none px-4 py-2 text-sm rounded-lg transition-all ${
                filters.type === "income"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Income
            </button>
            <button
              onClick={() => updateFilters({ type: "expense" })}
              className={`flex-1 lg:flex-none px-4 py-2 text-sm rounded-lg transition-all ${
                filters.type === "expense"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Expense
            </button>
          </div>
        </div>

        {/* Row 2: Sort Buttons */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => handleSort("date")}
            className={`flex items-center gap-1 text-sm transition-colors ${
              isSortActive("date")
                ? "text-green-600 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Date
            {getSortIcon("date")}
          </button>
          <button
            onClick={() => handleSort("amount")}
            className={`flex items-center gap-1 text-sm transition-colors ${
              isSortActive("amount")
                ? "text-green-600 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Amount
            {getSortIcon("amount")}
          </button>
          <button
            onClick={() => handleSort("category")}
            className={`flex items-center gap-1 text-sm transition-colors ${
              isSortActive("category")
                ? "text-green-600 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Category
            {getSortIcon("category")}
          </button>
          <button
            onClick={() => handleSort("type")}
            className={`flex items-center gap-1 text-sm transition-colors ${
              isSortActive("type")
                ? "text-green-600 font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Type
            {getSortIcon("type")}
          </button>
        </div>
      </div>

      {/* Section 3 - Transaction Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <SkeletonList rows={6} />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} subject="your transactions" />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={
              hasFilters
                ? 'No transactions match your filters'
                : 'No transactions yet'
            }
            hint={
              hasFilters
                ? 'Try widening the date range, or clearing the search.'
                : 'Add your first transaction and it will appear here.'
            }
            action={
              hasFilters ? (
                <button
                  onClick={resetFilters}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="md:hidden p-4 space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="border border-gray-100 rounded-xl p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {transaction.description || transaction.category}
                    </p>
                    <span
                      className={`text-sm font-semibold ${
                        transaction.type === "income"
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {formatCurrency(transaction.amount)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                    <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                      {transaction.category}
                    </span>
                    <span className="text-gray-400">
                      {formatDate(transaction.date)}
                    </span>
                    <span
                      className={`capitalize ${
                        transaction.type === "income"
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {transaction.type}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onEdit(transaction)}
                      aria-label={`Edit ${transaction.description || transaction.category}`}
                      className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
                    >
                      <Pencil size={16} />
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(transaction.id)}
                      aria-label={`Delete ${transaction.description || transaction.category}`}
                      className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-600 py-2 rounded-lg text-sm hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-[720px] w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors last:border-0"
                    >
                      <td className="px-4 py-3.5 text-sm text-gray-400 text-xs">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-medium text-gray-800">
                        {transaction.description || transaction.category}
                      </td>
                      <td className="px-4 py-3.5 text-sm">
                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs font-medium">
                          {transaction.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm capitalize">
                        <span
                          className={`${
                            transaction.type === "income"
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-right">
                        <span
                          className={`${
                            transaction.type === "income"
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEdit(transaction)}
                            aria-label={`Edit ${transaction.description || transaction.category}`}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => onDelete(transaction.id)}
                            aria-label={`Delete ${transaction.description || transaction.category}`}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={pageSize}
              onPageChange={setPage}
              busy={isFetching}
            />
          </>
        )}
      </div>
    </div>
  );
}
