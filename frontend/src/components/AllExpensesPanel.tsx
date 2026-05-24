import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import type { Transaction } from '../types';
import { formatCurrency } from '../utils/formatCurrency';

const RING_COLORS = [
  '#22c55e',
  '#ef4444',
  '#fb923c',
  '#3b82f6',
  '#a855f7',
  '#eab308',
  '#14b8a6',
];

export interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
}

interface AllExpensesPanelProps {
  transactions: Transaction[];
}

export function AllExpensesPanel({ transactions }: AllExpensesPanelProps) {
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('expense');
  const [activePeriod, setActivePeriod] = useState<
    'month' | 'lastMonth' | 'year' | 'all'
  >('month');

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    return transactions
      .filter((t) => {
        const d = new Date(t.date);
        if (activePeriod === 'month') {
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        }
        if (activePeriod === 'lastMonth') {
          const last = thisMonth === 0 ? 11 : thisMonth - 1;
          const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;
          return d.getMonth() === last && d.getFullYear() === lastYear;
        }
        if (activePeriod === 'year') {
          return d.getFullYear() === thisYear;
        }
        return true;
      })
      .filter((t) => t.type === activeTab);
  }, [transactions, activePeriod, activeTab]);

  const categories = useMemo(() => {
    const grandTotal = filteredTransactions.reduce((s, t) => s + t.amount, 0);
    const map = new Map<string, number>();
    for (const t of filteredTransactions) {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({
        category,
        total,
        percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions]);

  const grandTotal = filteredTransactions.reduce((s, t) => s + t.amount, 0);
  const txCount = filteredTransactions.length;
  const avgPerTx = txCount > 0 ? grandTotal / txCount : 0;

  const periodPills: { key: typeof activePeriod; label: string }[] = [
    { key: 'month', label: 'This Month' },
    { key: 'lastMonth', label: 'Last Month' },
    { key: 'year', label: 'This Year' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Section 1 — Income / Expense tab toggle */}
      <div className="grid grid-cols-2 gap-1 bg-gray-50 rounded-xl p-1 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('income')}
          className={
            activeTab === 'income'
              ? 'bg-white rounded-lg shadow-sm text-gray-800 font-medium text-sm py-2 text-center transition-all text-green-600'
              : 'text-gray-400 text-sm py-2 text-center hover:text-gray-600 transition-all'
          }
        >
          Income
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expense')}
          className={
            activeTab === 'expense'
              ? 'bg-white rounded-lg shadow-sm text-gray-800 font-medium text-sm py-2 text-center transition-all text-red-500'
              : 'text-gray-400 text-sm py-2 text-center hover:text-gray-600 transition-all'
          }
        >
          Expenses
        </button>
      </div>

      {/* Section 2 — Period selector */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {periodPills.map((pill) => (
          <button
            key={pill.key}
            type="button"
            onClick={() => setActivePeriod(pill.key)}
            className={
              activePeriod === pill.key
                ? 'bg-green-500 text-white text-xs font-medium px-3 py-1 rounded-full'
                : 'bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full hover:bg-gray-200'
            }
          >
            {pill.label}
          </button>
        ))}
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-44 text-gray-300">
          <PieChartIcon size={32} strokeWidth={1.5} />
          <p className="text-sm mt-2 font-medium">No data for this period</p>
          <p className="text-xs mt-1">Try selecting a different period</p>
        </div>
      ) : (
        <>
          {/* Section 3 — Summary row */}
          <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-xl">
            <div>
              <p className="text-xs text-gray-400">Total</p>
              <p className="text-sm font-bold text-gray-800">
                {formatCurrency(grandTotal)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{txCount} transactions</p>
              <p className="text-xs font-medium text-gray-600">
                Avg {formatCurrency(avgPerTx)}
              </p>
            </div>
          </div>

          {/* Section 4 — Donut chart */}
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="percentage"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  strokeWidth={2}
                  stroke="white"
                  paddingAngle={2}
                >
                  {categories.map((entry, index) => (
                    <Cell
                      key={entry.category}
                      fill={RING_COLORS[index % RING_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${Math.round(value)}%`,
                    name,
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #f3f4f6',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {categories.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-gray-400">
                  {categories[0].category}
                </span>
                <span className="text-sm font-bold text-gray-800">
                  {formatCurrency(categories[0].total)}
                </span>
              </div>
            )}
          </div>

          {/* Section 5 — Category legend list */}
          <div className="space-y-2.5 mt-3">
            {categories.slice(0, 5).map((cat, index) => {
              const color = RING_COLORS[index % RING_COLORS.length];
              return (
                <div
                  key={cat.category}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-gray-600">{cat.category}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    {Math.round(cat.percentage)}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
