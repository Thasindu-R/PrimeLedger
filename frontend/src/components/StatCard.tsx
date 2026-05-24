import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrencyParts } from '../utils/formatCurrency';

interface StatCardProps {
  label: string;
  amount: number;
  changePercent: number;
  variant: 'income' | 'expense';
  icon: React.ReactNode;
}

export function StatCard({
  label,
  amount,
  changePercent,
  variant,
  icon,
}: StatCardProps) {
  const { whole, decimal } = formatCurrencyParts(amount);
  const isPositive = changePercent >= 0;

  return (
    <div className="w-full bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      {/* Section 1 - Icon */}
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
          variant === 'income' ? 'bg-green-50' : 'bg-red-50'
        }`}
      >
        <div
          className={`${
            variant === 'income' ? 'text-green-600' : 'text-red-500'
          }`}
          style={{ width: '20px', height: '20px' }}
        >
          {icon}
        </div>
      </div>

      {/* Section 2 - Label */}
      <p className="text-sm text-gray-400 font-medium mb-2">{label}</p>

      {/* Section 3 - Amount */}
      <div>
        <span className="text-3xl font-bold text-gray-900">{whole}</span>
        <span className="text-xl font-bold text-gray-400">{decimal}</span>
      </div>

      {/* Section 4 - Percentage Change */}
      <div className="flex items-center gap-1 mt-2">
        {isPositive ? (
          <TrendingUp size={13} className="text-green-500" />
        ) : (
          <TrendingDown size={13} className="text-red-500" />
        )}
        <span
          className={`text-xs ${
            isPositive ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {isPositive ? '+' : ''}
          {changePercent}% compared to last month
        </span>
      </div>
    </div>
  );
}
