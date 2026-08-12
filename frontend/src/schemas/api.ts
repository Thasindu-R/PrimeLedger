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
  categoryId: z.string(),
  categoryName: z.string(),
  type: wireTypeSchema,
  amount: z.string(),
  currency: z.string(),
  occurredOn: z.string(),
  // Absent rather than null when unset — Jackson omits it — so both are allowed.
  description: z.string().nullish(),
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

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency: z.string(),
});
export type WireAccount = z.infer<typeof accountSchema>;

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
