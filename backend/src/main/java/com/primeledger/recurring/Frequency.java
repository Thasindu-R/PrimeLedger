package com.primeledger.recurring;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * How often a recurring rule fires (F-03). Mirrors the {@code
 * recurring_rules.frequency} check constraint in V1.
 *
 * <p>Every occurrence is computed from the rule's {@code startsOn} and an
 * ordinal, never by repeatedly stepping forward from the previous one. The
 * difference only shows up at month ends, and there it is the whole ballgame: a
 * rent rule starting on the 31st of January, stepped forward, becomes the 28th
 * in February and then stays on the 28th forever, because {@link
 * LocalDate#plusMonths} clamps and the clamped value is what the next step
 * starts from. Anchored on {@code startsOn} it is the 31st, the 28th, the 31st
 * again — which is what the user set up.
 */
public enum Frequency {
    DAILY,
    WEEKLY,
    MONTHLY,
    YEARLY;

    /**
     * The date of the {@code ordinal}-th occurrence, counting the one on {@code
     * startsOn} as zero.
     *
     * @param interval how many of this unit between occurrences — 2 with {@link
     *     #WEEKLY} is a fortnight
     */
    public LocalDate occurrence(LocalDate startsOn, int interval, long ordinal) {
        long steps = Math.multiplyExact(ordinal, (long) interval);
        return switch (this) {
            case DAILY -> startsOn.plusDays(steps);
            case WEEKLY -> startsOn.plusWeeks(steps);
            case MONTHLY -> startsOn.plusMonths(steps);
            case YEARLY -> startsOn.plusYears(steps);
        };
    }

    /**
     * Which occurrence {@code date} is, counting from {@code startsOn}.
     *
     * <p>Months and years count calendar boundaries rather than elapsed time,
     * and that is the point. {@code ChronoUnit.MONTHS.between(31 January, 28
     * February)} is 0, because not a whole month has passed — true, and useless
     * here, since 28 February is unambiguously the first occurrence of a monthly
     * rule that began on 31 January.
     */
    public long ordinalOf(LocalDate startsOn, int interval, LocalDate date) {
        long elapsed =
                switch (this) {
                    case DAILY -> ChronoUnit.DAYS.between(startsOn, date);
                    case WEEKLY -> ChronoUnit.DAYS.between(startsOn, date) / 7;
                    case MONTHLY -> monthsBetween(startsOn, date);
                    case YEARLY -> (long) date.getYear() - startsOn.getYear();
                };
        return elapsed / interval;
    }

    /** The occurrence strictly after {@code date}. */
    public LocalDate next(LocalDate startsOn, int interval, LocalDate date) {
        return occurrence(startsOn, interval, ordinalOf(startsOn, interval, date) + 1);
    }

    private static long monthsBetween(LocalDate from, LocalDate to) {
        return (to.getYear() - from.getYear()) * 12L + (to.getMonthValue() - from.getMonthValue());
    }
}
