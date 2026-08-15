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
   *
   * <p>Empty for a transfer leg, which has no category at all. Read
   * {@link isTransfer} rather than testing this for emptiness.
   */
  category: string;
  /** The row the name belongs to — what writes are addressed by. Absent on a transfer leg. */
  categoryId?: string;
  /** The account it was filed under. */
  accountId: string;
  /**
   * One half of a transfer between the user's own accounts.
   *
   * <p>Such a row is a real expense on one account and a real income on
   * another, so it belongs in the ledger and in that account's balance — but it
   * is neither earning nor spending, and the analytics summary excludes it. The
   * list has to be able to say so, otherwise the two disagree on screen.
   */
  isTransfer: boolean;
  /** The other leg, so deleting or opening one can reach it. */
  transferPairId?: string;
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

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'CREDIT_CARD' | 'INVESTMENT';

/** How each account type is written for a human. */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Checking',
  SAVINGS: 'Savings',
  CASH: 'Cash',
  CREDIT_CARD: 'Credit card',
  INVESTMENT: 'Investment',
};

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: number;
  /** Opening balance plus every movement since. */
  balance: number;
  colour?: string;
  isArchived: boolean;
  /** How many live transactions reference it — what makes deletion safe or not. */
  transactionCount: number;
}

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

export type BudgetStatus = 'OK' | 'WARNING' | 'EXCEEDED';

export interface Budget {
  id: string;
  categoryId: string;
  category: string;
  categoryColour?: string;
  period: BudgetPeriod;
  limit: number;
  startsOn: string;
  /** The window every figure below describes — not all time. */
  periodStart: string;
  periodEnd: string;
  spent: number;
  /** Negative once the limit is exceeded. */
  remaining: number;
  /** Uncapped: "340% of your dining budget" is the fact the user needs. */
  percentUsed: number;
  status: BudgetStatus;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  budgetId?: string;
  periodStart?: string;
  threshold?: number;
  isRead: boolean;
  createdAt: string;
}
