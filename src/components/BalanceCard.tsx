import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrencyParts } from '../utils/formatCurrency';

interface BalanceCardProps {
  balance: number;
  changePercent: number;
  totalIncome: number;
  totalExpense: number;
}

export function BalanceCard({
  balance,
  changePercent,
  totalIncome,
  totalExpense,
}: BalanceCardProps) {
  const { whole, decimal } = formatCurrencyParts(balance);
  const isPositive = changePercent >= 0;

  return (
    <div className="w-full bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      {/* Section 1 - Top Row */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400 font-medium">My balance</span>
        <div
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
            isPositive
              ? 'bg-green-50 text-green-600'
              : 'bg-red-50 text-red-500'
          }`}
        >
          {isPositive ? (
            <TrendingUp size={12} />
          ) : (
            <TrendingDown size={12} />
          )}
          <span>
            {isPositive ? '+' : ''}
            {changePercent}% vs last month
          </span>
        </div>
      </div>

      {/* Section 2 - Balance Amount */}
      <div className="mt-4">
        <span className="text-4xl font-bold text-gray-900">{whole}</span>
        <span className="text-2xl font-bold text-gray-400">{decimal}</span>
      </div>

      {/* Section 3 - Total Income Row */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Total Income</span>
          <TrendingUp size={12} className="text-green-500" />
        </div>
        <span className="text-sm font-semibold text-green-600">
          {formatCurrencyParts(totalIncome).whole}{formatCurrencyParts(totalIncome).decimal}
        </span>
      </div>

      {/* Section 4 - Total Expenses Row */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Total Expenses</span>
          <TrendingDown size={12} className="text-red-400" />
        </div>
        <span className="text-sm font-semibold text-red-500">
          {formatCurrencyParts(totalExpense).whole}{formatCurrencyParts(totalExpense).decimal}
        </span>
      </div>
    </div>
  );
}
