import {
  Download,
  ChevronUp,
  ChevronDown,
  Receipt,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDate } from "../utils/formatCurrency";
import type { Transaction } from "../types";
import type {
  TransactionFilters,
  SortConfig,
  SortField,
} from "../hooks/useTransactions";

interface TransactionsContentProps {
  onDelete: (id: string) => void;
  updateFilters: (patch: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
  filters: TransactionFilters;
  sortedTransactions: Transaction[];
  sort: SortConfig;
  updateSort: (field: SortField) => void;
}

function exportToCSV(transactions: Transaction[]) {
  const headers = ["Date", "Description", "Category", "Type", "Amount"];
  const rows = transactions.map((t) => [
    t.date,
    t.description || "",
    t.category,
    t.type,
    t.amount.toString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TransactionsContent({
  onDelete,
  updateFilters,
  resetFilters,
  filters,
  sortedTransactions,
  sort,
  updateSort,
}: TransactionsContentProps) {
  const handleExport = () => {
    exportToCSV(sortedTransactions);
  };

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
            {sortedTransactions.length} total
          </span>
        </div>
        <button
          onClick={handleExport}
          className="w-full sm:w-auto flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Download size={15} />
          <span>Export CSV</span>
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
        {sortedTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Receipt size={48} className="mb-3" />
            <p className="text-sm">No transactions match your filters</p>
          </div>
        ) : (
          <>
            <div className="md:hidden p-4 space-y-3">
              {sortedTransactions.map((transaction) => (
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
                  <button
                    onClick={() => onDelete(transaction.id)}
                    className="mt-3 w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 py-2 rounded-lg text-sm hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
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
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map((transaction) => (
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
                        <button
                          onClick={() => onDelete(transaction.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
