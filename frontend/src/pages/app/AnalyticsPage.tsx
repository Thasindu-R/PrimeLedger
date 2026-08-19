import { AnalyticsContent } from '../../components/AnalyticsContent';
import { SkeletonCards, SkeletonChart } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { useLedger } from '../ledgerContext';

export function AnalyticsPage() {
  const {
    summary,
    ledgerCount,
    highestExpense,
    reportingCurrency,
    unconvertedCount,
    monthlySeries,
    expenseByCategory,
    incomeByCategory,
    analyticsLoading,
    analyticsError,
    refetchAnalytics,
  } = useLedger();

  if (analyticsError) {
    return (
      <ErrorState
        error={analyticsError}
        onRetry={refetchAnalytics}
        subject="your analytics"
      />
    );
  }

  if (analyticsLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCards count={3} />
        <SkeletonChart />
        <SkeletonChart className="h-64" />
      </div>
    );
  }

  // Every breakdown is empty only when there is nothing to break down — the
  // charts would otherwise render axes around no data (FR-45).
  if (incomeByCategory.length === 0 && expenseByCategory.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <EmptyState
          title="Nothing to analyse yet"
          hint="Once you have recorded a few transactions, your spending patterns will show up here."
        />
      </div>
    );
  }

  return (
    <AnalyticsContent
      summary={summary}
      transactionCount={ledgerCount}
      highestExpense={highestExpense}
      reportingCurrency={reportingCurrency}
      unconvertedCount={unconvertedCount}
      monthlySeries={monthlySeries}
      expenseByCategory={expenseByCategory}
      incomeByCategory={incomeByCategory}
    />
  );
}
