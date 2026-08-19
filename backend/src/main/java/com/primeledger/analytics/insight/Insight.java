package com.primeledger.analytics.insight;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * One plain-language observation about the ledger (F-07, FR-30).
 *
 * <p>Carries the sentence <em>and</em> the numbers behind it. The client could
 * render {@link #detail} alone, but then "3.2× your usual Shopping expense"
 * would be a string it cannot link, style or re-round, and the rule's arithmetic
 * would be unavailable to anything but a human reading it. Structured fields are
 * nullable because most rules use only some of them.
 *
 * @param subjectId the row being talked about — a category or a transaction,
 *     depending on {@link #kind} — so the client can link to it
 * @param amount the figure the sentence turns on, as a decimal string in the
 *     user's base currency (§7.3)
 * @param percent the movement the sentence turns on, where there is one
 */
@Schema(name = "Insight")
public record Insight(
        InsightKind kind,
        InsightTone tone,
        @Schema(example = "Food spending is up") String title,
        @Schema(example = "You have spent LKR 12,400 on Food this month, 34% more than last month.")
                String detail,
        UUID subjectId,
        @Schema(example = "Food") String subjectName,
        @Schema(type = "string", example = "12400.00") String amount,
        @Schema(example = "34.0") Double percent) {

    public static Insight of(
            InsightKind kind, InsightTone tone, String title, String detail) {
        return new Insight(kind, tone, title, detail, null, null, null, null);
    }
}
