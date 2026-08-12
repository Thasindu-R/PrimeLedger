import { SettingsContent } from '../../components/SettingsContent';
import { useLedger } from '../ledgerContext';

export function SettingsPage() {
  const {
    userName,
    onUserNameChange,
    clearAll,
    ledgerCount,
    fetchAllTransactions,
    isClearing,
  } = useLedger();

  return (
    <SettingsContent
      userName={userName}
      onUserNameChange={onUserNameChange}
      onClearAll={clearAll}
      transactionCount={ledgerCount}
      fetchAllTransactions={fetchAllTransactions}
      isClearing={isClearing}
    />
  );
}
