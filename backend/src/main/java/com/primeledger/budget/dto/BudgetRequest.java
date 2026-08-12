package com.primeledger.budget.dto;

import com.primeledger.budget.BudgetPeriod;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Create and update payload for a budget (F-02).
 *
 * @param startsOn optional; defaults to the start of the period containing
 *     today. Must be the first day of a period of the given length, so a
 *     "monthly" budget cannot start on the 17th and reset on the 17th of every
 *     month while claiming to be monthly.
 */
@Schema(name = "BudgetRequest")
public record BudgetRequest(
        @NotNull UUID categoryId,
        @NotNull BudgetPeriod period,
        @NotNull
                @Positive
                @Digits(integer = 13, fraction = 2)
                @DecimalMax(value = "9999999999999.99")
                @Schema(type = "string", example = "1000.00")
                BigDecimal limitAmount,
        @Schema(example = "2026-08-01", description = "First day of the period this limit applies from")
                LocalDate startsOn) {}
