import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Wallet } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency';
import type { Account } from '../types';

interface AccountSelectorProps {
  accounts: Account[];
  /** Undefined means every account, which is what the app opens on. */
  selectedId?: string;
  onSelect: (accountId: string | undefined) => void;
}

/**
 * Which ledger the app is showing (F-01).
 *
 * <p>"All accounts" is a real option and the default, not a placeholder for
 * having failed to choose. Someone with a current account and a savings account
 * mostly wants to know what they have in total; scoping to one is the narrower
 * question, and the narrower question should be the one you opt into.
 */
export function AccountSelector({ accounts, selectedId, onSelect }: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = accounts.find((account) => account.id === selectedId);
  const label = selected?.name ?? 'All accounts';

  // Only meaningful when every account is in the same currency. Mixed holdings
  // cannot be added up without a conversion rate, which is F-05, so the total is
  // withheld rather than guessed at.
  const currencies = new Set(accounts.map((account) => account.currency));
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  const showTotal = currencies.size === 1;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Account: ${label}`}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors"
      >
        <Wallet size={14} className="text-gray-400" />
        <span className="text-sm text-gray-700 font-medium max-w-[10rem] truncate">
          {label}
        </span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-11 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white py-2 shadow-lg"
        >
          <Option
            label="All accounts"
            detail={
              showTotal && accounts.length > 0
                ? formatCurrency(total)
                : `${accounts.length} account${accounts.length === 1 ? '' : 's'}`
            }
            isSelected={selectedId === undefined}
            onClick={() => {
              onSelect(undefined);
              setIsOpen(false);
            }}
          />

          {accounts.length > 0 && <div className="my-1 border-t border-gray-100" />}

          {accounts.map((account) => (
            <Option
              key={account.id}
              label={account.name}
              detail={formatCurrency(account.balance, account.currency)}
              colour={account.colour}
              isSelected={account.id === selectedId}
              onClick={() => {
                onSelect(account.id);
                setIsOpen(false);
              }}
            />
          ))}

          {accounts.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">No accounts yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Option({
  label,
  detail,
  colour,
  isSelected,
  onClick,
}: {
  label: string;
  detail: string;
  colour?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: colour || '#D1D5DB' }}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{label}</span>
      <span className="shrink-0 text-xs text-gray-400">{detail}</span>
      {isSelected && <Check size={14} className="shrink-0 text-green-600" />}
    </button>
  );
}
