import { SettingsContent } from '../../components/SettingsContent';
import { useCurrencies } from '../../hooks/useCurrencies';
import { useLedger } from '../ledgerContext';

export function SettingsPage() {
  const {
    userName,
    onUserNameChange,
    baseCurrency,
    onBaseCurrencyChange,
    clearAll,
    ledgerCount,
    fetchAllTransactions,
    isClearing,
  } = useLedger();

  // Fetched here rather than in SettingsContent so that component stays
  // presentational — everything it renders arrives as a prop, which is what
  // lets it be tested without a query client.
  const { currencies } = useCurrencies();

  return (
    <SettingsContent
      userName={userName}
      onUserNameChange={onUserNameChange}
      baseCurrency={baseCurrency}
      currencies={currencies}
      onBaseCurrencyChange={onBaseCurrencyChange}
      onClearAll={clearAll}
      transactionCount={ledgerCount}
      fetchAllTransactions={fetchAllTransactions}
      isClearing={isClearing}
    />
  );
}
