package com.primeledger.analytics.insight;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * The rules engine (F-07, FR-30).
 *
 * <p>Every case here is a set of numbers written down, which is the entire
 * argument for rules over a model at this scale: "what does the app say to
 * someone who has had no income this month" is a question with a checkable
 * answer, and the answer is in the same file as the reasoning that produced it.
 */
class InsightRuleTest {

    private static final UUID FOOD = UUID.randomUUID();
    private static final UUID RENT = UUID.randomUUID();

    /** The 15th: half the month gone, so projections are live and comparisons are fair. */
    private static final LocalDate MID_MONTH = LocalDate.of(2026, 6, 15);

    @Nested
    @DisplayName("category shift")
    class CategoryShift {

        private final CategoryShiftRule rule = new CategoryShiftRule();

        @Test
        @DisplayName("reports a category that has risen sharply against the same span last month")
        void reportsARise() {
            InsightContext context =
                    context()
                            .thisMonth(FOOD, "Food", "1340.00", 12)
                            .lastMonth(FOOD, "Food", "1000.00", 10)
                            .expenseThisMonth("1340.00")
                            .build();

            List<Insight> insights = rule.evaluate(context);

            assertThat(insights).singleElement().satisfies(
                    insight -> {
                        assertThat(insight.kind()).isEqualTo(InsightKind.CATEGORY_SHIFT);
                        assertThat(insight.tone()).isEqualTo(InsightTone.WARNING);
                        assertThat(insight.percent()).isEqualTo(34.0);
                        assertThat(insight.detail()).contains("34% more");
                        assertThat(insight.subjectId()).isEqualTo(FOOD);
                    });
        }

        @Test
        @DisplayName("a fall is good news and is coloured as such")
        void reportsAFallAsGood() {
            InsightContext context =
                    context()
                            .thisMonth(FOOD, "Food", "500.00", 6)
                            .lastMonth(FOOD, "Food", "1000.00", 10)
                            .expenseThisMonth("500.00")
                            .build();

            assertThat(rule.evaluate(context)).singleElement().satisfies(
                    insight -> {
                        assertThat(insight.tone()).isEqualTo(InsightTone.GOOD);
                        assertThat(insight.detail()).contains("50% less");
                    });
        }

        @Test
        @DisplayName("ignores a movement small enough to be ordinary variation")
        void ignoresNoise() {
            InsightContext context =
                    context()
                            .thisMonth(FOOD, "Food", "1100.00", 10)
                            .lastMonth(FOOD, "Food", "1000.00", 10)
                            .expenseThisMonth("1100.00")
                            .build();

            assertThat(rule.evaluate(context)).isEmpty();
        }

        /**
         * Going from 40 to 90 is "up 125%" and is not news. Without a floor the
         * panel fills with percentages about rounding errors.
         */
        @Test
        @DisplayName("ignores a big percentage on an immaterial amount")
        void ignoresTrivialCategories() {
            InsightContext context =
                    context()
                            .thisMonth(FOOD, "Food", "90.00", 2)
                            .lastMonth(FOOD, "Food", "40.00", 1)
                            .expenseThisMonth("5000.00")
                            .build();

            assertThat(rule.evaluate(context)).isEmpty();
        }

        @Test
        @DisplayName("says 'new spending' rather than dividing by zero")
        void handlesNoHistory() {
            InsightContext context =
                    context()
                            .thisMonth(RENT, "Rent", "1500.00", 1)
                            .expenseThisMonth("1500.00")
                            .build();

            assertThat(rule.evaluate(context)).singleElement().satisfies(
                    insight -> {
                        assertThat(insight.title()).isEqualTo("New spending on Rent");
                        assertThat(insight.percent()).isNull();
                    });
        }
    }

    @Nested
    @DisplayName("unusual transaction")
    class Unusual {

        private final UnusualTransactionRule rule = new UnusualTransactionRule();

        @Test
        @DisplayName("flags a transaction far above the usual for its category")
        void flagsAnOutlier() {
            InsightContext context =
                    context()
                            .trailingMean(FOOD, "50.00")
                            .lastMonth(FOOD, "Food", "500.00", 10)
                            .largest(FOOD, "Food", "160.00", "Weekly shop")
                            .build();

            assertThat(rule.evaluate(context)).singleElement().satisfies(
                    insight -> {
                        assertThat(insight.kind()).isEqualTo(InsightKind.UNUSUAL_TRANSACTION);
                        assertThat(insight.detail()).contains("3.2×");
                        assertThat(insight.detail()).contains("Weekly shop");
                    });
        }

        @Test
        @DisplayName("leaves an ordinary large transaction alone")
        void ignoresTheMerelyLarge() {
            InsightContext context =
                    context()
                            .trailingMean(FOOD, "50.00")
                            .lastMonth(FOOD, "Food", "500.00", 10)
                            .largest(FOOD, "Food", "100.00", "Weekly shop")
                            .build();

            assertThat(rule.evaluate(context)).isEmpty();
        }

        /**
         * A mean drawn from one previous transaction is an anecdote. Comparing
         * against it produces confident nonsense on any category the user has
         * barely touched.
         */
        @Test
        @DisplayName("says nothing when there is too little history to have a usual")
        void ignoresThinHistory() {
            InsightContext context =
                    context()
                            .trailingMean(RENT, "50.00")
                            .lastMonth(RENT, "Rent", "50.00", 1)
                            .largest(RENT, "Rent", "1500.00", "Rent")
                            .build();

            assertThat(rule.evaluate(context)).isEmpty();
        }

        @Test
        @DisplayName("falls back to the category name when a transaction has no description")
        void handlesMissingDescription() {
            InsightContext context =
                    context()
                            .trailingMean(FOOD, "50.00")
                            .lastMonth(FOOD, "Food", "500.00", 10)
                            .largest(FOOD, "Food", "500.00", null)
                            .build();

            assertThat(rule.evaluate(context)).singleElement().satisfies(
                    insight -> assertThat(insight.detail()).startsWith("A Food transaction"));
        }
    }

    @Nested
    @DisplayName("month-end projection")
    class Projection {

        private final MonthEndProjectionRule rule = new MonthEndProjectionRule();

        @Test
        @DisplayName("extrapolates the month and compares it to the monthly limits")
        void projectsOverBudget() {
            // Half the month gone, 700 spent, so about 1,400 projected against a
            // 1,000 limit.
            InsightContext context =
                    context().expenseThisMonth("700.00").monthlyBudget("1000.00").build();

            assertThat(rule.evaluate(context)).singleElement().satisfies(
                    insight -> {
                        assertThat(insight.tone()).isEqualTo(InsightTone.WARNING);
                        assertThat(insight.title()).isEqualTo("Heading over budget this month");
                        assertThat(new BigDecimal(insight.amount()))
                                .isBetween(new BigDecimal("1390"), new BigDecimal("1410"));
                    });
        }

        @Test
        @DisplayName("is good news when the projection lands under the limits")
        void projectsUnderBudget() {
            InsightContext context =
                    context().expenseThisMonth("300.00").monthlyBudget("1000.00").build();

            assertThat(rule.evaluate(context)).singleElement().satisfies(
                    insight -> assertThat(insight.tone()).isEqualTo(InsightTone.GOOD));
        }

        @Test
        @DisplayName("still projects for a user who has set no budgets")
        void projectsWithoutBudgets() {
            InsightContext context = context().expenseThisMonth("700.00").build();

            assertThat(rule.evaluate(context)).singleElement().satisfies(
                    insight -> assertThat(insight.tone()).isEqualTo(InsightTone.NEUTRAL));
        }

        /**
         * One big shop on the 2nd projects to fifteen times itself. Being silent
         * for two days beats being spectacularly wrong on the third of every
         * month.
         */
        @Test
        @DisplayName("says nothing in the first days of the month")
        void staysQuietEarly() {
            InsightContext context =
                    context().on(LocalDate.of(2026, 6, 2)).expenseThisMonth("700.00").build();

            assertThat(rule.evaluate(context)).isEmpty();
        }

        @Test
        @DisplayName("says nothing once the month is essentially over")
        void staysQuietLate() {
            InsightContext context =
                    context().on(LocalDate.of(2026, 6, 30)).expenseThisMonth("700.00").build();

            assertThat(rule.evaluate(context)).isEmpty();
        }
    }

    @Nested
    @DisplayName("savings rate trend")
    class SavingsRate {

        private final SavingsRateTrendRule rule = new SavingsRateTrendRule();

        @Test
        @DisplayName("reports an improving rate as good news")
        void reportsImprovement() {
            InsightContext context =
                    context().savingsRate("2026-03", 12.0).savingsRate("2026-05", 19.0).build();

            assertThat(rule.evaluate(context)).singleElement().satisfies(
                    insight -> {
                        assertThat(insight.tone()).isEqualTo(InsightTone.GOOD);
                        assertThat(insight.detail()).contains("19%").contains("12%");
                        assertThat(insight.percent()).isEqualTo(7.0);
                    });
        }

        @Test
        @DisplayName("reports a slipping rate as a warning")
        void reportsDecline() {
            InsightContext context =
                    context().savingsRate("2026-03", 25.0).savingsRate("2026-05", 8.0).build();

            assertThat(rule.evaluate(context)).singleElement().satisfies(
                    insight -> assertThat(insight.tone()).isEqualTo(InsightTone.WARNING));
        }

        @Test
        @DisplayName("ignores a movement of a point or two")
        void ignoresNoise() {
            InsightContext context =
                    context().savingsRate("2026-03", 12.0).savingsRate("2026-05", 13.5).build();

            assertThat(rule.evaluate(context)).isEmpty();
        }

        /**
         * A month with no income has no savings rate — the denominator is zero.
         * Counting it as 0% would invent a collapse the user did not have.
         */
        @Test
        @DisplayName("skips months with no income rather than calling them zero percent")
        void skipsMonthsWithoutIncome() {
            InsightContext context =
                    context()
                            .savingsRate("2026-03", 12.0)
                            .savingsRateUndefined("2026-04")
                            .savingsRate("2026-05", 14.0)
                            .build();

            // 12 to 14 is two points: below the threshold, and crucially not the
            // "12 to 0 to 14" catastrophe an undefined month would have produced.
            assertThat(rule.evaluate(context)).isEmpty();
        }

        @Test
        @DisplayName("needs more than one month before it will call anything a trend")
        void needsHistory() {
            InsightContext context = context().savingsRate("2026-05", 40.0).build();

            assertThat(rule.evaluate(context)).isEmpty();
        }
    }

    // ------------------------------------------------------------------ builder

    private static Builder context() {
        return new Builder();
    }

    /** Assembles an {@link InsightContext} from literals, one fact at a time. */
    private static final class Builder {
        private LocalDate today = MID_MONTH;
        private final Map<UUID, InsightContext.CategoryFigure> thisMonth = new HashMap<>();
        private final Map<UUID, InsightContext.CategoryFigure> lastMonth = new HashMap<>();
        private final Map<UUID, BigDecimal> trailingMean = new HashMap<>();
        private final List<InsightContext.LargeExpense> largest = new ArrayList<>();
        private final List<InsightContext.MonthlySavingsRate> rates = new ArrayList<>();
        private final List<com.primeledger.budget.BudgetService.Position> budgets =
                new ArrayList<>();
        private BigDecimal income = BigDecimal.ZERO;
        private BigDecimal expense = BigDecimal.ZERO;

        Builder on(LocalDate date) {
            this.today = date;
            return this;
        }

        Builder thisMonth(UUID id, String name, String total, long count) {
            thisMonth.put(
                    id, new InsightContext.CategoryFigure(id, name, new BigDecimal(total), count));
            return this;
        }

        Builder lastMonth(UUID id, String name, String total, long count) {
            lastMonth.put(
                    id, new InsightContext.CategoryFigure(id, name, new BigDecimal(total), count));
            return this;
        }

        Builder trailingMean(UUID id, String mean) {
            trailingMean.put(id, new BigDecimal(mean));
            return this;
        }

        Builder largest(UUID categoryId, String categoryName, String amount, String description) {
            largest.add(
                    new InsightContext.LargeExpense(
                            UUID.randomUUID(),
                            categoryId,
                            categoryName,
                            new BigDecimal(amount),
                            MID_MONTH,
                            description));
            return this;
        }

        Builder expenseThisMonth(String amount) {
            this.expense = new BigDecimal(amount);
            return this;
        }

        Builder savingsRate(String month, double rate) {
            rates.add(new InsightContext.MonthlySavingsRate(month, rate));
            return this;
        }

        Builder savingsRateUndefined(String month) {
            rates.add(new InsightContext.MonthlySavingsRate(month, null));
            return this;
        }

        Builder monthlyBudget(String limit) {
            budgets.add(TestBudgets.monthly(limit, "USD"));
            return this;
        }

        InsightContext build() {
            return new InsightContext(
                    today.withDayOfMonth(1),
                    today,
                    "USD",
                    thisMonth,
                    lastMonth,
                    trailingMean,
                    largest,
                    income,
                    expense,
                    rates,
                    budgets);
        }
    }
}
