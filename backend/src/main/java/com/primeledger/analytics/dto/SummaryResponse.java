package com.primeledger.analytics.dto;

import com.primeledger.transaction.TransactionType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

/**
 * The aggregates the dashboard needs, computed over every row the filter
 * matches (proposal §11.3).
 *
 * <p>These used to be derived in the browser from the full transaction array.
 * Once the list is paginated server-side the client holds one page, so summing
 * what it has would quietly report the totals of the current page as the totals
 * of the ledger. They are computed here instead, where all the rows are.
 *
 * <p>Every money field is a decimal string, as everywhere else (§7.3).
 *
 * @param totals income, expense and their difference
 * @param byCategory one entry per category that has activity, largest first
 * @param monthly one entry per {@code YYYY-MM} that has activity, oldest first;
 *     months with no rows are absent rather than zero, and the client fills the
 *     window it wants to display
 */
@Schema(name = "AnalyticsSummary")
public record SummaryResponse(
        Totals totals, List<CategoryTotal> byCategory, List<MonthlyTotal> monthly) {

    /**
     * @param count how many transactions the filter matched — not how many are
     *     on the current page
     * @param highestExpense the largest single expense, or "0.00" when there are
     *     none
     * @param currency the base currency every figure above is expressed in
     *     (F-05). Amounts are converted at the rate that applied on each
     *     transaction's own date, so a past month reports the same number today
     *     as it did when it ended.
     * @param unconverted how many of {@code count} had no exchange rate
     *     available and are therefore <em>missing</em> from the totals. Normally
     *     zero. Anything else means the figures are understated and the client
     *     should say so rather than present them as complete.
     */
    @Schema(name = "AnalyticsTotals")
    public record Totals(
            @Schema(type = "string", example = "4200.00") String income,
            @Schema(type = "string", example = "1875.50") String expense,
            @Schema(type = "string", example = "2324.50") String balance,
            @Schema(example = "384") long count,
            @Schema(type = "string", example = "899.00") String highestExpense,
            @Schema(example = "LKR") String currency,
            @Schema(example = "0") long unconverted) {}

    @Schema(name = "AnalyticsCategoryTotal")
    public record CategoryTotal(
            UUID categoryId,
            @Schema(example = "Groceries") String categoryName,
            TransactionType type,
            @Schema(type = "string", example = "312.75") String total,
            @Schema(example = "9") long count) {}

    @Schema(name = "AnalyticsMonthlyTotal")
    public record MonthlyTotal(
            @Schema(example = "2026-08", description = "Calendar month, YYYY-MM") String month,
            @Schema(type = "string", example = "4200.00") String income,
            @Schema(type = "string", example = "1875.50") String expense) {}
}
