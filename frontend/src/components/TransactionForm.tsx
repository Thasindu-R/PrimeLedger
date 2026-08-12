import { useEffect, useId, useState } from "react";
import { Plus, X, TrendingUp, TrendingDown, AlertCircle, Save } from "lucide-react";
import { type Transaction, type TransactionType } from "../types";
import { categoriesOfKind, type CategoryOption } from "../api/categories";
import type { TransactionInput } from "../api/transactions";
import {
  DATE_ERROR_MESSAGES,
  maxTransactionDate,
  MIN_TRANSACTION_DATE,
  today,
  validateTransactionDate,
} from "../utils/dates";

interface FormState {
  description: string;
  amount: string;
  type: TransactionType;
  /** The category's id: what the API addresses, and what the form now holds. */
  categoryId: string;
  date: string;
}

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionInput) => void;
  /**
   * The categories this account has, from the server. Phase 1 derived them from
   * a hard-coded union; they are rows now, so a user-defined category appears
   * here without a code change (FR-17).
   */
  categories: CategoryOption[];
  /** False while the account or category list is still loading, or failed. */
  canSubmit?: boolean;
  /** When present the form edits this transaction instead of creating one (D-07). */
  transaction?: Transaction;
}

function emptyForm(): FormState {
  return {
    description: "",
    amount: "",
    type: "income",
    categoryId: "",
    date: today(),
  };
}

function formFor(transaction: Transaction | undefined): FormState {
  if (!transaction) return emptyForm();
  return {
    description: transaction.description ?? "",
    amount: String(transaction.amount),
    type: transaction.type,
    categoryId: transaction.categoryId,
    date: transaction.date,
  };
}

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
  onSubmit,
  categories: allCategories,
  canSubmit = true,
  transaction,
}: TransactionFormProps) {
  const isEditing = transaction !== undefined;
  const [formState, setFormState] = useState<FormState>(() => formFor(transaction));
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const amountId = useId();
  const categoryId = useId();
  const dateId = useId();

  // Reopening the modal must not show the previous subject's values. The shell
  // remounts this component on every open (see the `key` in App) rather than
  // resetting state from an effect.

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const categories = categoriesOfKind(allCategories, formState.type);
  // The selected id may not be in the list yet on first render, or may belong to
  // the other type after a toggle. Falling back to the first option keeps the
  // select and the state agreeing, which is what stops a submit with no category.
  const selectedId =
    categories.find((category) => category.id === formState.categoryId)?.id ??
    categories[0]?.id ??
    "";

  const handleTypeChange = (type: TransactionType) => {
    setFormState((prev) => {
      const next = categoriesOfKind(allCategories, type);
      return {
        ...prev,
        type,
        // An income category cannot hold an expense — the server rejects it with
        // a 422, so the form must not offer it in the first place.
        categoryId: next.some((category) => category.id === prev.categoryId)
          ? prev.categoryId
          : (next[0]?.id ?? ""),
      };
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

    const dateValidity = validateTransactionDate(formState.date);
    if (dateValidity !== "ok") {
      setError(DATE_ERROR_MESSAGES[dateValidity]);
      return;
    }

    if (!selectedId) {
      setError("Please choose a category");
      return;
    }

    onSubmit({
      type: formState.type,
      categoryId: selectedId,
      amount,
      date: formState.date,
      description: formState.description.trim(),
    });

    setFormState(emptyForm());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id={titleId} className="text-lg font-semibold text-gray-800">
            {isEditing ? "Edit Transaction" : "Add Transaction"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            type="button"
            onClick={() => handleTypeChange("income")}
            aria-pressed={formState.type === "income"}
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
            type="button"
            onClick={() => handleTypeChange("expense")}
            aria-pressed={formState.type === "expense"}
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
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Description */}
          <div>
            <label
              htmlFor={descriptionId}
              className="text-xs font-medium text-gray-500 mb-1.5 block"
            >
              Description
            </label>
            <input
              id={descriptionId}
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
            <label
              htmlFor={amountId}
              className="text-xs font-medium text-gray-500 mb-1.5 block"
            >
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                Rs.
              </span>
              <input
                id={amountId}
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
            <label
              htmlFor={categoryId}
              className="text-xs font-medium text-gray-500 mb-1.5 block"
            >
              Category
            </label>
            <select
              id={categoryId}
              value={selectedId}
              disabled={categories.length === 0}
              onChange={(e) =>
                setFormState({ ...formState, categoryId: e.target.value })
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent bg-white disabled:bg-gray-50 disabled:text-gray-400"
            >
              {categories.length === 0 ? (
                <option value="">Loading categories…</option>
              ) : (
                categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Date */}
          <div>
            <label
              htmlFor={dateId}
              className="text-xs font-medium text-gray-500 mb-1.5 block"
            >
              Date
            </label>
            <input
              id={dateId}
              type="date"
              value={formState.date}
              min={MIN_TRANSACTION_DATE}
              max={maxTransactionDate()}
              onChange={(e) =>
                setFormState({ ...formState, date: e.target.value })
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base sm:text-sm outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent"
            />
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} />
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl text-base sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-6 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isEditing ? <Save size={16} /> : <Plus size={16} />}
            {isEditing ? "Save changes" : "Add Transaction"}
          </button>
        </form>
      </div>
    </div>
  );
}
