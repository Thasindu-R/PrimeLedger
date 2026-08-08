import { TrendingUp, TrendingDown } from 'lucide-react';
import { BalanceCard } from '../../components/BalanceCard';
import { StatCard } from '../../components/StatCard';
import { StatisticsChart } from '../../components/StatisticsChart';
import { AllExpensesPanel } from '../../components/AllExpensesPanel';
import { AllIncomePanel } from '../../components/AllIncomePanel';
import { PromoBanner } from '../../components/PromoBanner';
import { TransactionList } from '../../components/TransactionList';
import { useLedger } from '../ledgerContext';

export function OverviewPage() {
  const {
    summary,
    deltas,
    transactions,
    monthlySeries,
    averageMonthly,
    sortedTransactions,
    sort,
    setSort,
    requestDelete,
    requestEdit,
    updateFilters,
    resetFilters,
    showToast,
  } = useLedger();

  return (
    <>
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
      <TransactionList
        transactions={sortedTransactions}
        onDelete={requestDelete}
        onEdit={requestEdit}
        onSearchChange={(term) => updateFilters({ search: term })}
        onTypeFilter={(type) => (type ? updateFilters({ type }) : resetFilters())}
        onSortChange={setSort}
        sort={sort}
      />
    </>
  );
}
