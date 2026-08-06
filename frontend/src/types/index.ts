export type TransactionType = 'income' | 'expense';

/**
 * The category lists are the single source of truth and the union types are
 * derived from them, so a category can never exist in the type system while
 * being unreachable in the form (D-01). Phase 2 moves these into the database
 * (FR-17), at which point the derivation moves with them.
 */
export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investment',
  'Gift',
  'Other',
] as const;

export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Utilities',
  'Entertainment',
  'Health',
  'Education',
  'Other',
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type Category = IncomeCategory | ExpenseCategory;

export function categoriesFor(type: TransactionType): readonly Category[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function defaultCategoryFor(type: TransactionType): Category {
  return categoriesFor(type)[0];
}

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
