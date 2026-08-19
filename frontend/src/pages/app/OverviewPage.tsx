import { TrendingUp, TrendingDown } from 'lucide-react';
import { BalanceCard } from '../../components/BalanceCard';
import { StatCard } from '../../components/StatCard';
import { StatisticsChart } from '../../components/StatisticsChart';
import { AllExpensesPanel } from '../../components/AllExpensesPanel';
import { AllIncomePanel } from '../../components/AllIncomePanel';
import { PromoBanner } from '../../components/PromoBanner';
import { InsightsPanel } from '../../components/InsightsPanel';
import { TransactionList } from '../../components/TransactionList';
import { SkeletonCards, SkeletonChart, SkeletonList } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { useInsights } from '../../hooks/useInsights';
import { useLedger } from '../ledgerContext';

export function OverviewPage() {
  const {
    summary,
    deltas,
    transactions,
    monthlySeries,
    averageMonthly,
    sort,
    setSort,
    requestDelete,
    requestEdit,
    updateFilters,
    resetFilters,
    showToast,
    isLoading,
    error,
    refetch,
    analyticsLoading,
    analyticsError,
    refetchAnalytics,
    totalElements,
  } = useLedger();

  // Its own query, so a rules engine that fails takes only the panel with it and
  // not the balance, the charts and the breakdowns.
  const { insights, isLoading: insightsLoading } = useInsights();

  // The totals and the list load independently, so a failure in one leaves the
  // other on screen rather than blanking the dashboard (FR-42).
  if (analyticsError) {
    return (
      <ErrorState
        error={analyticsError}
        onRetry={refetchAnalytics}
        subject="your dashboard"
      />
    );
  }

  if (analyticsLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCards count={3} />
        <SkeletonChart />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <InsightsPanel insights={insights} isLoading={insightsLoading} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <BalanceCard
              balance={summary.balance}
              changePercent={deltas.balance}
              totalIncome={summary.totalIncome}
              totalExpense={summary.totalExpense}
            />
            <StatCard
              label="Monthly income"
              amount={summary.totalIncome}
              changePercent={deltas.income}
              variant="income"
              icon={<TrendingUp size={20} />}
            />
            <StatCard
              label="Monthly expenses"
              amount={summary.totalExpense}
              changePercent={deltas.expense}
              variant="expense"
              icon={<TrendingDown size={20} />}
            />
          </div>

          {/* Statistics Chart */}
          <StatisticsChart
            data={monthlySeries}
            avgIncome={averageMonthly.income}
            avgExpense={averageMonthly.expense}
            avgIncomeChange={deltas.income}
            avgExpenseChange={deltas.expense}
          />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <AllIncomePanel transactions={transactions} />
          <AllExpensesPanel transactions={transactions} />
          <PromoBanner
            headline="Secure Your Future with Smart Budgeting"
            subtitle="Track every rupee. Build better habits. Reach your goals faster."
            ctaLabel="Learn more"
            onCtaClick={() => showToast('This feature is coming soon!', 'info')}
          />
        </div>
      </div>

      {/* Transaction List */}
      {isLoading ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <SkeletonList rows={5} />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} subject="your transactions" />
      ) : totalElements === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
          <EmptyState
            title="Your ledger is empty"
            hint="Add your first transaction with the button above and your balance, charts and history will fill in."
          />
        </div>
      ) : (
        <TransactionList
          transactions={transactions}
          onDelete={requestDelete}
          onEdit={requestEdit}
          onSearchChange={(term) => updateFilters({ search: term })}
          onTypeFilter={(type) => (type ? updateFilters({ type }) : resetFilters())}
          onSortChange={setSort}
          sort={sort}
        />
      )}
    </>
  );
}
