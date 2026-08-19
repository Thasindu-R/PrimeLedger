package com.primeledger.budget.dto;

import com.primeledger.budget.BudgetPeriod;
import com.primeledger.budget.BudgetStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A budget and where it currently stands (F-02).
 *
 * <p>{@code spent}, {@code remaining}, {@code percentUsed} and {@code status}
 * describe the period named by {@code periodStart}/{@code periodEnd}, not all
 * time — which is the whole point of a budget being period-scoped.
 *
 * <p>Every amount here is in {@code currency}. Spending recorded in another
 * currency is converted into it at the rate on each transaction's own date
 * (V8); anything that could not be converted is counted in {@code unconverted}
 * rather than dropped, because a budget that appears comfortably under when it
 * is not is worse than one that admits it does not know.
 */
@Schema(name = "Budget")
public record BudgetResponse(
        UUID id,
        UUID categoryId,
        @Schema(example = "Groceries") String categoryName,
        @Schema(example = "#F97316") String categoryColour,
        BudgetPeriod period,
        @Schema(type = "string", example = "1000.00") String limitAmount,
        @Schema(example = "LKR", description = "What the limit and the spend are both in")
                String currency,
        @Schema(description = "The date this limit took effect") LocalDate startsOn,
        @Schema(example = "2026-08-01") LocalDate periodStart,
        @Schema(example = "2026-08-31") LocalDate periodEnd,
        @Schema(type = "string", example = "812.40") String spent,
        @Schema(
                        type = "string",
                        example = "187.60",
                        description = "Negative once the limit is exceeded")
                String remaining,
        @Schema(example = "81.2", description = "Uncapped: can exceed 100")
                double percentUsed,
        BudgetStatus status,
        @Schema(
                        example = "0",
                        description =
                                "Matching transactions with no exchange rate, and so missing "
                                        + "from `spent`. Non-zero means this position is "
                                        + "understated.")
                long unconverted) {}
