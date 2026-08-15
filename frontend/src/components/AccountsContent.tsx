import { useState } from 'react';
import {
  ArrowLeftRight,
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { AccountForm } from './AccountForm';
import { TransferForm } from './TransferForm';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './ui/EmptyState';
import { ErrorState } from './ui/ErrorState';
import { SkeletonList } from './ui/Skeleton';
import { formatCurrency } from '../utils/formatCurrency';
import { ACCOUNT_TYPE_LABELS, type Account } from '../types';
import type { AccountInput } from '../api/accounts';
import type { TransferInput } from '../api/transfers';

interface AccountsContentProps {
  accounts: Account[];
  activeAccounts: Account[];
  includeArchived: boolean;
  onIncludeArchivedChange: (include: boolean) => void;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  isMutating: boolean;
  onCreate: (input: AccountInput) => void;
  onEdit: (id: string, input: AccountInput) => void;
  onSetArchived: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
  onTransfer: (input: TransferInput) => void;
}

export function AccountsContent({
  accounts,
  activeAccounts,
  includeArchived,
  onIncludeArchivedChange,
  isLoading,
  error,
  onRetry,
  isMutating,
  onCreate,
  onEdit,
  onSetArchived,
  onDelete,
  onTransfer,
}: AccountsContentProps) {
  const [editing, setEditing] = useState<Account | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  // Bumped on every open so the form remounts with fresh state.
  const [formSession, setFormSession] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Account | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setFormSession((n) => n + 1);
    setIsFormOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setFormSession((n) => n + 1);
    setIsFormOpen(true);
  };

  const openTransfer = () => {
    setFormSession((n) => n + 1);
    setIsTransferOpen(true);
  };

  const currencies = new Set(accounts.map((account) => account.currency));
  const total = accounts
    .filter((account) => !account.isArchived)
    .reduce((sum, account) => sum + account.balance, 0);

  if (error) {
    return <ErrorState error={error} subject="your accounts" onRetry={onRetry} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Accounts</h1>
          {/* Only when it means something. Adding a dollar balance to a rupee
              balance produces a number that is not money in any currency. */}
          {currencies.size === 1 && accounts.length > 0 && (
            <p className="text-sm text-gray-500">
              {formatCurrency(total, [...currencies][0])} across{' '}
              {activeAccounts.length} open account
              {activeAccounts.length === 1 ? '' : 's'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-500">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => onIncludeArchivedChange(event.target.checked)}
              className="rounded border-gray-300"
            />
            Show archived
          </label>

          <button
            type="button"
            onClick={openTransfer}
            disabled={activeAccounts.length < 2}
            title={
              activeAccounts.length < 2
                ? 'You need two open accounts to move money between them'
                : undefined
            }
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <ArrowLeftRight size={15} />
            Transfer
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <Plus size={15} />
            New account
          </button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          hint="Add the accounts you actually hold money in, and every transaction can be filed where it really happened."
        />
      ) : (
        <ul className="space-y-2">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              isBusy={isMutating}
              onEdit={() => openEdit(account)}
              onToggleArchive={() => onSetArchived(account.id, !account.isArchived)}
              onDelete={() => setPendingDelete(account)}
            />
          ))}
        </ul>
      )}

      <AccountForm
        key={`account-${formSession}`}
        isOpen={isFormOpen}
        account={editing}
        defaultCurrency={accounts[0]?.currency ?? 'LKR'}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(undefined);
        }}
        onSubmit={(input) => {
          if (editing) onEdit(editing.id, input);
          else onCreate(input);
        }}
      />

      <TransferForm
        key={`transfer-${formSession}`}
        isOpen={isTransferOpen}
        accounts={activeAccounts}
        onClose={() => setIsTransferOpen(false)}
        onSubmit={onTransfer}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== undefined}
        title={`Delete ${pendingDelete?.name ?? 'this account'}?`}
        message="The account is removed for good. Only possible while it holds no transactions — archive it instead to close it and keep its history."
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(undefined);
        }}
        onCancel={() => setPendingDelete(undefined)}
      />
    </div>
  );
}

function AccountRow({
  account,
  isBusy,
  onEdit,
  onToggleArchive,
  onDelete,
}: {
  account: Account;
  isBusy: boolean;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const isEmpty = account.transactionCount === 0;

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 ${
        account.isArchived ? 'opacity-60' : ''
      }`}
    >
      <span
        className="h-8 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: account.colour || '#D1D5DB' }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-gray-800">{account.name}</span>
          {account.isArchived && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
              Archived
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency} ·{' '}
          {account.transactionCount} transaction
          {account.transactionCount === 1 ? '' : 's'}
        </p>
      </div>

      <span
        className={`shrink-0 text-sm font-semibold ${
          account.balance < 0 ? 'text-red-500' : 'text-gray-800'
        }`}
      >
        {formatCurrency(account.balance, account.currency)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <IconButton label={`Edit ${account.name}`} onClick={onEdit} disabled={isBusy}>
          <Pencil size={15} />
        </IconButton>

        <IconButton
          label={
            account.isArchived ? `Reopen ${account.name}` : `Archive ${account.name}`
          }
          onClick={onToggleArchive}
          disabled={isBusy}
        >
          {account.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
        </IconButton>

        {/* Offered only while it would succeed. An account with history cannot
            be deleted — that is what archiving is for — so a live button here
            would exist purely to produce a 422. */}
        {isEmpty && (
          <IconButton
            label={`Delete ${account.name}`}
            onClick={onDelete}
            disabled={isBusy}
            danger
          >
            <Trash2 size={15} />
          </IconButton>
        )}
      </div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-2 transition-colors disabled:opacity-40 ${
        danger
          ? 'text-gray-400 hover:bg-red-50 hover:text-red-600'
          : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
      }`}
    >
      {children}
    </button>
  );
}
