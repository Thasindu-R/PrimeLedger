import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

const RING_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#fb923c",
  "#a855f7",
  "#eab308",
  "#14b8a6",
  "#ef4444",
];

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

interface AllIncomePanelProps {
  daily: number;
  weekly: number;
  monthly: number;
  categories: CategoryBreakdown[];
}

export function AllIncomePanel({
  daily,
  weekly,
  monthly,
  categories,
}: AllIncomePanelProps) {
  const [activePeriod, setActivePeriod] = useState<
    "daily" | "weekly" | "monthly"
  >("monthly");

  const displayCategories = categories;
  const largestCategory = displayCategories[0];

  if (displayCategories.length === 0) {
    return (
      <div className="w-full bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          All income
        </h2>
        <div className="flex flex-col items-center justify-center h-48 text-gray-300">
          <PieChartIcon size={32} />
          <p className="text-sm mt-2">No income data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      {/* Section 1 - Card Header */}
      <h2 className="text-base font-semibold text-gray-800 mb-4">All income</h2>

      {/* Section 2 - Period Tab Bar */}
      <div className="grid grid-cols-3 gap-1 bg-gray-50 rounded-xl p-1 mb-6">
        {[
          { key: "daily" as const, label: "Daily", value: daily },
          { key: "weekly" as const, label: "Weekly", value: weekly },
          { key: "monthly" as const, label: "Monthly", value: monthly },
        ].map((period) => (
          <button
            key={period.key}
            onClick={() => setActivePeriod(period.key)}
            className={`$
              activePeriod === period.key
                ? 'bg-white rounded-lg shadow-sm text-gray-800'
                : 'text-gray-400 hover:text-gray-600'
            } py-2 px-2 sm:px-3 w-full text-center transition-all`}
          >
            <div className="text-xs font-medium">{period.label}</div>
            <div
              className={`text-sm font-bold ${
                activePeriod === period.key ? "text-gray-900" : "text-gray-400"
              }`}
            >
              ${period.value.toLocaleString()}
            </div>
          </button>
        ))}
      </div>

      {/* Section 3 - Concentric Ring Chart */}
      <div className="relative">
        <div className="h-52 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {displayCategories.map((category, index) => {
                const innerRadius = 45 + index * 18;
                const outerRadius = 57 + index * 18;
                const startAngle = 90;
                const endAngle = 90 - (category.percentage / 100) * 360;
                const color = RING_COLORS[index % RING_COLORS.length];

                return (
                  <Pie
                    key={category.category}
                    data={[
                      { value: category.percentage },
                      { value: 100 - category.percentage },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={color} />
                    <Cell fill="#f3f4f6" />
                  </Pie>
                );
              })}
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Center Label Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xs text-gray-400 text-center">
            {largestCategory.category}
          </div>
          <div className="text-sm font-bold text-gray-800 text-center">
            ${largestCategory.total.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Section 4 - Category Legend List */}
      <div className="space-y-3 mt-4">
        {displayCategories.slice(0, 5).map((category, index) => {
          const color = RING_COLORS[index % RING_COLORS.length];
          const percentage = Math.round(category.percentage);

          return (
            <div
              key={category.category}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                ></div>
                <span className="text-sm text-gray-600">
                  {category.category}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
