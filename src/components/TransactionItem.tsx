import React from 'react';
import { Trash2 } from 'lucide-react';
import type { Transaction } from '../types';
import { formatCurrency, formatDate } from '../utils/formatCurrency';

interface TransactionItemProps {
  transaction: Transaction;
  onDelete: (id: string) => void;
}

export default function TransactionItem({ transaction, onDelete }: TransactionItemProps): React.ReactElement {
  const isIncome = transaction.type === 'Income';

  return (
    <div
      className={`group flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all duration-200 ${
        isIncome ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-red-500'
      }`}
    >
      {/* Category Badge & Description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isIncome
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {transaction.category}
          </span>
          <span className="text-xs text-gray-400">{formatDate(transaction.date)}</span>
        </div>
        <p className="text-sm font-medium text-gray-800 truncate">
          {transaction.description || '—'}
        </p>
      </div>

      {/* Amount */}
      <div className="flex-shrink-0 text-right">
        <p
          className={`text-base font-bold ${
            isIncome ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
        </p>
      </div>

      {/* Delete Button */}
      <button
        type="button"
        onClick={() => onDelete(transaction.id)}
        className="flex-shrink-0 p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
        aria-label="Delete transaction"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
