import React from 'react';
import { useTransactions } from './hooks/useTransactions';
import SummaryCards from './components/SummaryCards';
import TransactionForm from './components/TransactionForm';
import SummaryChart from './components/SummaryChart';
import TransactionList from './components/TransactionList';

export default function App(): React.ReactElement {
  const {
    addTransaction,
    deleteTransaction,
    filters,
    updateFilters,
    sort,
    updateSort,
    sortedTransactions,
    summary,
    expenseByCategory,
  } = useTransactions();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Finance Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Track your income and expenses with ease</p>
        </header>

        {/* Summary Cards */}
        <SummaryCards summary={summary} />

        {/* Form + Chart Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <TransactionForm onAdd={addTransaction} />
          </div>
          <div className="lg:col-span-3">
            <SummaryChart summary={summary} expenseByCategory={expenseByCategory} />
          </div>
        </div>

        {/* Transaction List */}
        <TransactionList
          transactions={sortedTransactions}
          onDelete={deleteTransaction}
          filters={filters}
          onFilterChange={updateFilters}
          sort={sort}
          onSortChange={updateSort}
        />
      </div>
    </div>
  );
}
