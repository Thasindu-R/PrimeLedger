import { useState } from "react";
import { Plus, X, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import type { Transaction, TransactionType, Category } from "../types";

interface FormState {
  description: string;
  amount: string;
  type: TransactionType;
  category: Category;
  date: string;
}

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: Omit<Transaction, "id">) => void;
}

const INCOME_CATEGORIES: Category[] = ["Salary", "Freelance", "Gift", "Other"];
const EXPENSE_CATEGORIES: Category[] = [
  "Food",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Education",
  "Other",
];

export function AddTransactionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
    >
      <Plus size={16} />
      Add Transaction
    </button>
  );
}

export function TransactionForm({
  isOpen,
  onClose,
  onAdd,
}: TransactionFormProps) {
  const [formState, setFormState] = useState<FormState>({
    description: "",
    amount: "",
    type: "income",
    category: "Salary",
    date: new Date().toISOString().split("T")[0],
  });
  const [error, setError] = useState<string | null>(null);

  const categories =
    formState.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleTypeChange = (type: TransactionType) => {
    setFormState({
      ...formState,
      type,
      category: type === "income" ? "Salary" : "Food",
    });
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formState.description.trim()) {
      setError("Please enter a description");
      return;
    }

    const amount = parseFloat(formState.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    onAdd({
      type: formState.type,
      category: formState.category,
      amount,
      date: formState.date,
      description: formState.description.trim(),
    });

    setFormState({
      description: "",
      amount: "",
      type: "income",
      category: "Salary",
      date: new Date().toISOString().split("T")[0],
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Add Transaction
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => handleTypeChange("income")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              formState.type === "income"
                ? "bg-green-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <TrendingUp size={15} />
            Income
          </button>
          <button
            onClick={() => handleTypeChange("expense")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              formState.type === "expense"
                ? "bg-red-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <TrendingDown size={15} />
            Expense
          </button>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Description
            </label>
            <input
              type="text"
              value={formState.description}
              onChange={(e) =>
                setFormState({ ...formState, description: e.target.value })
              }
              placeholder="e.g. Monthly salary, Grocery run..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent placeholder-gray-300"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                Rs.
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={formState.amount}
                onChange={(e) =>
                  setFormState({ ...formState, amount: e.target.value })
                }
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent placeholder-gray-300 pl-10"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Category
            </label>
            <select
              value={formState.category}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  category: e.target.value as Category,
                })
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent bg-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Date
            </label>
            <input
              type="date"
              value={formState.date}
              onChange={(e) =>
                setFormState({ ...formState, date: e.target.value })
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} />
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl text-base sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-6"
          >
            <Plus size={16} />
            Add Transaction
          </button>
        </form>
      </div>
    </div>
  );
}
