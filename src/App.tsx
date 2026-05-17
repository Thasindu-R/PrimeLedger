import { useState, useMemo } from 'react';
import { useTransactions } from './hooks/useTransactions';
import { TopNavBar } from './components/TopNavBar';
import { PageHeader } from './components/PageHeader';
import { BalanceCard } from './components/BalanceCard';
import { StatCard } from './components/StatCard';
import { StatisticsChart, type MonthlyDataPoint } from './components/StatisticsChart';
import { AllExpensesPanel } from './components/AllExpensesPanel';
import { PromoBanner } from './components/PromoBanner';
import { TransactionList } from './components/TransactionList';
import { TransactionForm, AddTransactionButton } from './components/TransactionForm';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const {
    transactions,
    sortedTransactions,
    addTransaction,
    deleteTransaction,
    summary,
    expenseByCategory,
    updateFilters,
    resetFilters,
  } = useTransactions();

  const monthlyChartData: MonthlyDataPoint[] = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, i) => {
      const monthTransactions = transactions.filter((t) => new Date(t.date).getMonth() === i);
      return {
        month,
        income: monthTransactions.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0),
        expense: monthTransactions.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [transactions]);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavBar userName="Thasindu" userHandle="@thasindu" />
      <PageHeader
        userName="Thasindu"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        rightSlot={<AddTransactionButton onClick={() => setIsFormOpen(true)} />}
      />

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-4">
        {/* Main Grid */}
        <div className="grid grid-cols-[1fr_320px] gap-4 items-start">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Cards Row */}
            <div className="grid grid-cols-3 gap-4">
              <BalanceCard
                balance={summary.balance}
                changePercent={6.7}
                cardNumber="6549 7329 9821 2472"
              />
              <StatCard
                label="Monthly income"
                amount={summary.totalIncome}
                changePercent={9.8}
                variant="income"
                icon={<TrendingUp size={20} />}
              />
              <StatCard
                label="Monthly expenses"
                amount={summary.totalExpense}
                changePercent={-8.6}
                variant="expense"
                icon={<TrendingDown size={20} />}
              />
            </div>

            {/* Statistics Chart */}
            <StatisticsChart
              data={monthlyChartData}
              avgIncome={summary.totalIncome}
              avgExpense={summary.totalExpense}
              avgIncomeChange={9.8}
              avgExpenseChange={8.7}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <AllExpensesPanel
              daily={summary.totalExpense / 30}
              weekly={summary.totalExpense / 4}
              monthly={summary.totalExpense}
              categories={expenseByCategory}
            />
            <PromoBanner
              headline="Secure Your Future with Smart Budgeting"
              subtitle="Track every rupee. Build better habits. Reach your financial goals faster."
              ctaLabel="Learn more"
            />
          </div>
        </div>

        {/* Transaction List */}
        <TransactionList
          transactions={sortedTransactions}
          onDelete={deleteTransaction}
          onSearchChange={(term) => updateFilters({ search: term })}
          onTypeFilter={(type) => (type ? updateFilters({ type }) : resetFilters())}
          onSortChange={(val) => console.log('sort:', val)}
        />
      </div>

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onAdd={addTransaction}
      />
    </div>
  );
}
