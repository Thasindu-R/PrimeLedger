package com.primeledger.analytics.insight;

import com.primeledger.analytics.AnalyticsRepository;
import com.primeledger.budget.BudgetService;
import com.primeledger.profile.ProfileService;
import com.primeledger.security.CurrentUserProvider;
import com.primeledger.transaction.TransactionType;
import com.primeledger.transaction.dto.TransactionFilter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Assembles the facts, runs the rules, orders the result (F-07, FR-30).
 *
 * <p>The split is the design. Everything that touches a repository or a clock
 * happens here; everything that decides what is worth saying happens in an
 * {@link InsightRule} over a value object. That is what lets the interesting
 * cases — a category that doubled, a month that is barely started, a user with
 * no income — be written down as literals in a test rather than arranged in a
 * database.
 *
 * <p>Rules are injected as a list, so adding one is adding a class.
 */
@Service
public class InsightsService {

    private static final Logger log = LoggerFactory.getLogger(InsightsService.class);

    /**
     * How much history the "usual" is drawn from. Three complete months, matching
     * the savings-goal projection, and for the same reason: one month swings on a
     * single unusual expense, a year is slow to notice a change of habit.
     */
    private static final int TRAILING_MONTHS = 3;

    /** Enough candidates that the outlier rule can skip ones it cannot judge. */
    private static final int LARGEST_CANDIDATES = 5;

    private final AnalyticsRepository analytics;
    private final BudgetService budgets;
    private final ProfileService profiles;
    private final CurrentUserProvider currentUser;
    private final List<InsightRule> rules;
    private final Clock clock;

    public InsightsService(
            AnalyticsRepository analytics,
            BudgetService budgets,
            ProfileService profiles,
            CurrentUserProvider currentUser,
            List<InsightRule> rules,
            Clock clock) {
        this.analytics = analytics;
        this.budgets = budgets;
        this.profiles = profiles;
        this.currentUser = currentUser;
        this.rules = rules;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<Insight> forCurrentUser() {
        UUID userId = currentUser.currentUserId();
        InsightContext context = contextFor(userId);

        List<Insight> insights = new ArrayList<>();
        for (InsightRule rule : rules) {
            try {
                insights.addAll(rule.evaluate(context));
            } catch (RuntimeException e) {
                // One rule that cannot cope with a user's data must not blank
                // the whole panel; the others still have something true to say.
                // The panel is a nicety, and a nicety may not take the dashboard
                // down with it.
                log.warn("Insight rule {} failed", rule.getClass().getSimpleName(), e);
            }
        }

        // Warnings first: someone scanning four observations should meet the one
        // that is costing them money before the one congratulating them.
        insights.sort(Comparator.comparing(Insight::tone));
        return insights;
    }

    // ---------------------------------------------------------------- the facts

    InsightContext contextFor(UUID userId) {
        LocalDate today = LocalDate.now(clock);
        LocalDate monthStart = today.withDayOfMonth(1);
        String currency = profiles.baseCurrencyOf(userId);

        // The same span of last month, not all of it. On the 9th this month
        // holds nine days and last month holds thirty; comparing them would
        // report every category as collapsing, every month, until the 28th.
        LocalDate lastMonthStart = monthStart.minusMonths(1);
        LocalDate lastMonthSameDay =
                lastMonthStart.withDayOfMonth(
                        Math.min(today.getDayOfMonth(), lastMonthStart.lengthOfMonth()));

        LocalDate trailingStart = monthStart.minusMonths(TRAILING_MONTHS);
        LocalDate trailingEnd = monthStart.minusDays(1);

        Map<UUID, InsightContext.CategoryFigure> thisMonth =
                expenseByCategory(userId, monthStart, today, currency);
        Map<UUID, InsightContext.CategoryFigure> lastMonth =
                expenseByCategory(userId, lastMonthStart, lastMonthSameDay, currency);

        Map<UUID, BigDecimal> trailingMean =
                meanExpense(expenseByCategory(userId, trailingStart, trailingEnd, currency));

        List<InsightContext.LargeExpense> largest =
                analytics
                        .largestExpenses(
                                userId,
                                window(monthStart, today, TransactionType.EXPENSE),
                                currency,
                                LARGEST_CANDIDATES)
                        .stream()
                        // A row with no rate cannot be compared to anything.
                        .filter(row -> row.amount() != null && row.categoryId() != null)
                        .map(
                                row ->
                                        new InsightContext.LargeExpense(
                                                row.id(),
                                                row.categoryId(),
                                                row.categoryName(),
                                                row.amount(),
                                                row.occurredOn(),
                                                row.description()))
                        .toList();

        Map<TransactionType, BigDecimal> monthTotals =
                totalsByType(userId, monthStart, today, currency);

        return new InsightContext(
                monthStart,
                today,
                currency,
                thisMonth,
                lastMonth,
                trailingMean,
                largest,
                monthTotals.getOrDefault(TransactionType.INCOME, BigDecimal.ZERO),
                monthTotals.getOrDefault(TransactionType.EXPENSE, BigDecimal.ZERO),
                savingsRates(userId, trailingStart, trailingEnd, currency),
                budgets.positionsOn(userId, today));
    }

    private Map<UUID, InsightContext.CategoryFigure> expenseByCategory(
            UUID userId, LocalDate from, LocalDate to, String currency) {

        Map<UUID, InsightContext.CategoryFigure> byCategory = new HashMap<>();
        analytics
                .totalsByCategory(userId, window(from, to, TransactionType.EXPENSE), currency)
                .forEach(
                        row -> {
                            if (row.categoryId() == null || row.total() == null) return;
                            byCategory.put(
                                    row.categoryId(),
                                    new InsightContext.CategoryFigure(
                                            row.categoryId(),
                                            row.categoryName(),
                                            row.total(),
                                            row.count()));
                        });
        return byCategory;
    }

    private static Map<UUID, BigDecimal> meanExpense(
            Map<UUID, InsightContext.CategoryFigure> figures) {
        Map<UUID, BigDecimal> means = new HashMap<>();
        figures.forEach(
                (categoryId, figure) -> {
                    if (figure.count() <= 0) return;
                    means.put(
                            categoryId,
                            figure.total()
                                    .divide(BigDecimal.valueOf(figure.count()), 2, RoundingMode.HALF_UP));
                });
        return means;
    }

    private Map<TransactionType, BigDecimal> totalsByType(
            UUID userId, LocalDate from, LocalDate to, String currency) {

        Map<TransactionType, BigDecimal> totals = new HashMap<>();
        analytics
                .totalsByType(userId, window(from, to, null), currency)
                .forEach(
                        row ->
                                totals.put(
                                        row.type(),
                                        row.total() == null ? BigDecimal.ZERO : row.total()));
        return totals;
    }

    /**
     * Savings rate per complete month, oldest first.
     *
     * <p>The current month is excluded by the caller's window, and that is not a
     * detail: half a month of expenses against a salary that has not landed
     * produces a rate of minus several hundred percent every month until payday,
     * and a "trend" built on it would say the user's finances collapse and
     * recover on a monthly cycle.
     */
    private List<InsightContext.MonthlySavingsRate> savingsRates(
            UUID userId, LocalDate from, LocalDate to, String currency) {

        Map<String, BigDecimal[]> byMonth = new LinkedHashMap<>();
        analytics
                .totalsByMonth(userId, window(from, to, null), currency)
                .forEach(
                        row -> {
                            BigDecimal[] slot =
                                    byMonth.computeIfAbsent(
                                            row.month(),
                                            key -> new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO});
                            int index = row.type() == TransactionType.INCOME ? 0 : 1;
                            slot[index] =
                                    slot[index].add(row.total() == null ? BigDecimal.ZERO : row.total());
                        });

        List<InsightContext.MonthlySavingsRate> rates = new ArrayList<>(byMonth.size());
        byMonth.forEach(
                (month, slot) -> {
                    BigDecimal income = slot[0];
                    BigDecimal expense = slot[1];
                    Double rate =
                            income.signum() <= 0
                                    // Undefined, not zero. See MonthlySavingsRate.
                                    ? null
                                    : income.subtract(expense)
                                            .multiply(BigDecimal.valueOf(100))
                                            .divide(income, 1, RoundingMode.HALF_UP)
                                            .doubleValue();
                    rates.add(new InsightContext.MonthlySavingsRate(month, rate));
                });

        rates.sort(Comparator.comparing(InsightContext.MonthlySavingsRate::month));
        return rates;
    }

    private static TransactionFilter window(LocalDate from, LocalDate to, TransactionType type) {
        return new TransactionFilter(from, to, type, null, null, null, null, null, false);
    }
}
