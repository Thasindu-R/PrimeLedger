import { useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useTransactions } from './hooks/useTransactions';
import { useAccounts } from './hooks/useAccounts';
import { useNotifications } from './hooks/useNotifications';
import { LocalDataMigration } from './components/LocalDataMigration';
import { hasAnsweredMigration, readLegacyTransactions } from './lib/localMigration';
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
import { AccountsPage } from './pages/app/AccountsPage';
import { BudgetsPage } from './pages/app/BudgetsPage';
import { SettingsPage } from './pages/app/SettingsPage';
import { RequireAnonymous, RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/authContext';
import { SignInPage } from './pages/auth/SignInPage';
import { SignUpPage } from './pages/auth/SignUpPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import type { LedgerContext } from './pages/ledgerContext';
import type { Transaction } from './types';
import type { TransactionInput } from './api/transactions';

function AppShell() {
  const [editing, setEditing] = useState<Transaction | undefined>(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Bumped on every open so the form remounts with fresh state instead of
  // resetting itself from an effect.
  const [formSession, setFormSession] = useState(0);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { toasts, showToast, removeToast } = useToast();
  const { displayName, setDisplayName, handle } = useProfile();
  const { signOut } = useAuth();

  // No navigate() afterwards: clearing the session makes RequireAuth redirect,
  // so doing both would be a redirect racing a redirect.
  const handleSignOut = () => {
    void signOut();
  };

  /**
   * Which account the app is scoped to, or undefined for all of them.
   *
   * <p>Shell state rather than a URL parameter or localStorage: it is a view the
   * user is holding right now, not a preference. Persisting it would mean
   * someone who once looked at "Savings" opens the app tomorrow to a ledger
   * missing most of their money, with no obvious reason why.
   */
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();

  const accounts = useAccounts({ showToast });
  const notifications = useNotifications();

  const selectedAccount = useMemo(
    () => accounts.accounts.find((account) => account.id === selectedAccountId),
    [accounts.accounts, selectedAccountId],
  );

  // An account can stop existing while it is selected — archived from the
  // accounts page, or deleted. Falling back to all accounts is the only honest
  // answer; staying scoped to something that is gone shows an empty ledger and
  // blames the user's data for it.
  const effectiveAccountId =
    selectedAccountId !== undefined && selectedAccount === undefined
      ? undefined
      : selectedAccountId;

  const ledger = useTransactions({ showToast, selectedAccount });
  const {
    transactions,
    categories,
    account,
    addTransaction,
    editTransaction,
    deleteTransaction,
    clearAll,
    summary,
    deltas,
    monthlySeries,
    averageMonthly,
    expenseByCategory,
    incomeByCategory,
    updateFilters,
    resetFilters,
    filters,
    sort,
    setSort,
    updateSort,
    canWrite,
  } = ledger;

  // Read once, on mount: the offer is about data that was already there, and it
  // must not reappear every time a query refetches.
  const [legacy, setLegacy] = useState(() =>
    hasAnsweredMigration() ? [] : readLegacyTransactions(),
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

  // The toast now follows the server's answer rather than the click, so it is
  // raised by the mutation in useTransactions — saying "Transaction added!"
  // before the request has been accepted is how a failed write looks like a
  // successful one.
  const handleSubmit = (data: TransactionInput) => {
    if (editing) {
      editTransaction(editing.id, data);
    } else {
      addTransaction(data);
    }
    setEditing(undefined);
  };

  const pendingTransaction = transactions.find((t) => t.id === pendingDeleteId);

  const handleConfirmDelete = () => {
    if (pendingDeleteId) {
      deleteTransaction(pendingDeleteId);
    }
    setPendingDeleteId(null);
  };

  // The settings page confirms this with its own dialog before calling through.
  const handleClearAll = () => {
    clearAll();
  };

  const handleUserNameChange = (name: string) => {
    setDisplayName(name);
    showToast('Display name updated.', 'success');
  };

  const context: LedgerContext = {
    transactions,
    categories,
    accounts: {
      all: accounts.accounts,
      active: accounts.activeAccounts,
      includeArchived: accounts.includeArchived,
      setIncludeArchived: accounts.setIncludeArchived,
      isLoading: accounts.isLoading,
      error: accounts.error,
      refetch: accounts.refetch,
      isMutating: accounts.isMutating,
      add: accounts.addAccount,
      edit: accounts.editAccount,
      setArchived: accounts.setArchived,
      remove: accounts.deleteAccount,
      transfer: accounts.transferBetween,
    },
    summary,
    ledgerCount: ledger.ledgerCount,
    highestExpense: ledger.highestExpense,
    deltas,
    monthlySeries,
    averageMonthly,
    incomeByCategory,
    expenseByCategory,

    isLoading: ledger.isLoading,
    isFetching: ledger.isFetching,
    error: ledger.error,
    refetch: ledger.refetch,
    analyticsLoading: ledger.analyticsLoading,
    analyticsError: ledger.analyticsError,
    refetchAnalytics: ledger.refetchAnalytics,

    page: ledger.page,
    setPage: ledger.setPage,
    pageSize: ledger.pageSize,
    totalPages: ledger.totalPages,
    totalElements: ledger.totalElements,

    filters,
    updateFilters,
    resetFilters,
    sort,
    setSort,
    updateSort,
    fetchAllMatching: ledger.fetchAllMatching,
    fetchAllTransactions: ledger.fetchAllTransactions,
    requestDelete: setPendingDeleteId,
    requestEdit,
    clearAll: handleClearAll,
    isClearing: ledger.isMutating,
    userName: displayName,
    onUserNameChange: handleUserNameChange,
    showToast,
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNavBar
        userName={displayName}
        userHandle={handle}
        accounts={accounts.activeAccounts}
        selectedAccountId={effectiveAccountId}
        onSelectAccount={setSelectedAccountId}
        notifications={notifications.notifications}
        unreadCount={notifications.unreadCount}
        notificationsLoading={notifications.isLoading}
        onMarkNotificationRead={notifications.markRead}
        onMarkAllNotificationsRead={notifications.markAllRead}
        onSignOut={handleSignOut}
      />
      <PageHeader
        userName={displayName}
        rightSlot={<AddTransactionButton onClick={openAddForm} />}
      />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 transition-all duration-200">
        {legacy.length > 0 && (
          <LocalDataMigration
            legacy={legacy}
            categories={categories}
            account={account}
            onDone={() => setLegacy([])}
            showToast={showToast}
          />
        )}

        {/* A fault in one page must not blank the shell around it (FR-43). */}
        <ErrorBoundary>
          <Outlet context={context} />
        </ErrorBoundary>
      </main>

      <TransactionForm
        key={formSession}
        isOpen={isFormOpen}
        transaction={editing}
        categories={categories}
        canSubmit={canWrite}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(undefined);
        }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title={
          pendingTransaction?.isTransfer ? 'Delete this transfer?' : 'Delete this transaction?'
        }
        message={
          pendingTransaction?.isTransfer
            ? // Both legs go, because the server deletes them together. Money
              // that left one account and arrived nowhere is the one state a
              // ledger must not reach, so this is a warning, not an option.
              'Both sides of the transfer are removed — the money leaving one account and arriving in the other.'
            : `"${pendingTransaction?.description || pendingTransaction?.category || 'This transaction'}" will be removed from your ledger.`
        }
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
      {/* Anonymous-only: someone already signed in is sent to their ledger. */}
      <Route element={<RequireAnonymous />}>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Reached from an emailed link, which carries its own session, so these
          sit outside both guards. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
