package com.primeledger.transaction.dto;

import com.primeledger.transaction.TransactionType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A transaction as it goes over the wire.
 *
 * <p>{@code amount} is a string, not a number: {@code NUMERIC(15,2)} does not
 * survive a round trip through a JavaScript double, and the frontend parses it
 * deliberately (proposal §7.3).
 */
@Schema(name = "Transaction")
public record TransactionResponse(
        UUID id,
        UUID accountId,
        UUID categoryId,
        @Schema(example = "Groceries") String categoryName,
        TransactionType type,
        @Schema(type = "string", example = "42.50") String amount,
        @Schema(example = "USD") String currency,
        @Schema(example = "2026-08-09") LocalDate occurredOn,
        String description,
        @Schema(name = "isTransfer") boolean transfer,
        UUID transferPairId,
        UUID recurringRuleId,
        @Schema(description = "Set when the row is soft-deleted; null otherwise")
                Instant deletedAt,
        Instant createdAt,
        Instant updatedAt) {}
