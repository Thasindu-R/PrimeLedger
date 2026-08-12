package com.primeledger.budget;

import java.time.LocalDate;
import java.time.temporal.WeekFields;

/**
 * How often a budget resets (F-02). Mirrors the {@code budgets.period} check
 * constraint in V1.
 */
public enum BudgetPeriod {
    WEEKLY,
    MONTHLY,
    YEARLY;

    /**
     * The first day of the period containing {@code date}.
     *
     * <p>Weeks start on Monday: {@link WeekFields#ISO} rather than the platform
     * default, because the default follows the server's locale and a budget that
     * resets on a different day depending on where the container is deployed is
     * not a budget.
     */
    public LocalDate startOfPeriodContaining(LocalDate date) {
        return switch (this) {
            case WEEKLY -> date.with(WeekFields.ISO.dayOfWeek(), 1);
            case MONTHLY -> date.withDayOfMonth(1);
            case YEARLY -> date.withDayOfYear(1);
        };
    }

    /** The last day of that period, inclusive — the form every date filter uses. */
    public LocalDate endOfPeriodContaining(LocalDate date) {
        LocalDate start = startOfPeriodContaining(date);
        return switch (this) {
            case WEEKLY -> start.plusWeeks(1).minusDays(1);
            case MONTHLY -> start.plusMonths(1).minusDays(1);
            case YEARLY -> start.plusYears(1).minusDays(1);
        };
    }

    /** True when {@code start} is the first day of a period of this length. */
    public boolean isPeriodStart(LocalDate start) {
        return startOfPeriodContaining(start).equals(start);
    }
}
