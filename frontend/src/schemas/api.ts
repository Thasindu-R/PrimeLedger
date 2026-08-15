import { z } from 'zod';

/**
 * The shapes the API actually sends, validated at the boundary.
 *
 * <p>Parsing rather than casting: `as TransactionResponse` is a promise the
 * compiler cannot keep, and a field the server renamed would surface as
 * `undefined` somewhere deep in a chart. These schemas are deliberately narrow —
 * they describe only what the client reads, so a new field on the server is not
 * a breaking change here.
 *
 * <p>Two properties of the wire format are load-bearing and easy to get wrong,
 * so they are stated once, here:
 *
 * <ul>
 *   <li><b>Enums are upper case.</b> The API sends `"EXPENSE"` and rejects
 *       `?type=expense` with a 400. The app's own vocabulary is lower case, and
 *       the translation happens in `api/transactions.ts` — in one place, not
 *       scattered.
 *   <li><b>Money is a string.</b> `NUMERIC(15,2)` does not survive a JavaScript
 *       double, so the server sends `"42.50"` (proposal §7.3).
 * </ul>
 */

export const wireTypeSchema = z.enum(['INCOME', 'EXPENSE']);
export type WireType = z.infer<typeof wireTypeSchema>;

export const transactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  // Nullable since V5. A transfer leg has no category, by construction: moving
  // your own money is not Groceries, not Salary and not "Other". Declaring these
  // as required strings was correct in Phase 4 and became a parse failure the
  // moment the ledger could contain a transfer — the whole list would have been
  // rejected over one row.
  categoryId: z.string().nullish(),
  categoryName: z.string().nullish(),
  type: wireTypeSchema,
  amount: z.string(),
  currency: z.string(),
  occurredOn: z.string(),
  // Absent rather than null when unset — Jackson omits it — so both are allowed.
  description: z.string().nullish(),
  // Jackson names this `transfer`, not `isTransfer`: @Schema(name = …) renames
  // the field in the generated docs and nowhere else.
  transfer: z.boolean().default(false),
  transferPairId: z.string().nullish(),
});
export type WireTransaction = z.infer<typeof transactionSchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    content: z.array(item),
    page: z.number(),
    size: z.number(),
    totalElements: z.number(),
    totalPages: z.number(),
    first: z.boolean(),
    last: z.boolean(),
  });
}

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: wireTypeSchema,
  colour: z.string().nullish(),
  system: z.boolean(),
  sortOrder: z.number(),
});
export type WireCategory = z.infer<typeof categorySchema>;

export const accountTypeSchema = z.enum([
  'CHECKING',
  'SAVINGS',
  'CASH',
  'CREDIT_CARD',
  'INVESTMENT',
]);
export type WireAccountType = z.infer<typeof accountTypeSchema>;

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: accountTypeSchema,
  currency: z.string(),
  openingBalance: z.string(),
  /** Opening balance plus every movement since, transfer legs included. */
  balance: z.string(),
  colour: z.string().nullish(),
  // `isArchived` in the docs, `archived` on the wire — see the note above.
  archived: z.boolean(),
  transactionCount: z.number(),
});
export type WireAccount = z.infer<typeof accountSchema>;

export const transferSchema = z.object({
  from: transactionSchema,
  to: transactionSchema,
});

export const budgetPeriodSchema = z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']);
export type WireBudgetPeriod = z.infer<typeof budgetPeriodSchema>;

export const budgetStatusSchema = z.enum(['OK', 'WARNING', 'EXCEEDED']);
export type WireBudgetStatus = z.infer<typeof budgetStatusSchema>;

export const budgetSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  categoryColour: z.string().nullish(),
  period: budgetPeriodSchema,
  limitAmount: z.string(),
  startsOn: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  spent: z.string(),
  /** Negative once the limit is exceeded. */
  remaining: z.string(),
  /** A number, not a money string: a percentage is not currency. Uncapped. */
  percentUsed: z.number(),
  status: budgetStatusSchema,
});
export type WireBudget = z.infer<typeof budgetSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  budgetId: z.string().nullish(),
  periodStart: z.string().nullish(),
  threshold: z.number().nullish(),
  read: z.boolean(),
  createdAt: z.string(),
});
export type WireNotification = z.infer<typeof notificationSchema>;

export const summarySchema = z.object({
  totals: z.object({
    income: z.string(),
    expense: z.string(),
    balance: z.string(),
    count: z.number(),
    highestExpense: z.string(),
  }),
  byCategory: z.array(
    z.object({
      categoryId: z.string(),
      categoryName: z.string(),
      type: wireTypeSchema,
      total: z.string(),
      count: z.number(),
    }),
  ),
  monthly: z.array(
    z.object({
      month: z.string(),
      income: z.string(),
      expense: z.string(),
    }),
  ),
});
export type WireSummary = z.infer<typeof summarySchema>;
