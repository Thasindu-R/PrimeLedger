export type TransactionType = 'income' | 'expense';

export type IncomeCategory = 'Salary' | 'Freelance' | 'Investment' | 'Gift' | 'Other';

export type ExpenseCategory = |'Food'
                              |'Transport'
                              |'Shopping'
                              |'Utilities'
                              |'Entertainment'
                              |'Health'
                              |'Education'
                              |'Other';

export type Category = IncomeCategory | ExpenseCategory;

export interface Transaction {
  id: string;
  type: TransactionType;
  category: Category;
  amount: number;
  date: string;
  description?: string;
}

export interface Summary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}