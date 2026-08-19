package com.primeledger.recurring.dto;

import com.primeledger.recurring.Frequency;
import com.primeledger.transaction.TransactionType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Create and update payload for a recurring rule (F-03).
 *
 * <p>No currency: a rule pays into one account and takes that account's
 * currency, exactly as a transaction does. Letting the client name one would
 * make it possible to create a rule that generates rupee transactions into a
 * dollar account, which nothing downstream could interpret.
 *
 * @param startsOn the first occurrence. Allowed to be in the past — that is how
 *     a user records a standing order that began in March — in which case the
 *     first sweep materialises every occurrence since.
 * @param endsOn optional. Null means "until I say otherwise".
 * @param paused optional on create (defaults to running), meaningful on update.
 */
@Schema(name = "RecurringRuleRequest")
public record RecurringRuleRequest(
        @NotBlank @Size(max = 100) @Schema(example = "Rent") String name,
        @NotNull UUID accountId,
        @NotNull UUID categoryId,
        @NotNull TransactionType type,
        @NotNull
                @Positive
                @Digits(integer = 13, fraction = 2)
                @DecimalMax(value = "9999999999999.99")
                @Schema(type = "string", example = "1500.00")
                BigDecimal amount,
        @Size(max = 500) String description,
        @NotNull Frequency frequency,
        @Min(1)
                @Max(365)
                @Schema(
                        example = "1",
                        description = "Units of `frequency` between occurrences; 2 + weekly is a fortnight")
                Integer interval,
        @NotNull @Schema(example = "2026-09-01") LocalDate startsOn,
        @Schema(example = "2027-09-01", description = "Last date an occurrence may fall on")
                LocalDate endsOn,
        Boolean paused) {

    /** The wire default, applied here rather than repeated at every call site. */
    public int intervalOrDefault() {
        return interval == null ? 1 : interval;
    }
}
