export type TransactionType = 'income' | 'expense';

/**
 * The original hard-coded category vocabulary.
 *
 * <p>These were the single source of truth in Phase 1: the union types were
 * derived from the lists, so a category could not exist in the type system while
 * being unreachable in the form (D-01). Phase 4 completes what FR-17 started —
 * categories are rows now, fetched from `/categories`, and the form is populated
 * from the server. A user-defined category has no literal type to belong to,
 * which is why {@link Transaction.category} is a plain string.
 *
 * <p>They are kept because the localStorage migration (FR-46) still has to read
 * data written against this vocabulary and match it to the seeded rows by name.
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
  /**
   * The category's display name. A string rather than the {@link Category}
   * union, because a user can define their own and the compiler cannot know
   * about it.
   */
  category: string;
  /** The row the name belongs to — what writes are addressed by. */
  categoryId: string;
  /**
   * Parsed from the decimal string the API sends. The exact value lives in
   * `NUMERIC(15,2)` on the server; this is the display copy, and no arithmetic
   * done here is ever written back as an amount.
   */
  amount: number;
  date: string;
  description?: string;
}

export interface Summary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}
