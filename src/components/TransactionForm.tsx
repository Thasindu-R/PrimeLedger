import React, { useState } from "react";
import { useTransactions } from "../hooks/useTransactions";

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Gift",
  "Other",
];
const EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Utilities",
  "Entertainment",
  "Health",
  "Education",
  "Other",
];

export default function TransactionForm(): React.ReactElement {
  const { addTransaction } = useTransactions();

  const [type, setType] = useState<"Income" | "Expense">("Expense");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as "Income" | "Expense";
    setType(next);
    setCategory(
      next === "Income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    if (!date) {
      setError("Please select a date.");
      return;
    }

    // addTransaction expects an object matching Transaction minus id
    try {
      addTransaction({
        type,
        category,
        amount: parsed,
        date,
        description: description || undefined,
      } as any);

      // reset form
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      setType("Expense");
      setCategory(EXPENSE_CATEGORIES[0]);
    } catch (err) {
      setError("Failed to add transaction.");
    }
  }

  const categories = type === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div>
        <label>Type</label>
        <select value={type} onChange={handleTypeChange}>
          <option value="Expense">Expense</option>
          <option value="Income">Income</option>
        </select>
      </div>

      <div>
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div>
        <label>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div>
        <label>Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>

      {error && <div style={{ color: "var(--danger, #c00)" }}>{error}</div>}

      <div>
        <button type="submit">Add Transaction</button>
      </div>
    </form>
  );
}
