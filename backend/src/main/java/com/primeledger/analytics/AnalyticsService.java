package com.primeledger.analytics;

import com.primeledger.analytics.dto.SummaryResponse;
import com.primeledger.common.ApiException;
import com.primeledger.security.CurrentUserProvider;
import com.primeledger.transaction.TransactionType;
import com.primeledger.transaction.dto.TransactionFilter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsService {

    private final AnalyticsRepository analytics;
    private final CurrentUserProvider currentUser;

    public AnalyticsService(AnalyticsRepository analytics, CurrentUserProvider currentUser) {
        this.analytics = analytics;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public SummaryResponse summary(TransactionFilter filter) {
        // The same guard the list endpoint applies, for the same reason: a range
        // that cannot match is a mistake worth reporting, not an empty summary.
        if (filter.isImpossibleRange()) {
            throw ApiException.businessRule("The requested range is empty: from is after to");
        }

        UUID userId = currentUser.currentUserId();

        return new SummaryResponse(
                totals(userId, filter), byCategory(userId, filter), monthly(userId, filter));
    }

    private SummaryResponse.Totals totals(UUID userId, TransactionFilter filter) {
        Map<TransactionType, AnalyticsRepository.TypeTotal> rows =
                new EnumMap<>(TransactionType.class);
        long count = 0;

        for (AnalyticsRepository.TypeTotal row : analytics.totalsByType(userId, filter)) {
            rows.put(row.type(), row);
            count += row.count();
        }

        BigDecimal income = totalOf(rows.get(TransactionType.INCOME));
        BigDecimal expense = totalOf(rows.get(TransactionType.EXPENSE));

        AnalyticsRepository.TypeTotal expenses = rows.get(TransactionType.EXPENSE);
        BigDecimal highestExpense = expenses == null ? BigDecimal.ZERO : orZero(expenses.largest());

        return new SummaryResponse.Totals(
                money(income),
                money(expense),
                money(income.subtract(expense)),
                count,
                money(highestExpense));
    }

    private static BigDecimal totalOf(AnalyticsRepository.TypeTotal row) {
        return row == null ? BigDecimal.ZERO : orZero(row.total());
    }

    private List<SummaryResponse.CategoryTotal> byCategory(UUID userId, TransactionFilter filter) {
        return analytics.totalsByCategory(userId, filter).stream()
                .map(
                        row ->
                                new SummaryResponse.CategoryTotal(
                                        row.categoryId(),
                                        row.categoryName(),
                                        row.type(),
                                        money(row.total()),
                                        row.count()))
                .toList();
    }

    /**
     * Collapses the two rows a month can produce — one per type — into the single
     * point the chart draws. Insertion-ordered, and the query returns months
     * ascending, so the series comes out oldest first without a second sort.
     */
    private List<SummaryResponse.MonthlyTotal> monthly(UUID userId, TransactionFilter filter) {
        Map<String, BigDecimal[]> byMonth = new LinkedHashMap<>();

        for (AnalyticsRepository.MonthlyTotal row : analytics.totalsByMonth(userId, filter)) {
            BigDecimal[] slot =
                    byMonth.computeIfAbsent(
                            row.month(), key -> new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO});
            int index = row.type() == TransactionType.INCOME ? 0 : 1;
            slot[index] = slot[index].add(orZero(row.total()));
        }

        List<SummaryResponse.MonthlyTotal> series = new ArrayList<>(byMonth.size());
        byMonth.forEach(
                (month, slot) ->
                        series.add(
                                new SummaryResponse.MonthlyTotal(
                                        month, money(slot[0]), money(slot[1]))));
        return series;
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    /** Two decimal places, always, so the client never has to guess the scale. */
    private static String money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
