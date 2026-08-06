import { useId, useState } from 'react';
import { User, Database, Download, Info, ExternalLink } from 'lucide-react';
import type { Transaction } from '../types';
import { downloadCsv, exportFilename, transactionsToCsv } from '../utils/csv';
import { ConfirmDialog } from './ConfirmDialog';

interface SettingsContentProps {
  userName: string;
  onUserNameChange: (name: string) => void;
  onClearAll: () => void;
  /** The live transactions. Reading storage here bypassed the state seam (D-03). */
  transactions: Transaction[];
}

export function SettingsContent({
  userName,
  onUserNameChange,
  onClearAll,
  transactions,
}: SettingsContentProps) {
  // `null` means "not edited yet", so the field follows the saved name until
  // the user types. Cheaper and more predictable than syncing via an effect.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const nameId = useId();
  const transactionCount = transactions.length;
  const inputName = draftName ?? userName;

  const handleSaveName = () => {
    onUserNameChange(inputName);
    setDraftName(null);
  };

  const handleExport = () => {
    downloadCsv(transactionsToCsv(transactions), exportFilename());
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

      {/* Card 2 - Data Management */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Data</h2>
        <p className="text-sm text-gray-400 mb-6">Manage your stored transaction data</p>

        <div className="space-y-4">
          {/* Info Row */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Database size={20} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {transactionCount} transactions stored locally in your browser
            </span>
          </div>

          {/* Export Row */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <Download size={20} className="text-gray-400" />
              <span className="text-sm text-gray-600">Export all data as CSV</span>
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Export
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
              className="w-full border border-red-200 text-red-600 hover:bg-red-50 font-medium py-2.5 rounded-xl transition-colors"
            >
              Clear all transactions
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
          href="https://github.com/Thasindu-R/finance-tracker"
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
