import React from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import type { Summary } from '../types';
import { formatCurrency } from '../utils/formatCurrency';

interface SummaryCardsProps {
  summary: Summary;
}

export default function SummaryCards({ summary }: SummaryCardsProps): React.ReactElement {
  const balanceColor = summary.balance >= 0 ? 'text-emerald-600' : 'text-red-600';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Balance Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow duration-200">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
          <Wallet className="w-6 h-6 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">Balance</p>
          <p className={`text-xl font-bold truncate ${balanceColor}`}>
            {formatCurrency(summary.balance)}
          </p>
        </div>
      </div>

      {/* Total Income Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow duration-200">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">Total Income</p>
          <p className="text-xl font-bold text-emerald-600 truncate">
            {formatCurrency(summary.totalIncome)}
          </p>
        </div>
      </div>

      {/* Total Expense Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow duration-200">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
          <TrendingDown className="w-6 h-6 text-red-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">Total Expense</p>
          <p className="text-xl font-bold text-red-600 truncate">
            {formatCurrency(summary.totalExpense)}
          </p>
        </div>
      </div>
    </div>
  );
}
