import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Calendar, TrendingUp } from "lucide-react";
import { formatCurrencyParts, formatCurrency } from "../utils/formatCurrency";

export interface MonthlyDataPoint {
  month: string;
  income: number;
  expense: number;
}

interface StatisticsChartProps {
  data: MonthlyDataPoint[];
  avgIncome: number;
  avgExpense: number;
  avgIncomeChange: number;
  avgExpenseChange: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function StatisticsChart({
  data,
  avgIncome,
  avgExpense,
  avgIncomeChange,
  avgExpenseChange,
}: StatisticsChartProps) {
  const avgIncomeFormatted = formatCurrencyParts(avgIncome);
  const avgExpenseFormatted = formatCurrencyParts(avgExpense);

  return (
    <div className="w-full bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      {/* Section 1 - Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        {/* Left side - Title and Legend */}
        <div>
          <h2 className="text-base font-semibold text-gray-800">Statistics</h2>
          <div className="flex flex-wrap items-center gap-4 mt-1">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-400">Total income</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-400"></div>
              <span className="text-xs text-gray-400">Total expenses</span>
            </div>
          </div>
        </div>

        {/* Right side - Period Selector */}
        <button className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:border-gray-300 cursor-pointer">
          <Calendar size={14} className="text-gray-400" />
          <span>Monthly</span>
        </button>
      </div>

      {/* Section 2 - Recharts AreaChart */}
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            syncId="stats"
          >
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb923c" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `Rs. ${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `Rs. ${(v / 1000).toFixed(0)}k`}
              hide={true}
            />
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f3f4f6"
              vertical={false}
            />
            <Tooltip content={<CustomTooltip />} />

            <Area
              yAxisId="left"
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="#22c55e"
              strokeWidth={2.5}
              fill="url(#incomeGradient)"
              dot={false}
              activeDot={{ r: 5, fill: "#22c55e", strokeWidth: 0 }}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="expense"
              name="Expenses"
              stroke="#fb923c"
              strokeWidth={2.5}
              fill="url(#expenseGradient)"
              dot={false}
              activeDot={{ r: 5, fill: "#fb923c", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Section 3 - Average Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
        {/* Average Income */}
        <div>
          <p className="text-xs text-gray-400 mb-1">Average income</p>
          <div>
            <span className="text-2xl font-bold text-gray-900">
              {avgIncomeFormatted.whole}
            </span>
            <span className="text-lg font-bold text-gray-400">
              {avgIncomeFormatted.decimal}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp size={12} className="text-green-500" />
            <span className="text-xs text-green-500">
              +{avgIncomeChange}% compare to last month
            </span>
          </div>
        </div>

        {/* Average Expenses */}
        <div>
          <p className="text-xs text-gray-400 mb-1">Average expenses</p>
          <div>
            <span className="text-2xl font-bold text-gray-900">
              {avgExpenseFormatted.whole}
            </span>
            <span className="text-lg font-bold text-gray-400">
              {avgExpenseFormatted.decimal}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp size={12} className="text-green-500" />
            <span className="text-xs text-green-500">
              +{avgExpenseChange}% compare to last month
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
