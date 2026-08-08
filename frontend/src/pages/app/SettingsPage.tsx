import { SettingsContent } from '../../components/SettingsContent';
import { useLedger } from '../ledgerContext';

export function SettingsPage() {
  const { userName, onUserNameChange, clearAll, transactions } = useLedger();

  return (
    <SettingsContent
      userName={userName}
      onUserNameChange={onUserNameChange}
      onClearAll={clearAll}
      transactions={transactions}
    />
  );
}
