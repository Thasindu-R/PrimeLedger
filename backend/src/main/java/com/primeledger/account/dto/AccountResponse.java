package com.primeledger.account.dto;

import com.primeledger.account.AccountType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * An account as it goes over the wire.
 *
 * <p>{@code openingBalance} is a string for the same reason a transaction's
 * amount is: {@code NUMERIC(15,2)} does not survive a JavaScript double
 * (proposal §7.3).
 */
@Schema(name = "Account")
public record AccountResponse(
        UUID id,
        @Schema(example = "Everyday") String name,
        AccountType type,
        @Schema(example = "USD") String currency,
        @Schema(type = "string", example = "0.00") String openingBalance,
        /**
         * Opening balance plus every movement since — the answer to "how much is
         * in this account?", which F-01 names as the first question a user asks.
         *
         * <p>Transfer legs are included here and excluded from the income and
         * expense totals in the analytics summary. Both are correct: moving your
         * own money changes what an account holds without being earning or
         * spending.
         */
        @Schema(type = "string", example = "1240.75") String balance,
        @Schema(example = "#4F46E5") String colour,
        @Schema(name = "isArchived") boolean archived,
        @Schema(description = "How many live transactions reference this account")
                long transactionCount,
        Instant createdAt,
        Instant updatedAt) {}
