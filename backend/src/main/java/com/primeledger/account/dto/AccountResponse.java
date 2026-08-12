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
        @Schema(example = "#4F46E5") String colour,
        @Schema(name = "isArchived") boolean archived,
        Instant createdAt,
        Instant updatedAt) {}
