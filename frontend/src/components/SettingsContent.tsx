import { useId, useState } from 'react';
import { User, Database, Download, Info, ExternalLink, Globe } from 'lucide-react';
import type { Currency, Transaction } from '../types';
import { downloadCsv, exportFilename, transactionsToCsv } from '../utils/csv';
import { ConfirmDialog } from './ConfirmDialog';

interface SettingsContentProps {
  userName: string;
  onUserNameChange: (name: string) => void;
  /** The currency every reporting total is expressed in (F-05). */
  baseCurrency: string;
  /** Everything selectable, with today's rate where one has been published. */
  currencies: Currency[];
  onBaseCurrencyChange: (code: string) => void;
  onClearAll: () => void;
  /**
   * How many transactions the account holds, from the server. Counting a page
   * would have understated it — and understating the number on a "this will
   * permanently delete N transactions" dialog is the worst place to be wrong.
   */
  transactionCount: number;
  /** Fetches every row for the export. Reading storage here bypassed the seam (D-03). */
  fetchAllTransactions: () => Promise<Transaction[]>;
  isClearing: boolean;
}

export function SettingsContent({
  userName,
  onUserNameChange,
  baseCurrency,
  currencies,
  onBaseCurrencyChange,
  onClearAll,
  transactionCount,
  fetchAllTransactions,
  isClearing,
}: SettingsContentProps) {
  // `null` means "not edited yet", so the field follows the saved name until
  // the user types. Cheaper and more predictable than syncing via an effect.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const nameId = useId();
  const currencyId = useId();
  const inputName = draftName ?? userName;

  // The saved currency may not be in the provider's list — someone can hold an
  // account in a currency nobody quotes. Offering the list without it would
  // silently show the select as something else.
  const currencyOptions = currencies.some((currency) => currency.code === baseCurrency)
    ? currencies
    : [{ code: baseCurrency, name: baseCurrency }, ...currencies];

  const selected = currencies.find((currency) => currency.code === baseCurrency);

  const handleSaveName = () => {
    onUserNameChange(inputName);
    setDraftName(null);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      downloadCsv(transactionsToCsv(await fetchAllTransactions()), exportFilename());
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmClear = () => {
    setIsConfirmingClear(false);
    onClearAll();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Card 1 - Profile Settings */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Profile</h2>
        <p className="text-sm text-gray-400 mb-6">Update your display name</p>

        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <User size={40} className="text-gray-200" />
          </div>
          <span className="text-sm font-medium text-gray-600">{getInitials(inputName)}</span>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor={nameId} className="block text-sm font-medium text-gray-700 mb-2">
              Display name
            </label>
            <input
              id={nameId}
              type="text"
              value={inputName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-300 transition-colors"
              placeholder="Enter your name"
            />
          </div>
          <button
            onClick={handleSaveName}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Card 2 - Reporting currency (F-05) */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Reporting currency</h2>
        <p className="text-sm text-gray-400 mb-6">
          What your totals are added up in
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor={currencyId} className="block text-sm font-medium text-gray-700 mb-2">
              Currency
            </label>
            <select
              id={currencyId}
              value={baseCurrency}
              onChange={(event) => onBaseCurrencyChange(event.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-300 transition-colors"
            >
              {currencyOptions.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </select>
          </div>

          {/* The distinction this whole feature turns on, in one box. */}
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
            <Globe size={20} className="text-gray-400 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600">
              Each account keeps its own currency and every amount is stored
              exactly as it was spent. This only changes what the totals are
              converted to — at the rate that applied on each transaction's own
              date, so last year's figures do not move when today's rate does.
              {selected?.asOf && (
                <span className="block mt-1 text-xs text-gray-400">
                  Rates last published {selected.asOf}.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Card 3 - Data Management */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Data</h2>
        <p className="text-sm text-gray-400 mb-6">Manage your stored transaction data</p>

        <div className="space-y-4">
          {/* Info Row */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Database size={20} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {transactionCount} transactions in your account
            </span>
          </div>

          {/* Export Row */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <Download size={20} className="text-gray-400" />
              <span className="text-sm text-gray-600">Export all data as CSV</span>
            </div>
            <button
              onClick={() => void handleExport()}
              disabled={isExporting || transactionCount === 0}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? 'Preparing…' : 'Export'}
            </button>
          </div>

          {/* Danger Zone */}
          <div className="border-t border-red-50 mt-4 pt-4">
            <h3 className="text-sm font-medium text-red-600 mb-1">Clear all data</h3>
            <p className="text-xs text-gray-400 mb-3">
              This will permanently delete all your transactions
            </p>
            <button
              onClick={() => setIsConfirmingClear(true)}
              disabled={isClearing || transactionCount === 0}
              className="w-full border border-red-200 text-red-600 hover:bg-red-50 font-medium py-2.5 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearing ? 'Clearing…' : 'Clear all transactions'}
            </button>
          </div>
        </div>
      </div>

      {/* Card 3 - About */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">About</h2>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Info size={18} className="text-gray-400" />
            <span className="text-sm text-gray-600">PrimeLedger v1.0.0</span>
          </div>
          <div className="flex items-center gap-3">
            <Info size={18} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              Built with React, TypeScript, Tailwind CSS &amp; Recharts
            </span>
          </div>
        </div>

        <a
          href="https://github.com/Thasindu-R/PrimeLedger"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 mt-6 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <ExternalLink size={16} />
          <span>View source on GitHub</span>
        </a>
      </div>

      <ConfirmDialog
        isOpen={isConfirmingClear}
        title="Clear all transactions?"
        message={`This permanently deletes all ${transactionCount} transactions. This cannot be undone.`}
        confirmLabel="Clear all"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsConfirmingClear(false)}
      />
    </div>
  );
}
