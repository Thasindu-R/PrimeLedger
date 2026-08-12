package com.primeledger.transaction.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Move money between two of the caller's own accounts (F-01).
 *
 * <p>No category: a transfer has none, by construction. No type either — the
 * direction is the pair of accounts, and the service writes the expense leg and
 * the income leg from it.
 */
@Schema(name = "TransferRequest")
public record TransferRequest(
        @NotNull UUID fromAccountId,
        @NotNull UUID toAccountId,
        @NotNull
                @Positive
                @Digits(integer = 13, fraction = 2)
                @DecimalMax(value = "9999999999999.99")
                @Schema(
                        type = "string",
                        example = "250.00",
                        description = "Exact decimal. Sent as a string to avoid float coercion.")
                BigDecimal amount,
        @NotNull @Schema(example = "2026-08-09") LocalDate occurredOn,
        @Size(max = 500) String description) {}
