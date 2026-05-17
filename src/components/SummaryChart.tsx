import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import type { Summary } from '../types';
import type { CategoryBreakdown } from '../hooks/useTransactions';
import { formatCurrency } from '../utils/formatCurrency';

interface SummaryChartProps {
  summary: Summary;
  expenseByCategory: CategoryBreakdown[];
}

const PIE_COLORS = [
  '#6366f1', '#f59e0b', '#ef4444', '#10b981',
  '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6',
];

interface TPayload {
  name: string;
  value: number;
  payload: { category?: string; total?: number };
}

function BarTip({ active, payload }: { active?: boolean; payload?: TPayload[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
      {payload.map((e, i) => <p key={i}>{e.name}: {formatCurrency(e.value)}</p>)}
    </div>
  );
}

function PieTip({ active, payload }: { active?: boolean; payload?: TPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
      <p className="font-semibold">{d.payload.category}</p>
      <p>{formatCurrency(d.payload.total ?? d.value)}</p>
    </div>
  );
}

export default function SummaryChart({ summary, expenseByCategory }: SummaryChartProps): React.ReactElement {
  const barData = [{ name: 'Overview', Income: summary.totalIncome, Expense: summary.totalExpense }];
  const hasData = summary.totalIncome > 0 || summary.totalExpense > 0;
  const hasPie = expenseByCategory.length > 0;

  if (!hasData && !hasPie) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center min-h-[300px] text-gray-400">
        <BarChart3 className="w-12 h-12 mb-3 text-gray-300" />
        <p className="text-sm font-medium">No data to display</p>
        <p className="text-xs mt-1">Add transactions to see your charts</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Financial Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Income vs Expense</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barGap={8}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={60} />
              <RechartsTooltip content={<BarTip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="Income" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={60} />
              <Bar dataKey="Expense" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Expense Breakdown</h3>
          {hasPie ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="total" nameKey="category" cx="50%" cy="45%" outerRadius={70} innerRadius={35} paddingAngle={3} strokeWidth={0}>
                  {expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip content={<PieTip />} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#6b7280' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">No expense data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
