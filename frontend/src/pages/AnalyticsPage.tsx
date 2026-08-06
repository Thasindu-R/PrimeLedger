import { AnalyticsContent } from '../components/AnalyticsContent';
import { useLedger } from './ledgerContext';

export function AnalyticsPage() {
  const { transactions, summary, expenseByCategory, incomeByCategory } = useLedger();

  return (
    <AnalyticsContent
      transactions={transactions}
      summary={summary}
      expenseByCategory={expenseByCategory}
      incomeByCategory={incomeByCategory}
    />
  );
}
