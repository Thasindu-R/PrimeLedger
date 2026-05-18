import { ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react';
import type { Transaction } from '../types';

interface TransactionItemProps {
  transaction: Transaction;
  onDelete: (id: string) => void;
}

export function TransactionItem({ transaction, onDelete }: TransactionItemProps) {
  const isIncome = transaction.type === 'income';

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="flex items-center gap-4 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-xl px-3 transition-colors group">
      {/* Left - Category Icon Container */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isIncome ? 'bg-green-50' : 'bg-red-50'
        }`}
      >
        {isIncome ? (
          <ArrowDownLeft size={18} className="text-green-500" />
        ) : (
          <ArrowUpRight size={18} className="text-red-500" />
        )}
      </div>

      {/* Center - Description and Meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {transaction.description || transaction.category}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
            {transaction.category}
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span className="text-xs text-gray-400">{formatDate(transaction.date)}</span>
        </div>
      </div>

      {/* Right - Amount and Delete */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span
          className={`text-sm font-semibold ${
            isIncome ? 'text-green-600' : 'text-red-500'
          }`}
        >
          {isIncome ? '+' : '-'}Rs. {formatAmount(transaction.amount)}
        </span>
        <button
          onClick={() => onDelete(transaction.id)}
          className="sm:opacity-0 opacity-100 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
