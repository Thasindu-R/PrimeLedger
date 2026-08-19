package com.primeledger.analytics.insight;

import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Component;

/**
 * "Your savings rate improved from 12% to 19% over three months" (F-07).
 *
 * <p>Savings rate is income minus expense over income, per month. A month with
 * no income has no rate at all — not a rate of zero — and is skipped rather than
 * counted, because treating an undefined denominator as zero would invent a
 * collapse the user did not have.
 *
 * <p>The current month is excluded by the service that builds the window. Half a
 * month of expenses against a salary that has not landed yet produces a savings
 * rate of minus several hundred percent, every month, until payday.
 */
@Component
public class SavingsRateTrendRule implements InsightRule {

    /** Percentage points. Below this it is noise dressed up as a trend. */
    private static final double MATERIAL_POINTS = 3.0;

    /** Two months is a difference; three is a trend worth the word. */
    private static final int MIN_MONTHS = 2;

    @Override
    public List<Insight> evaluate(InsightContext context) {
        List<InsightContext.MonthlySavingsRate> known =
                context.savingsRateByMonth().stream()
                        .filter(month -> Objects.nonNull(month.rate()))
                        .toList();

        if (known.size() < MIN_MONTHS) return List.of();

        double oldest = known.getFirst().rate();
        double newest = known.getLast().rate();
        double movement = newest - oldest;

        if (Math.abs(movement) < MATERIAL_POINTS) return List.of();

        boolean improved = movement > 0;

        return List.of(
                new Insight(
                        InsightKind.SAVINGS_RATE_TREND,
                        improved ? InsightTone.GOOD : InsightTone.WARNING,
                        improved ? "Your savings rate is improving" : "Your savings rate is slipping",
                        "You saved %.0f%% of your income last month, against %.0f%% %s months earlier."
                                .formatted(newest, oldest, known.size() - 1),
                        null,
                        null,
                        null,
                        Math.round(movement * 10) / 10.0));
    }
}
