import React, { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import type { Transaction, TransactionType, Category, IncomeCategory, ExpenseCategory } from '../types';

const INCOME_CATEGORIES: IncomeCategory[] = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'];
const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Food', 'Transport', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Education', 'Other'];

interface TransactionFormProps {
  onAdd: (data: Omit<Transaction, 'id'>) => void;
}

export default function TransactionForm({ onAdd }: TransactionFormProps): React.ReactElement {
  const [type, setType] = useState<TransactionType>('Expense');
  const [category, setCategory] = useState<Category>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const categories = type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function handleTypeChange(newType: TransactionType) {
    setType(newType);
    setCategory(newType === 'Income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError('Please enter a description.');
      return;
    }

    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (!date) {
      setError('Please select a date.');
      return;
    }

    onAdd({
      type,
      category,
      amount: parsed,
      date,
      description: description.trim(),
    });

    // Reset form
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setType('Expense');
    setCategory(EXPENSE_CATEGORIES[0]);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-gray-800">Add Transaction</h2>

      {/* Type Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200">
        <button
          type="button"
          onClick={() => handleTypeChange('Income')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors duration-150 cursor-pointer ${
            type === 'Income'
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          Income
        </button>
        <button
          type="button"
          onClick={() => handleTypeChange('Expense')}
          className={`flex-1 py-2.5 text-sm font-semibold transition-colors duration-150 cursor-pointer ${
            type === 'Expense'
              ? 'bg-red-500 text-white'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          Expense
        </button>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="form-description" className="block text-sm font-medium text-gray-600 mb-1">
          Description
        </label>
        <input
          id="form-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Monthly salary"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
        />
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="form-amount" className="block text-sm font-medium text-gray-600 mb-1">
          Amount (Rs.)
        </label>
        <input
          id="form-amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="form-category" className="block text-sm font-medium text-gray-600 mb-1">
          Category
        </label>
        <select
          id="form-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition appearance-none"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label htmlFor="form-date" className="block text-sm font-medium text-gray-600 mb-1">
          Date
        </label>
        <input
          id="form-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors duration-150 cursor-pointer"
      >
        <PlusCircle className="w-5 h-5" />
        Add Transaction
      </button>
    </form>
  );
}
