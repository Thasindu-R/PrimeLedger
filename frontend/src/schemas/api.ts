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
  /** What the limit and the spend are both in (V8). */
  currency: z.string(),
  startsOn: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  spent: z.string(),
  /** Negative once the limit is exceeded. */
  remaining: z.string(),
  /** A number, not a money string: a percentage is not currency. Uncapped. */
  percentUsed: z.number(),
  status: budgetStatusSchema,
  /**
   * Matching transactions with no exchange rate, and so missing from `spent`.
   * Non-zero means the position is understated — the budget may be over
   * without appearing so.
   */
  unconverted: z.number().default(0),
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

export const frequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
export type WireFrequency = z.infer<typeof frequencySchema>;

export const recurringRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountId: z.string(),
  accountName: z.string().nullish(),
  categoryId: z.string(),
  categoryName: z.string(),
  categoryColour: z.string().nullish(),
  type: wireTypeSchema,
  amount: z.string(),
  currency: z.string(),
  description: z.string().nullish(),
  frequency: frequencySchema,
  interval: z.number(),
  startsOn: z.string(),
  /** Null once the rule is finished — there is no next occurrence. */
  nextRunOn: z.string().nullish(),
  endsOn: z.string().nullish(),
  paused: z.boolean(),
  finished: z.boolean(),
  lastRunOn: z.string().nullish(),
  generatedCount: z.number(),
});
export type WireRecurringRule = z.infer<typeof recurringRuleSchema>;

export const goalSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountId: z.string(),
  accountName: z.string().nullish(),
  accountColour: z.string().nullish(),
  currency: z.string().nullish(),
  targetAmount: z.string(),
  targetDate: z.string().nullish(),
  currentAmount: z.string(),
  remaining: z.string(),
  /** A percentage, so a number rather than a money string. Uncapped. */
  progressPercent: z.number(),
  achieved: z.boolean(),
  requiredMonthly: z.string().nullish(),
  monthlyRate: z.string(),
  projectedCompletion: z.string().nullish(),
  /** Three-valued: true, false, or absent when there is no target date. */
  onTrack: z.boolean().nullish(),
  contributionFrom: z.string(),
  contributionTo: z.string(),
});
export type WireGoal = z.infer<typeof goalSchema>;

export const currencySchema = z.object({
  code: z.string(),
  name: z.string(),
  /** Null for a currency the provider does not quote — still selectable. */
  rate: z.string().nullish(),
  asOf: z.string().nullish(),
});
export type WireCurrency = z.infer<typeof currencySchema>;

export const profileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullish(),
  baseCurrency: z.string(),
  locale: z.string(),
  theme: z.string(),
  dateFormat: z.string(),
});
export type WireProfile = z.infer<typeof profileSchema>;

export const summarySchema = z.object({
  totals: z.object({
    income: z.string(),
    expense: z.string(),
    balance: z.string(),
    count: z.number(),
    highestExpense: z.string(),
    /**
     * The base currency the three amounts above are expressed in, and how many
     * of `count` had no exchange rate and are therefore *missing* from them
     * (F-05). Defaulted rather than required so a client running against a
     * pre-Phase-6 API still parses.
     */
    currency: z.string().nullish(),
    unconverted: z.number().default(0),
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
