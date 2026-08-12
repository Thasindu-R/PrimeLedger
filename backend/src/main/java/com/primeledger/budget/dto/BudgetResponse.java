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
 */
@Schema(name = "Budget")
public record BudgetResponse(
        UUID id,
        UUID categoryId,
        @Schema(example = "Groceries") String categoryName,
        @Schema(example = "#F97316") String categoryColour,
        BudgetPeriod period,
        @Schema(type = "string", example = "1000.00") String limitAmount,
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
        BudgetStatus status) {}
