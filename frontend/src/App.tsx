import { useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useTransactions } from './hooks/useTransactions';
import { useProfile } from './hooks/useProfile';
import { TopNavBar } from './components/TopNavBar';
import { PageHeader } from './components/PageHeader';
import { TransactionForm, AddTransactionButton } from './components/TransactionForm';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';
import { OverviewPage } from './pages/app/OverviewPage';
import { AnalyticsPage } from './pages/app/AnalyticsPage';
import { TransactionsPage } from './pages/app/TransactionsPage';
import { SettingsPage } from './pages/app/SettingsPage';
import type { LedgerContext } from './pages/ledgerContext';
import { buildMonthlySeries } from './utils/timeSeries';
import { averagePerActiveMonth, computePeriodDeltas } from './utils/periodComparison';
import type { Transaction } from './types';

function AppShell() {
  const [editing, setEditing] = useState<Transaction | undefined>(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Bumped on every open so the form remounts with fresh state instead of
  // resetting itself from an effect.
  const [formSession, setFormSession] = useState(0);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { toasts, showToast, removeToast } = useToast();
  const { displayName, setDisplayName, handle } = useProfile();

  const {
    transactions,
    sortedTransactions,
    addTransaction,
    editTransaction,
    deleteTransaction,
    clearAll,
    summary,
    expenseByCategory,
    incomeByCategory,
    updateFilters,
    resetFilters,
    filters,
    sort,
    setSort,
    updateSort,
    recentTransactions,
  } = useTransactions();

  // Bucketed by YYYY-MM over an explicit 12-month window (D-02).
  const monthlySeries = useMemo(
    () => buildMonthlySeries(transactions, { months: 12 }),
    [transactions],
  );

  // Real month-over-month change, replacing the hard-coded literals (D-05).
  const deltas = useMemo(() => computePeriodDeltas(transactions), [transactions]);

  const averageMonthly = useMemo(
    () => averagePerActiveMonth(monthlySeries),
    [monthlySeries],
  );

  const openAddForm = () => {
    setEditing(undefined);
    setFormSession((n) => n + 1);
    setIsFormOpen(true);
  };

  const requestEdit = (transaction: Transaction) => {
    setEditing(transaction);
    setFormSession((n) => n + 1);
    setIsFormOpen(true);
  };

  const handleSubmit = (data: Omit<Transaction, 'id'>) => {
    if (editing) {
      editTransaction(editing.id, data);
      showToast('Transaction updated.', 'success');
    } else {
      addTransaction(data);
      showToast('Transaction added!', 'success');
    }
    setEditing(undefined);
  };

  const pendingTransaction = transactions.find((t) => t.id === pendingDeleteId);

  const handleConfirmDelete = () => {
    if (pendingDeleteId) {
      deleteTransaction(pendingDeleteId);
      showToast('Transaction deleted.', 'info');
    }
    setPendingDeleteId(null);
  };

  // The settings page confirms this with its own dialog before calling through.
  const handleClearAll = () => {
    clearAll();
    showToast('All data cleared.', 'error');
  };

  const handleUserNameChange = (name: string) => {
    setDisplayName(name);
    showToast('Display name updated.', 'success');
  };

  const context: LedgerContext = {
    transactions,
    sortedTransactions,
    summary,
    deltas,
    monthlySeries,
    averageMonthly,
    incomeByCategory,
    expenseByCategory,
    filters,
    updateFilters,
    resetFilters,
    sort,
    setSort,
    updateSort,
    requestDelete: setPendingDeleteId,
    requestEdit,
    clearAll: handleClearAll,
    userName: displayName,
    onUserNameChange: handleUserNameChange,
    showToast,
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNavBar
        userName={displayName}
        userHandle={handle}
        recentTransactions={recentTransactions}
        onSignOut={() =>
          showToast('Accounts arrive in the next phase — nothing to sign out of yet.', 'info')
        }
      />
      <PageHeader
        userName={displayName}
        rightSlot={<AddTransactionButton onClick={openAddForm} />}
      />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 transition-all duration-200">
        {/* A fault in one page must not blank the shell around it (FR-43). */}
        <ErrorBoundary>
          <Outlet context={context} />
        </ErrorBoundary>
      </main>

      <TransactionForm
        key={formSession}
        isOpen={isFormOpen}
        transaction={editing}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(undefined);
        }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title="Delete this transaction?"
        message={`"${pendingTransaction?.description || pendingTransaction?.category || 'This transaction'}" will be removed from your ledger.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}
