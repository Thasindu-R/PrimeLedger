package com.primeledger.recurring.dto;

import com.primeledger.recurring.Frequency;
import com.primeledger.transaction.TransactionType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A recurring rule, its schedule, and what it has done so far (F-03).
 *
 * @param nextRunOn the next occurrence not yet materialised. Null once {@code
 *     finished} — there is no next one.
 * @param finished the end date has passed. Distinct from {@code paused}, which
 *     the user can undo.
 * @param generatedCount transactions this rule has created and that still point
 *     back at it. Severed and hard-deleted ones are not counted, so this is "how
 *     many of mine are still mine" rather than a lifetime total.
 */
@Schema(name = "RecurringRule")
public record RecurringRuleResponse(
        UUID id,
        @Schema(example = "Rent") String name,
        UUID accountId,
        @Schema(example = "Everyday") String accountName,
        UUID categoryId,
        @Schema(example = "Housing") String categoryName,
        @Schema(example = "#F97316") String categoryColour,
        TransactionType type,
        @Schema(type = "string", example = "1500.00") String amount,
        @Schema(example = "USD") String currency,
        String description,
        Frequency frequency,
        @Schema(example = "1") int interval,
        @Schema(example = "2026-03-01") LocalDate startsOn,
        @Schema(example = "2026-09-01") LocalDate nextRunOn,
        LocalDate endsOn,
        boolean paused,
        boolean finished,
        @Schema(description = "Occurrence date of the most recent transaction generated")
                LocalDate lastRunOn,
        long generatedCount) {}
