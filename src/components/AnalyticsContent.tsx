import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Hash, TrendingDown, PiggyBank } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency';
import type { CategoryBreakdown } from './AllExpensesPanel';
import type { Transaction, Summary } from '../types';

interface AnalyticsContentProps {
  transactions: Transaction[];
  summary: Summary;
  expenseByCategory: CategoryBreakdown[];
  incomeByCategory: CategoryBreakdown[];
}

export function AnalyticsContent({
  transactions,
  summary,
  expenseByCategory,
  incomeByCategory,
}: AnalyticsContentProps) {
  const highestExpense = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense');
    if (expenses.length === 0) return 0;
    return Math.max(...expenses.map((t) => t.amount));
  }, [transactions]);

  const savingsRate = useMemo(() => {
    if (summary.totalIncome === 0) return 'N/A';
    const rate = ((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 100;
    return rate.toFixed(1) + '%';
  }, [summary.totalIncome, summary.totalExpense]);

  const monthlyNetData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, i) => {
      const monthTransactions = transactions.filter((t) => new Date(t.date).getMonth() === i);
      const income = monthTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return {
        month,
        income,
        expense,
        net: income - expense,
      };
    });
  }, [transactions]);

  const getNetBarColor = (value: number) => (value >= 0 ? '#22c55e' : '#ef4444');

  function CategoryTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
        <p className="font-semibold mb-1">{label}</p>
        <p style={{ color: payload[0].color }}>
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }

  function NetSavingsTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
        <p className="font-semibold mb-1">{label}</p>
        <p style={{ color: payload[0].fill }}>
          Net: {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section 1 - Summary Stat Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Total Transactions */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Hash size={18} className="text-green-500" />
            <span className="text-sm text-gray-400 font-medium">Total Transactions</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
        </div>

        {/* Highest Expense */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={18} className="text-red-500" />
            <span className="text-sm text-gray-400 font-medium">Highest Expense</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(highestExpense)}</p>
        </div>

        {/* Savings Rate */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank size={18} className="text-blue-500" />
            <span className="text-sm text-gray-400 font-medium">Savings Rate</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{savingsRate}</p>
        </div>
      </div>

      {/* Section 2 - Side by Side Category Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Income by Category */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Income by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={incomeByCategory} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: '#9ca3af' }} width={80} axisLine={false} tickLine={false} />
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
              <Tooltip content={<CategoryTooltip />} />
              <Bar dataKey="total" fill="#22c55e" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses by Category */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">Expenses by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={expenseByCategory} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: '#9ca3af' }} width={80} axisLine={false} tickLine={false} />
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
              <Tooltip content={<CategoryTooltip />} />
              <Bar dataKey="total" fill="#ef4444" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section 3 - Monthly Net Savings */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-800">Monthly Net Savings</h3>
          <p className="text-sm text-gray-400">Income minus expenses per month</p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyNetData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <Tooltip content={<NetSavingsTooltip />} />
            <Bar dataKey="net" radius={[4, 4, 0, 0]}>
              {monthlyNetData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getNetBarColor(entry.net)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
