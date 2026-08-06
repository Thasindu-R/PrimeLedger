import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import type { Transaction } from "../types";
import { formatCurrency } from "../utils/formatCurrency";
import { addDays, toIsoDate } from "../utils/dates";

const RING_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#fb923c",
  "#a855f7",
  "#eab308",
  "#14b8a6",
  "#ef4444",
];

type Period = "daily" | "weekly" | "monthly";

interface AllIncomePanelProps {
  transactions: Transaction[];
}

/** Inclusive lower bound for each period, as a `YYYY-MM-DD` string. */
function startOf(period: Period, now: Date): string {
  if (period === "daily") return toIsoDate(now);
  if (period === "weekly") return toIsoDate(addDays(now, -6));
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

/**
 * The income counterpart to AllExpensesPanel. It was written, exported and then
 * never rendered (D-06); it now takes the same `transactions` prop as its
 * sibling so the period tabs actually scope the figures below them.
 */
export function AllIncomePanel({ transactions }: AllIncomePanelProps) {
  const [activePeriod, setActivePeriod] = useState<Period>("monthly");
  const now = useMemo(() => new Date(), []);
  const todayIso = toIsoDate(now);

  const income = useMemo(
    () => transactions.filter((t) => t.type === "income"),
    [transactions],
  );

  const totals = useMemo(() => {
    const sumSince = (period: Period) => {
      const from = startOf(period, now);
      return income
        .filter((t) => t.date >= from && t.date <= todayIso)
        .reduce((sum, t) => sum + t.amount, 0);
    };
    return {
      daily: sumSince("daily"),
      weekly: sumSince("weekly"),
      monthly: sumSince("monthly"),
    };
  }, [income, now, todayIso]);

  const categories = useMemo(() => {
    const from = startOf(activePeriod, now);
    const inPeriod = income.filter((t) => t.date >= from && t.date <= todayIso);
    const grandTotal = inPeriod.reduce((sum, t) => sum + t.amount, 0);
    const map = new Map<string, { total: number; count: number }>();

    for (const t of inPeriod) {
      const entry = map.get(t.category) ?? { total: 0, count: 0 };
      entry.total += t.amount;
      entry.count += 1;
      map.set(t.category, entry);
    }

    return Array.from(map.entries())
      .map(([category, { total, count }]) => ({
        category,
        total,
        count,
        percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [income, activePeriod, now, todayIso]);

  const largestCategory = categories[0];

  const periods: { key: Period; label: string; value: number }[] = [
    { key: "daily", label: "Daily", value: totals.daily },
    { key: "weekly", label: "Weekly", value: totals.weekly },
    { key: "monthly", label: "Monthly", value: totals.monthly },
  ];

  return (
    <div className="w-full bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      {/* Section 1 - Card Header */}
      <h2 className="text-base font-semibold text-gray-800 mb-3">All income</h2>

      {/* Section 2 - Period Tab Bar */}
      <div className="grid grid-cols-3 gap-1 bg-gray-50 rounded-xl p-1 mb-3">
        {periods.map((period) => (
          <button
            key={period.key}
            type="button"
            onClick={() => setActivePeriod(period.key)}
            aria-pressed={activePeriod === period.key}
            className={`${
              activePeriod === period.key
                ? "bg-white rounded-lg shadow-sm text-gray-800"
                : "text-gray-400 hover:text-gray-600"
            } py-1.5 px-2 sm:px-3 w-full text-center transition-all`}
          >
            <div className="text-xs font-medium">{period.label}</div>
            <div
              className={`text-sm font-bold ${
                activePeriod === period.key ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {formatCurrency(period.value)}
            </div>
          </button>
        ))}
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-44 text-gray-300">
          <PieChartIcon size={32} strokeWidth={1.5} />
          <p className="text-sm mt-2 font-medium">No income for this period</p>
          <p className="text-xs mt-1">Try selecting a different period</p>
        </div>
      ) : (
        <>
          {/* Section 3 - Donut chart */}
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
                  formatter={(value: unknown, name: unknown) => [
                    `${Math.round(Number(value ?? 0))}%`,
                    String(name ?? ''),
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #f3f4f6",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Label Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-400">{largestCategory.category}</span>
              <span className="text-sm font-bold text-gray-800">
                {formatCurrency(largestCategory.total)}
              </span>
            </div>
          </div>

          {/* Section 4 - Category Legend List */}
          <div className="space-y-2 mt-3">
            {categories.slice(0, 5).map((category, index) => (
              <div
                key={category.category}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: RING_COLORS[index % RING_COLORS.length],
                    }}
                  />
                  <span className="text-sm text-gray-600">{category.category}</span>
                </div>
                <span className="text-sm font-semibold text-gray-800">
                  {Math.round(category.percentage)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
