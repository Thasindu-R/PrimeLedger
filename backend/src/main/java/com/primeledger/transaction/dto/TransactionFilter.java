package com.primeledger.transaction.dto;

import com.primeledger.transaction.TransactionType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Query parameters for {@code GET /transactions} — the server-side equivalent
 * of the frontend's {@code applyFilters} (proposal §8.1).
 *
 * <p>Every field is optional; an absent field is simply not a predicate.
 *
 * @param from inclusive lower bound on {@code occurredOn}
 * @param to inclusive upper bound on {@code occurredOn}
 * @param search case-insensitive substring of the description
 * @param includeDeleted show soft-deleted rows, for an undo affordance
 */
@Schema(name = "TransactionFilter")
public record TransactionFilter(
        @Schema(example = "2026-01-01") LocalDate from,
        @Schema(example = "2026-12-31") LocalDate to,
        TransactionType type,
        UUID categoryId,
        UUID accountId,
        @DecimalMin("0.00") BigDecimal minAmount,
        @DecimalMin("0.00") BigDecimal maxAmount,
        @Size(max = 200) String search,
        Boolean includeDeleted) {

    /**
     * Boxed, then defaulted here rather than declared {@code boolean}: an absent
     * query parameter converts to {@code null}, and binding {@code null} to a
     * primitive fails the whole request — which would have made every
     * unfiltered {@code GET /transactions} a 400.
     */
    public TransactionFilter {
        includeDeleted = includeDeleted != null && includeDeleted;
    }

    /** True when the caller gave a range that can never match. */
    public boolean isImpossibleRange() {
        return (from != null && to != null && from.isAfter(to))
                || (minAmount != null && maxAmount != null && minAmount.compareTo(maxAmount) > 0);
    }
}
