package com.primeledger.budget.dto;

import com.primeledger.budget.BudgetPeriod;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
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
 * @param currency optional; defaults to the caller's base currency, which is
 *     what they are already reading every other total in. Immutable once set —
 *     an update that names a different one is refused rather than silently
 *     re-denominating a limit that has already been reported against.
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
                LocalDate startsOn,
        @Pattern(
                        regexp = "^[A-Z]{3}$",
                        message = "must be a three-letter ISO 4217 code, upper case")
                @Schema(example = "LKR", description = "Defaults to your base currency")
                String currency) {}
