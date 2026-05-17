import { useState } from 'react';
import { TrendingUp, TrendingDown, Copy, Check, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface BalanceCardProps {
  balance: number;
  changePercent: number;
  cardNumber: string;
  onSendMoney?: () => void;
  onRequestMoney?: () => void;
}

export function BalanceCard({
  balance,
  changePercent,
  cardNumber,
  onSendMoney,
  onRequestMoney,
}: BalanceCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(cardNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBalance = (value: number) => {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formatted = formatter.format(value);
    const parts = formatted.split('.');
    return {
      whole: parts[0],
      decimal: parts[1] || '00',
    };
  };

  const { whole, decimal } = formatBalance(balance);
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
        <span className="text-4xl font-bold text-gray-900">${whole}</span>
        <span className="text-2xl font-bold text-gray-400">.{decimal}</span>
      </div>

      {/* Section 3 - Card Number Row */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-gray-400 font-mono tracking-widest">
          {cardNumber}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 cursor-pointer transition-colors"
        >
          {copied ? (
            <Check size={13} className="text-green-600" />
          ) : (
            <Copy size={13} />
          )}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Section 4 - Action Buttons */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={onSendMoney}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <ArrowUpRight size={16} />
          <span>Send money</span>
        </button>
        <button
          onClick={onRequestMoney}
          className="flex-1 border border-green-500 text-green-600 hover:bg-green-50 text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <ArrowDownLeft size={16} />
          <span>Request money</span>
        </button>
      </div>
    </div>
  );
}
