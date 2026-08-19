package com.primeledger.goal;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * What a savings goal actually tells the user (F-04).
 *
 * <p>"The projection is what makes this more than a progress bar: it tells the
 * user whether their current behaviour will actually get them there, which is
 * the only question that matters." Two different numbers answer it, and keeping
 * them apart is the point:
 *
 * <ul>
 *   <li>{@code requiredMonthly} is arithmetic on the target — what they would
 *       have to put aside.
 *   <li>{@code monthlyRate} is observation — what they have actually been
 *       putting aside, measured over the trailing window.
 * </ul>
 *
 * <p>A pure function of its inputs, with no repository and no clock of its own,
 * so every branch below can be tested with fixed values rather than by
 * arranging a database into the right state.
 *
 * @param remaining what is still to be saved; zero once the target is reached
 * @param progressPercent uncapped and unclamped — over 100 when the account has
 *     overshot, negative when it is overdrawn, both of which are worth showing
 *     rather than rounding away
 * @param requiredMonthly null when the goal is met, or has no target date to
 *     require anything by
 * @param monthlyRate observed contribution per month over the trailing window;
 *     negative when the account is being drawn down
 * @param projectedCompletion null when the goal is met, or when the observed
 *     rate does not lead there at all
 * @param onTrack null when there is no target date, and so nothing to be on
 *     track for
 */
public record GoalProjection(
        BigDecimal remaining,
        double progressPercent,
        boolean achieved,
        BigDecimal requiredMonthly,
        BigDecimal monthlyRate,
        LocalDate projectedCompletion,
        Boolean onTrack) {

    /**
     * Beyond this the projection has stopped being information. A rate of fifty
     * a month against a target of half a million is arithmetically "833 years",
     * and printing a date in the year 2859 tells the user nothing they cannot
     * see faster from the rate itself.
     */
    private static final long MAX_PROJECTED_MONTHS = 1200;

    public static GoalProjection of(
            BigDecimal current,
            BigDecimal target,
            LocalDate targetDate,
            BigDecimal monthlyRate,
            LocalDate today) {

        BigDecimal shortfall = target.subtract(current);
        boolean achieved = shortfall.signum() <= 0;
        BigDecimal remaining = achieved ? BigDecimal.ZERO : shortfall;

        double progressPercent =
                target.signum() == 0
                        ? 0
                        : current.multiply(BigDecimal.valueOf(100))
                                .divide(target, 1, RoundingMode.HALF_UP)
                                .doubleValue();

        BigDecimal requiredMonthly = requiredMonthly(remaining, targetDate, today, achieved);
        LocalDate projectedCompletion = projectedCompletion(remaining, monthlyRate, today, achieved);

        Boolean onTrack =
                targetDate == null
                        ? null
                        : achieved
                                || (projectedCompletion != null
                                        && !projectedCompletion.isAfter(targetDate));

        return new GoalProjection(
                scale(remaining),
                progressPercent,
                achieved,
                requiredMonthly,
                scale(monthlyRate),
                projectedCompletion,
                onTrack);
    }

    private static BigDecimal requiredMonthly(
            BigDecimal remaining, LocalDate targetDate, LocalDate today, boolean achieved) {

        if (achieved || targetDate == null) return null;

        // Whole months between the two, counted by calendar rather than by
        // elapsed days: a goal dated the 30th of next month is one month away
        // whether today is the 1st or the 29th, and the user thinks in months.
        long months =
                ChronoUnit.MONTHS.between(today.withDayOfMonth(1), targetDate.withDayOfMonth(1));

        // The date is this month or already past. The whole shortfall is due
        // now, and saying "1,200 a month" about a deadline that has gone would
        // be worse than saying nothing.
        if (months <= 0) return scale(remaining);

        return remaining.divide(BigDecimal.valueOf(months), 2, RoundingMode.CEILING);
    }

    private static LocalDate projectedCompletion(
            BigDecimal remaining, BigDecimal monthlyRate, LocalDate today, boolean achieved) {

        if (achieved || monthlyRate.signum() <= 0) return null;

        long months =
                remaining
                        .divide(monthlyRate, 0, RoundingMode.CEILING)
                        .min(BigDecimal.valueOf(MAX_PROJECTED_MONTHS))
                        .longValue();

        if (months >= MAX_PROJECTED_MONTHS) return null;

        return today.plusMonths(months);
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
