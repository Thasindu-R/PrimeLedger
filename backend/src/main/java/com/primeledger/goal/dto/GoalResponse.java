package com.primeledger.goal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A savings goal, where it stands, and where it is heading (F-04).
 *
 * <p>Every money field is a decimal string for the reason §7.3 gives: a
 * JavaScript number cannot hold a currency amount without eventually lying about
 * it.
 *
 * @param currentAmount the linked account's balance — opening balance plus every
 *     transaction in it
 * @param requiredMonthly what would have to go in each month to hit {@code
 *     targetDate}. Null when the goal is met or has no date.
 * @param monthlyRate what has actually gone in each month over the trailing
 *     window, which is the number the projection is built on. Negative when the
 *     account is being drawn down.
 * @param projectedCompletion when {@code monthlyRate} would get there. Null when
 *     the goal is met, or when the current rate never would.
 * @param onTrack whether {@code projectedCompletion} beats {@code targetDate}.
 *     Null when there is no target date to beat.
 * @param contributionFrom start of the trailing window {@code monthlyRate} was
 *     measured over, so the UI can say what "your rate" is a rate over
 */
@Schema(name = "Goal")
public record GoalResponse(
        UUID id,
        @Schema(example = "Emergency fund") String name,
        UUID accountId,
        @Schema(example = "Savings") String accountName,
        @Schema(example = "#10B981") String accountColour,
        @Schema(example = "LKR") String currency,
        @Schema(type = "string", example = "500000.00") String targetAmount,
        LocalDate targetDate,
        @Schema(type = "string", example = "182400.00") String currentAmount,
        @Schema(type = "string", example = "317600.00") String remaining,
        @Schema(example = "36.5", description = "Uncapped: over 100 once overshot")
                double progressPercent,
        boolean achieved,
        @Schema(type = "string", example = "19850.00") String requiredMonthly,
        @Schema(type = "string", example = "14200.00") String monthlyRate,
        LocalDate projectedCompletion,
        Boolean onTrack,
        LocalDate contributionFrom,
        LocalDate contributionTo) {}
