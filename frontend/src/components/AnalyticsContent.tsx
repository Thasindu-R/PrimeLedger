import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { Hash, TrendingDown, PiggyBank } from 'lucide-react';
import { formatCurrency, formatChartAxis } from '../utils/formatCurrency';
import type { MonthlyPoint } from '../utils/timeSeries';
import type { ChartTooltipProps } from './chartTooltip';
import type { CategoryBreakdown } from '../hooks/useTransactions';
import type { Summary } from '../types';

/**
 * Every figure here describes the whole ledger, so every figure is computed by
 * the server and passed in.
 *
 * <p>This component used to reduce over a `transactions` array, which was the
 * entire ledger held in memory. Once the list became a page, those same
 * reductions kept working and started lying: the count became the page size and
 * the highest expense became the largest row that happened to be on screen.
 */
interface AnalyticsContentProps {
  summary: Summary;
  /** Transactions in the ledger, not on the page. */
  transactionCount: number;
  highestExpense: number;
  /** The currency every figure here is expressed in (F-05). */
  reportingCurrency?: string;
  /** Transactions with no exchange rate, and so missing from the totals. */
  unconvertedCount?: number;
  monthlySeries: MonthlyPoint[];
  expenseByCategory: CategoryBreakdown[];
  incomeByCategory: CategoryBreakdown[];
}

const getNetBarColor = (value: number) => (value >= 0 ? '#22c55e' : '#ef4444');

function CategoryTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      <p style={{ color: payload[0].color }}>
        {formatCurrency(payload[0].value ?? 0)}
      </p>
    </div>
  );
}

function NetSavingsTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      <p style={{ color: payload[0].fill }}>
        Net: {formatCurrency(payload[0].value ?? 0)}
      </p>
    </div>
  );
}

export function AnalyticsContent({
  summary,
  transactionCount,
  highestExpense,
  reportingCurrency,
  unconvertedCount = 0,
  monthlySeries,
  expenseByCategory,
  incomeByCategory,
}: AnalyticsContentProps) {
  const savingsRate = useMemo(() => {
    if (summary.totalIncome === 0) return 'N/A';
    const rate =
      ((summary.totalIncome - summary.totalExpense) / summary.totalIncome) *
      100;
    return rate.toFixed(1) + '%';
  }, [summary.totalIncome, summary.totalExpense]);

  // Bucketed by YYYY-MM by the server, so the same month in two different years
  // does not collapse into one bar (D-02) — and so the chart covers the ledger
  // rather than the page.
  const monthlyNetData = monthlySeries;

  return (
    <div className="space-y-4">
      {/* An understated total looks exactly like a correct one, so the only
          honest thing to do is say which rows are not in it (F-05). Shown only
          when it has happened — a banner that is always there is one nobody
          reads on the day it matters. */}
      {unconvertedCount > 0 && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <span className="font-medium">
            {unconvertedCount} transaction{unconvertedCount === 1 ? ' is' : 's are'} missing
            from these totals.
          </span>{' '}
          No exchange rate has been published for
          {unconvertedCount === 1 ? ' its' : ' their'} currency
          {reportingCurrency ? `, so it could not be converted to ${reportingCurrency}` : ''}.
          The amounts are stored correctly and appear in the transaction list.
        </div>
      )}

      {/* Section 1 - Summary Stat Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Total Transactions */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Hash size={18} className="text-green-500" />
            <span className="text-sm text-gray-400 font-medium">
              Total Transactions
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {transactionCount}
          </p>
        </div>

        {/* Highest Expense */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={18} className="text-red-500" />
            <span className="text-sm text-gray-400 font-medium">
              Highest Expense
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(highestExpense)}
          </p>
        </div>

        {/* Savings Rate */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank size={18} className="text-blue-500" />
            <span className="text-sm text-gray-400 font-medium">
              Savings Rate
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{savingsRate}</p>
        </div>
      </div>

      {/* Section 2 - Side by Side Category Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income by Category */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">
            Income by Category
          </h3>
          <ResponsiveContainer
            width="100%"
            height={Math.max(180, incomeByCategory.length * 52)}
          >
            <BarChart
              data={incomeByCategory}
              layout="vertical"
              margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                width={80}
                axisLine={false}
                tickLine={false}
              />
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f3f4f6"
                horizontal={true}
                vertical={false}
              />
              <Tooltip content={<CategoryTooltip />} />
              <Bar dataKey="total" fill="#22c55e" radius={[0, 6, 6, 0]}>
                <LabelList
                  dataKey="total"
                  position="right"
                  formatter={(v: unknown) => formatCurrency(Number(v ?? 0))}
                  style={{ fontSize: 11, fill: '#6b7280' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses by Category */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-4">
            Expenses by Category
          </h3>
          <ResponsiveContainer
            width="100%"
            height={Math.max(180, expenseByCategory.length * 52)}
          >
            <BarChart
              data={expenseByCategory}
              layout="vertical"
              margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                width={80}
                axisLine={false}
                tickLine={false}
              />
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f3f4f6"
                horizontal={true}
                vertical={false}
              />
              <Tooltip content={<CategoryTooltip />} />
              <Bar dataKey="total" fill="#ef4444" radius={[0, 6, 6, 0]}>
                <LabelList
                  dataKey="total"
                  position="right"
                  formatter={(v: unknown) => formatCurrency(Number(v ?? 0))}
                  style={{ fontSize: 11, fill: '#6b7280' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section 3 - Monthly Net Savings */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-800">
            Monthly Net Savings
          </h3>
          <p className="text-sm text-gray-400">
            Income minus expenses per month
          </p>
        </div>
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyNetData}
              margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
            >
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatChartAxis}
              />
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f3f4f6"
                vertical={false}
              />
              <Tooltip content={<NetSavingsTooltip />} />
              <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                {monthlyNetData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getNetBarColor(entry.net)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
