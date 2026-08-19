package com.primeledger.analytics;

import com.primeledger.transaction.Transaction;
import com.primeledger.transaction.TransactionSpecifications;
import com.primeledger.transaction.TransactionType;
import com.primeledger.transaction.dto.TransactionFilter;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * Grouped aggregates over the ledger.
 *
 * <p>Written against the Criteria API rather than as JPQL strings for one
 * reason: it can reuse {@link TransactionSpecifications#matching} verbatim. The
 * summary and the list it summarises must agree about which rows are in scope —
 * ownership, soft deletes, and every filter — and the only way to guarantee that
 * is to build the predicate once and use it in both places. A second, hand-kept
 * copy of the same WHERE clause is a divergence waiting to happen.
 */
@Repository
public class AnalyticsRepository {

    private final EntityManager em;

    public AnalyticsRepository(EntityManager em) {
        this.em = em;
    }

    /**
     * One row per type present in the filtered set.
     *
     * <p>Carries the count and the largest single amount as well as the sum,
     * because the dashboard shows all three and none of them can be derived from
     * a page of results — the count would be the page size and the maximum would
     * be the largest row that happened to be on screen.
     *
     * <p>Also carries how many rows could not be converted, which the sum cannot
     * express: {@code SUM} skips nulls, so an unconvertible transaction leaves
     * the total looking like a smaller but entirely plausible number. Counting
     * them is what lets the caller say so rather than quietly under-report.
     */
    public List<TypeTotal> totalsByType(
            UUID userId, TransactionFilter filter, String baseCurrency) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Transaction> root = query.from(Transaction.class);

        Expression<TransactionType> type = root.get("type");
        Expression<BigDecimal> amount = converted(root, cb, baseCurrency);

        // The List overload, not the varargs one: Jakarta Persistence 3.2
        // deprecated the latter.
        query.multiselect(
                        List.of(
                                type,
                                cb.sum(amount),
                                cb.count(root),
                                cb.max(amount),
                                unconvertible(amount, cb)))
                .where(scope(userId, filter, root, query, cb))
                .groupBy(type);

        return em.createQuery(query).getResultList().stream()
                .map(
                        row ->
                                new TypeTotal(
                                        row.get(0, TransactionType.class),
                                        row.get(1, BigDecimal.class),
                                        row.get(2, Long.class),
                                        row.get(3, BigDecimal.class),
                                        row.get(4, Long.class)))
                .toList();
    }

    /** One row per (category, type) with activity, largest total first. */
    public List<CategoryTotal> totalsByCategory(
            UUID userId, TransactionFilter filter, String baseCurrency) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Transaction> root = query.from(Transaction.class);

        Expression<UUID> categoryId = root.get("category").get("id");
        Expression<String> categoryName = root.get("category").get("name");
        Expression<TransactionType> type = root.get("type");
        Expression<BigDecimal> total = cb.sum(converted(root, cb, baseCurrency));

        query.multiselect(List.of(categoryId, categoryName, type, total, cb.count(root)))
                .where(scope(userId, filter, root, query, cb))
                .groupBy(categoryId, categoryName, type)
                .orderBy(cb.desc(total));

        return em.createQuery(query).getResultList().stream()
                .map(
                        row ->
                                new CategoryTotal(
                                        row.get(0, UUID.class),
                                        row.get(1, String.class),
                                        row.get(2, TransactionType.class),
                                        row.get(3, BigDecimal.class),
                                        row.get(4, Long.class)))
                .toList();
    }

    /**
     * One row per (calendar month, type) with activity, oldest first.
     *
     * <p>Bucketed by {@code to_char(occurred_on, 'YYYY-MM')} — the year is part
     * of the key, so January 2025 and January 2026 are two buckets. Grouping on
     * the month alone is the defect D-02 closed in the browser, and it would be
     * no less wrong here.
     */
    public List<MonthlyTotal> totalsByMonth(
            UUID userId, TransactionFilter filter, String baseCurrency) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Transaction> root = query.from(Transaction.class);

        Expression<String> month =
                cb.function("to_char", String.class, root.get("occurredOn"), cb.literal("YYYY-MM"));
        Expression<TransactionType> type = root.get("type");

        query.multiselect(List.of(month, type, cb.sum(converted(root, cb, baseCurrency))))
                .where(scope(userId, filter, root, query, cb))
                .groupBy(month, type)
                .orderBy(cb.asc(month));

        return em.createQuery(query).getResultList().stream()
                .map(
                        row ->
                                new MonthlyTotal(
                                        row.get(0, String.class),
                                        row.get(1, TransactionType.class),
                                        row.get(2, BigDecimal.class)))
                .toList();
    }

    /**
     * The biggest single expenses in a window, converted, largest first (F-07).
     *
     * <p>Rows rather than an aggregate, because the outlier rule is about one
     * transaction and needs to be able to name it — the description in the
     * sentence and the id behind the link. Bounded by {@code limit} so a wide
     * filter cannot pull the ledger into memory.
     *
     * <p>Ordered by the <em>converted</em> amount. Ordering by the raw one would
     * make "your largest expense" mean whichever account had the weakest
     * currency, which is not a fact about spending at all.
     */
    public List<LargestExpense> largestExpenses(
            UUID userId, TransactionFilter filter, String baseCurrency, int limit) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Transaction> root = query.from(Transaction.class);

        Expression<BigDecimal> amount = converted(root, cb, baseCurrency);

        query.multiselect(
                        List.of(
                                root.get("id"),
                                root.get("category").get("id"),
                                root.get("category").get("name"),
                                amount,
                                root.get("occurredOn"),
                                root.get("description")))
                .where(scope(userId, filter, root, query, cb))
                .orderBy(cb.desc(amount));

        return em.createQuery(query).setMaxResults(limit).getResultList().stream()
                .map(
                        row ->
                                new LargestExpense(
                                        row.get(0, UUID.class),
                                        row.get(1, UUID.class),
                                        row.get(2, String.class),
                                        row.get(3, BigDecimal.class),
                                        row.get(4, java.time.LocalDate.class),
                                        row.get(5, String.class)))
                .toList();
    }

    /**
     * The row's amount, expressed in {@code baseCurrency} at the rate that
     * applied on the day it happened (F-05).
     *
     * <p>Inside the aggregate rather than after it, and that is not a
     * micro-optimisation. Once rows are grouped by month or by category their
     * individual dates are gone, so converting the group means picking one date
     * for a set of transactions that do not share one — which is exactly the
     * silent drift F-05 exists to prevent. The database is the only place the
     * amount and its own date are still together.
     *
     * <p>Null when no rate has ever been published for the row's currency on or
     * before its date; see {@link #unconvertible}.
     */
    private static Expression<BigDecimal> converted(
            Root<Transaction> root, CriteriaBuilder cb, String baseCurrency) {
        return cb.function(
                "fx_convert",
                BigDecimal.class,
                root.get("amount"),
                root.get("currency"),
                cb.literal(baseCurrency),
                root.get("occurredOn"));
    }

    /** How many rows in the group {@code fx_convert} could not price. */
    private static Expression<Long> unconvertible(
            Expression<BigDecimal> converted, CriteriaBuilder cb) {
        return cb.sum(
                cb.<Long>selectCase()
                        .when(cb.isNull(converted), cb.literal(1L))
                        .otherwise(cb.literal(0L))
                        .as(Long.class));
    }

    private static Predicate scope(
            UUID userId,
            TransactionFilter filter,
            Root<Transaction> root,
            CriteriaQuery<?> query,
            CriteriaBuilder cb) {
        // reporting(), not matching(): transfers move money without being income
        // or expense, and every figure this class produces is a report.
        return TransactionSpecifications.reporting(userId, filter).toPredicate(root, query, cb);
    }

    /**
     * @param unconvertible how many of the {@code count} rows had no exchange
     *     rate and are therefore absent from {@code total}
     */
    public record TypeTotal(
            TransactionType type,
            BigDecimal total,
            long count,
            BigDecimal largest,
            long unconvertible) {}

    public record CategoryTotal(
            UUID categoryId,
            String categoryName,
            TransactionType type,
            BigDecimal total,
            long count) {}

    public record MonthlyTotal(String month, TransactionType type, BigDecimal total) {}

    /**
     * One transaction, converted. {@code amount} is null when the row's currency
     * had no rate — such a row cannot be compared to anything and the caller
     * drops it.
     */
    public record LargestExpense(
            UUID id,
            UUID categoryId,
            String categoryName,
            BigDecimal amount,
            java.time.LocalDate occurredOn,
            String description) {}
}
