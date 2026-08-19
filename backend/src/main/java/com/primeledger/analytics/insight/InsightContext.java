package com.primeledger.analytics.insight;

import com.primeledger.budget.BudgetService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Everything the rules are allowed to know, gathered once (F-07).
 *
 * <p>A value object with no repository and no clock, which is the property the
 * whole design rests on: "what does the engine say when a category doubled and
 * the user is over budget" becomes a literal to write down rather than a
 * database to arrange. The proposal chose rules over a model precisely because
 * they are explainable, deterministic and testable with fixed inputs, and a rule
 * that could reach out and query would have none of those properties.
 *
 * <p>Every amount here is already converted into {@link #currency} at the rate
 * on each transaction's own date (F-05), so no rule performs, or can perform,
 * currency arithmetic of its own.
 *
 * @param monthStart first day of the month being reported on
 * @param today the day the report is for; {@code monthStart} to {@code today} is
 *     the part of the month that has actually happened
 * @param thisMonth expense per category so far this month
 * @param lastMonth expense per category over the whole of last month
 * @param trailingMean mean single expense per category over the trailing window,
 *     which is what "unusual" is measured against
 * @param largestThisMonth the biggest single expenses this month, largest first
 * @param savingsRateByMonth savings rate per {@code YYYY-MM}, oldest first
 * @param budgets where each in-force budget stands, for the projection rule
 */
public record InsightContext(
        LocalDate monthStart,
        LocalDate today,
        String currency,
        Map<UUID, CategoryFigure> thisMonth,
        Map<UUID, CategoryFigure> lastMonth,
        Map<UUID, BigDecimal> trailingMean,
        List<LargeExpense> largestThisMonth,
        BigDecimal incomeThisMonth,
        BigDecimal expenseThisMonth,
        List<MonthlySavingsRate> savingsRateByMonth,
        List<BudgetService.Position> budgets) {

    /** How far through the month we are, as a fraction — the projection's multiplier. */
    public BigDecimal monthElapsedFraction() {
        int daysInMonth = monthStart.lengthOfMonth();
        int daysSoFar = today.getDayOfMonth();
        return BigDecimal.valueOf(daysSoFar)
                .divide(BigDecimal.valueOf(daysInMonth), 6, RoundingMode.HALF_UP);
    }

    public Optional<CategoryFigure> lastMonthFor(UUID categoryId) {
        return Optional.ofNullable(lastMonth.get(categoryId));
    }

    /** Total and count for one category over one window. */
    public record CategoryFigure(UUID categoryId, String name, BigDecimal total, long count) {}

    /** One transaction large enough to be worth remarking on. */
    public record LargeExpense(
            UUID transactionId,
            UUID categoryId,
            String categoryName,
            BigDecimal amount,
            LocalDate occurredOn,
            String description) {}

    /**
     * @param rate income minus expense, over income. Null when there was no
     *     income that month — a rate with a zero denominator is undefined, not
     *     zero, and reporting it as zero would invent a collapse that did not
     *     happen.
     */
    public record MonthlySavingsRate(String month, Double rate) {}
}
