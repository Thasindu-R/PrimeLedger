import { useState, useMemo } from "react";
import { useTransactions } from "./hooks/useTransactions";
import { TopNavBar } from "./components/TopNavBar";
import { PageHeader } from "./components/PageHeader";
import { BalanceCard } from "./components/BalanceCard";
import { StatCard } from "./components/StatCard";
import {
  StatisticsChart,
  type MonthlyDataPoint,
} from "./components/StatisticsChart";
import { AllExpensesPanel } from "./components/AllExpensesPanel";
import { AllIncomePanel } from "./components/AllIncomePanel";
import { PromoBanner } from "./components/PromoBanner";
import { TransactionList } from "./components/TransactionList";
import {
  TransactionForm,
  AddTransactionButton,
} from "./components/TransactionForm";
import { AnalyticsContent } from "./components/AnalyticsContent";
import { TransactionsContent } from "./components/TransactionsContent";
import { SettingsContent } from "./components/SettingsContent";
import { Toast, useToast } from "./components/Toast";
import { TrendingUp, TrendingDown } from "lucide-react";

interface OverviewContentProps {
  summary: { balance: number; totalIncome: number; totalExpense: number };
  expenseByCategory: any;
  incomeByCategory: any;
  monthlyChartData: MonthlyDataPoint[];
  sortedTransactions: any[];
  deleteTransaction: (id: string) => void;
  updateFilters: (filters: any) => void;
  resetFilters: () => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

function OverviewContent({
  summary,
  expenseByCategory,
  incomeByCategory,
  monthlyChartData,
  sortedTransactions,
  deleteTransaction,
  updateFilters,
  resetFilters,
  showToast,
}: OverviewContentProps) {
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
              changePercent={6.7}
              totalIncome={summary.totalIncome}
              totalExpense={summary.totalExpense}
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
        <div className="space-y-4 lg:pt-0">
          <AllIncomePanel
            daily={summary.totalIncome / 30}
            weekly={summary.totalIncome / 4}
            monthly={summary.totalIncome}
            categories={incomeByCategory}
          />
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
            onCtaClick={() => showToast("This feature is coming soon!", "info")}
          />
        </div>
      </div>

      {/* Transaction List */}
      <TransactionList
        transactions={sortedTransactions}
        onDelete={deleteTransaction}
        onSearchChange={(term) => updateFilters({ search: term })}
        onTypeFilter={(type) =>
          type ? updateFilters({ type }) : resetFilters()
        }
        onSortChange={(val) => console.log("sort:", val)}
      />
    </>
  );
}

interface TabContentProps {
  activeTab: string;
  summary: { balance: number; totalIncome: number; totalExpense: number };
  expenseByCategory: any;
  incomeByCategory: any;
  monthlyChartData: MonthlyDataPoint[];
  sortedTransactions: any[];
  deleteTransaction: (id: string) => void;
  updateFilters: (filters: any) => void;
  resetFilters: () => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  transactions: any[];
  filters: any;
  sort: any;
  updateSort: (field: any) => void;
  userName: string;
  onUserNameChange: (name: string) => void;
  onClearAll: () => void;
}

function TabContent({
  activeTab,
  summary,
  expenseByCategory,
  incomeByCategory,
  monthlyChartData,
  sortedTransactions,
  deleteTransaction,
  updateFilters,
  resetFilters,
  showToast,
  transactions,
  filters,
  sort,
  updateSort,
  userName,
  onUserNameChange,
  onClearAll,
}: TabContentProps) {
  if (activeTab === "Overview") {
    return (
      <OverviewContent
        summary={summary}
        expenseByCategory={expenseByCategory}
        incomeByCategory={incomeByCategory}
        monthlyChartData={monthlyChartData}
        sortedTransactions={sortedTransactions}
        deleteTransaction={deleteTransaction}
        updateFilters={updateFilters}
        resetFilters={resetFilters}
        showToast={showToast}
      />
    );
  }
  if (activeTab === "Analytics") {
    return (
      <AnalyticsContent
        transactions={transactions}
        summary={summary}
        expenseByCategory={expenseByCategory}
        incomeByCategory={incomeByCategory}
      />
    );
  }
  if (activeTab === "Transactions") {
    return (
      <TransactionsContent
        onDelete={deleteTransaction}
        updateFilters={updateFilters}
        resetFilters={resetFilters}
        filters={filters}
        sortedTransactions={sortedTransactions}
        sort={sort}
        updateSort={updateSort}
      />
    );
  }
  if (activeTab === "Settings") {
    return (
      <SettingsContent
        userName={userName}
        onUserNameChange={onUserNameChange}
        onClearAll={onClearAll}
        transactionCount={transactions.length}
      />
    );
  }
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [userName, setUserName] = useState("Thasindu");
  const { toasts, showToast, removeToast } = useToast();

  const {
    transactions,
    sortedTransactions,
    addTransaction,
    deleteTransaction,
    clearAll,
    summary,
    expenseByCategory,
    incomeByCategory,
    updateFilters,
    resetFilters,
    filters,
    sort,
    updateSort,
  } = useTransactions();

  const monthlyChartData: MonthlyDataPoint[] = useMemo(() => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return months.map((month, i) => {
      const monthTransactions = transactions.filter(
        (t) => new Date(t.date).getMonth() === i,
      );
      return {
        month,
        income: monthTransactions
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0),
        expense: monthTransactions
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [transactions]);

  const handleAddTransaction = (data: any) => {
    addTransaction(data);
    showToast("Transaction added!", "success");
  };

  const handleDeleteTransaction = (id: string) => {
    deleteTransaction(id);
    showToast("Transaction deleted.", "info");
  };

  const handleClearAll = () => {
    clearAll();
    showToast("All data cleared.", "error");
  };

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
  };

  const handleUserNameChange = (name: string) => {
    setUserName(name);
    showToast("Display name updated.", "success");
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNavBar
        userName={userName}
        userHandle="@thasindu"
        onNavigate={handleNavigate}
        recentTransactions={transactions.slice(0, 5)}
      />
      <PageHeader
        userName={userName}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        rightSlot={<AddTransactionButton onClick={() => setIsFormOpen(true)} />}
      />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 transition-all duration-200">
        <TabContent
          activeTab={activeTab}
          summary={summary}
          expenseByCategory={expenseByCategory}
          incomeByCategory={incomeByCategory}
          monthlyChartData={monthlyChartData}
          sortedTransactions={sortedTransactions}
          deleteTransaction={handleDeleteTransaction}
          updateFilters={updateFilters}
          resetFilters={resetFilters}
          showToast={showToast}
          transactions={transactions}
          filters={filters}
          sort={sort}
          updateSort={updateSort}
          userName={userName}
          onUserNameChange={handleUserNameChange}
          onClearAll={handleClearAll}
        />
      </div>

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onAdd={handleAddTransaction}
      />

      {/* Toast Notifications */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
