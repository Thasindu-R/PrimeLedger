import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { CategoryOption } from '../api/categories';
import type { Account } from '../types';
import { createTransaction } from '../api/transactions';
import { queryKeys } from '../lib/queryClient';
import {
  discardLegacyTransactions,
  prepareMigration,
  rememberMigrationAnswer,
  type LegacyTransaction,
} from '../lib/localMigration';

interface LocalDataMigrationProps {
  legacy: LegacyTransaction[];
  categories: CategoryOption[];
  account: Account | undefined;
  onDone: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Offers to upload transactions left in this browser by the pre-server version
 * of the app (FR-46).
 *
 * <p>An offer, not an automatic import. The rows may be test data, may belong to
 * whoever used this browser before, and the person signing in is the only one
 * who can say. Nothing is deleted locally until the upload has succeeded.
 */
export function LocalDataMigration({
  legacy,
  categories,
  account,
  onDone,
  showToast,
}: LocalDataMigrationProps) {
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const { ready, unmatched } = prepareMigration(legacy, categories);

  const dismiss = () => {
    rememberMigrationAnswer();
    onDone();
  };

  const upload = async () => {
    if (!account) return;
    setBusy(true);

    let uploaded = 0;
    let failed = 0;

    // Sequential rather than Promise.all: this is a one-off of at most a few
    // hundred rows, and firing them all at once is how a free-tier container
    // gets rate-limited halfway through and leaves a half-migrated ledger.
    for (const input of ready) {
      try {
        await createTransaction(input, {
          accountId: account.id,
          currency: account.currency,
        });
        uploaded += 1;
      } catch {
        failed += 1;
      }
    }

    setBusy(false);
    rememberMigrationAnswer();

    if (failed === 0) {
      // Only once everything landed. Clearing after a partial upload would
      // destroy the only copy of the rows that did not make it.
      discardLegacyTransactions();
      showToast(`Uploaded ${uploaded} transaction${uploaded === 1 ? '' : 's'}.`, 'success');
    } else {
      showToast(
        `Uploaded ${uploaded}, but ${failed} could not be saved. Your local copy has been kept.`,
        'error',
      );
    }

    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    onDone();
  };

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">
          {legacy.length} transaction{legacy.length === 1 ? '' : 's'} found in this browser
        </p>
        <p className="text-sm text-gray-600 mt-0.5">
          They were saved before you had an account. Upload them to your ledger?
          {unmatched.length > 0 && (
            <>
              {' '}
              <span className="text-gray-500">
                {unmatched.length} categor{unmatched.length === 1 ? 'y' : 'ies'} (
                {unmatched.join(', ')}) no longer exist, so{' '}
                {legacy.length - ready.length} row
                {legacy.length - ready.length === 1 ? '' : 's'} will be left behind.
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void upload()}
          disabled={busy || !account || ready.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload size={15} />
          {busy ? `Uploading ${ready.length}…` : `Upload ${ready.length}`}
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          aria-label="Dismiss"
          className="rounded-xl p-2.5 text-gray-400 transition-colors hover:bg-white hover:text-gray-600 disabled:opacity-50"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
