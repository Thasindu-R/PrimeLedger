package com.primeledger.transaction.dto;

import com.primeledger.transaction.TransactionType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Create and update payload for a transaction.
 *
 * <p>{@code occurredOn} carries the server-side half of D-09: the frontend
 * bounds the date input, and this rejects a year-3000 date that arrives by any
 * other route (proposal §2.3).
 */
@Schema(name = "TransactionRequest")
public record TransactionRequest(
        @NotNull UUID accountId,
        @NotNull UUID categoryId,
        @NotNull TransactionType type,
        @NotNull
                @Positive
                @Digits(integer = 13, fraction = 2)
                @DecimalMax(value = "9999999999999.99")
                @Schema(
                        type = "string",
                        example = "42.50",
                        description = "Exact decimal. Sent as a string to avoid float coercion.")
                BigDecimal amount,
        @NotNull
                @Pattern(regexp = "^[A-Z]{3}$", message = "must be a three-letter ISO 4217 code")
                @Schema(example = "USD")
                String currency,
        @NotNull @Schema(example = "2026-08-09") LocalDate occurredOn,
        @Size(max = 500) String description) {}
