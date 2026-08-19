package com.primeledger.analytics.insight;

import com.primeledger.budget.BudgetPeriod;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * "At the current rate you will spend LKR 128,000 this month, LKR 12,000 over
 * budget" (F-07).
 *
 * <p>A straight-line extrapolation, and deliberately no cleverer than that. A
 * model that knew rent lands on the 1st and payday on the 25th would be more
 * accurate and would also be unable to explain itself; this one is wrong in a
 * direction the user can see and reason about from the sentence alone.
 */
@Component
public class MonthEndProjectionRule implements InsightRule {

    /**
     * Before this much of the month has passed, dividing by the elapsed fraction
     * amplifies a single day into a wild claim — one big shop on the 2nd
     * projects to fifteen times itself. Better to say nothing for two days than
     * to be spectacularly wrong on the third of every month.
     */
    private static final BigDecimal MIN_ELAPSED = new BigDecimal("0.20");

    /** Only worth saying if the projection differs from today's total. */
    private static final BigDecimal MIN_REMAINING_FRACTION = new BigDecimal("0.05");

    @Override
    public List<Insight> evaluate(InsightContext context) {
        BigDecimal elapsed = context.monthElapsedFraction();
        if (elapsed.compareTo(MIN_ELAPSED) < 0) return List.of();
        if (context.expenseThisMonth().signum() <= 0) return List.of();
        if (BigDecimal.ONE.subtract(elapsed).compareTo(MIN_REMAINING_FRACTION) < 0) {
            // The month is essentially over; "you will spend" is now "you spent",
            // and the other rules say that better.
            return List.of();
        }

        BigDecimal projected =
                context.expenseThisMonth().divide(elapsed, 2, RoundingMode.HALF_UP);

        BigDecimal monthlyLimit = monthlyBudgetTotal(context);

        if (monthlyLimit.signum() <= 0) {
            return List.of(
                    new Insight(
                            InsightKind.MONTH_END_PROJECTION,
                            InsightTone.NEUTRAL,
                            "On track to spend %s".formatted(
                                    InsightFormat.prose(projected, context.currency())),
                            "At your current rate you will spend about %s by the end of the month."
                                    .formatted(
                                            InsightFormat.prose(projected, context.currency())),
                            null,
                            null,
                            InsightFormat.exact(projected),
                            null));
        }

        BigDecimal over = projected.subtract(monthlyLimit);
        boolean overBudget = over.signum() > 0;

        return List.of(
                new Insight(
                        InsightKind.MONTH_END_PROJECTION,
                        overBudget ? InsightTone.WARNING : InsightTone.GOOD,
                        overBudget
                                ? "Heading over budget this month"
                                : "On track to stay within budget",
                        "At your current rate you will spend about %s by the end of the month, %s %s."
                                .formatted(
                                        InsightFormat.prose(projected, context.currency()),
                                        InsightFormat.prose(over.abs(), context.currency()),
                                        overBudget ? "over your limits" : "under your limits"),
                        null,
                        null,
                        InsightFormat.exact(projected),
                        InsightFormat.percent(monthlyLimit, projected)));
    }

    /**
     * Only the monthly budgets. A weekly limit and a yearly one do not add to
     * "your budget for this month" in any way that survives being written down,
     * and quietly summing them would produce a number with no meaning.
     */
    private static BigDecimal monthlyBudgetTotal(InsightContext context) {
        return context.budgets().stream()
                .filter(position -> position.budget().getPeriod() == BudgetPeriod.MONTHLY)
                // A budget in another currency than the report is a different
                // unit; converting it here would duplicate F-05's rules in a
                // place nothing tests them.
                .filter(position -> context.currency().equals(position.budget().getCurrency()))
                .map(position -> position.budget().getLimitAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
