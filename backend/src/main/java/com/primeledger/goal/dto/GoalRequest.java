package com.primeledger.goal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Create and update payload for a savings goal (F-04).
 *
 * @param accountId the account whose balance is the progress. Its currency is
 *     the goal's currency; there is no separate field, because a target in
 *     dollars against an account held in rupees would compare two different
 *     numbers and call the result progress.
 * @param targetDate optional. Without one the goal still projects — it answers
 *     "when will I get there" instead of "will I get there in time".
 */
@Schema(name = "GoalRequest")
public record GoalRequest(
        @NotBlank @Size(max = 100) @Schema(example = "Emergency fund") String name,
        @NotNull UUID accountId,
        @NotNull
                @Positive
                @Digits(integer = 13, fraction = 2)
                @DecimalMax(value = "9999999999999.99")
                @Schema(type = "string", example = "500000.00")
                BigDecimal targetAmount,
        @Schema(example = "2027-12-31") LocalDate targetDate) {}
