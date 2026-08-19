package com.primeledger.analytics.insight;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * "Food spending is up 34% versus last month" (F-07).
 *
 * <p>The comparison is against the <em>same span</em> of last month, not all of
 * it. On the 9th, this month holds nine days of spending and last month holds
 * thirty; reporting that as "down 70%" would be arithmetically correct, useless,
 * and true of every category in the first week of every month. Fixing that in
 * the window rather than in the wording is what makes the number worth printing.
 */
@Component
public class CategoryShiftRule implements InsightRule {

    /** Below this a movement is ordinary variation, not an observation. */
    private static final double MATERIAL_PERCENT = 25.0;

    /**
     * A category has to be worth this much before a percentage means anything.
     * Going from 40 to 90 is "up 125%" and is not news; the threshold is in the
     * user's own currency because it is a judgement about materiality, and one
     * that a base currency of LKR versus USD would otherwise scale by 300.
     */
    private static final BigDecimal MATERIAL_SHARE = new BigDecimal("0.05");

    /** At most this many, so the panel stays a summary rather than a listing. */
    private static final int MAX_REPORTED = 2;

    @Override
    public List<Insight> evaluate(InsightContext context) {
        BigDecimal floor = context.expenseThisMonth().multiply(MATERIAL_SHARE);
        List<Insight> found = new ArrayList<>();

        List<InsightContext.CategoryFigure> candidates =
                context.thisMonth().values().stream()
                        .filter(figure -> figure.total().compareTo(floor) >= 0)
                        .sorted(Comparator.comparing(InsightContext.CategoryFigure::total).reversed())
                        .toList();

        for (InsightContext.CategoryFigure current : candidates) {
            BigDecimal previous =
                    context.lastMonthFor(current.categoryId())
                            .map(InsightContext.CategoryFigure::total)
                            .orElse(BigDecimal.ZERO);

            // Nothing last month is a new habit rather than a percentage: "up
            // infinity%" is not a sentence, and the amount says it better.
            if (previous.signum() == 0) {
                found.add(newSpending(current, context));
            } else {
                double movement = InsightFormat.percent(previous, current.total());
                if (Math.abs(movement) >= MATERIAL_PERCENT) {
                    found.add(shift(current, movement, context));
                }
            }

            if (found.size() == MAX_REPORTED) break;
        }

        return found;
    }

    private static Insight shift(
            InsightContext.CategoryFigure current, double movement, InsightContext context) {
        boolean up = movement > 0;
        return new Insight(
                InsightKind.CATEGORY_SHIFT,
                up ? InsightTone.WARNING : InsightTone.GOOD,
                "%s spending is %s".formatted(current.name(), up ? "up" : "down"),
                "You have spent %s on %s so far this month, %.0f%% %s than by this point last month."
                        .formatted(
                                InsightFormat.prose(current.total(), context.currency()),
                                current.name(),
                                Math.abs(movement),
                                up ? "more" : "less"),
                current.categoryId(),
                current.name(),
                InsightFormat.exact(current.total()),
                movement);
    }

    private static Insight newSpending(
            InsightContext.CategoryFigure current, InsightContext context) {
        return new Insight(
                InsightKind.CATEGORY_SHIFT,
                InsightTone.NEUTRAL,
                "New spending on %s".formatted(current.name()),
                "You have spent %s on %s this month, with nothing on it by this point last month."
                        .formatted(
                                InsightFormat.prose(current.total(), context.currency()),
                                current.name()),
                current.categoryId(),
                current.name(),
                InsightFormat.exact(current.total()),
                null);
    }
}
