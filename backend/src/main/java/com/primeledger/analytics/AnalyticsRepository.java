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
     */
    public List<TypeTotal> totalsByType(UUID userId, TransactionFilter filter) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Transaction> root = query.from(Transaction.class);

        Expression<TransactionType> type = root.get("type");
        Expression<BigDecimal> amount = root.get("amount");

        // The List overload, not the varargs one: Jakarta Persistence 3.2
        // deprecated the latter.
        query.multiselect(List.of(type, cb.sum(amount), cb.count(root), cb.max(amount)))
                .where(scope(userId, filter, root, query, cb))
                .groupBy(type);

        return em.createQuery(query).getResultList().stream()
                .map(
                        row ->
                                new TypeTotal(
                                        row.get(0, TransactionType.class),
                                        row.get(1, BigDecimal.class),
                                        row.get(2, Long.class),
                                        row.get(3, BigDecimal.class)))
                .toList();
    }

    /** One row per (category, type) with activity, largest total first. */
    public List<CategoryTotal> totalsByCategory(UUID userId, TransactionFilter filter) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Transaction> root = query.from(Transaction.class);

        Expression<UUID> categoryId = root.get("category").get("id");
        Expression<String> categoryName = root.get("category").get("name");
        Expression<TransactionType> type = root.get("type");
        Expression<BigDecimal> total = cb.sum(root.<BigDecimal>get("amount"));

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
    public List<MonthlyTotal> totalsByMonth(UUID userId, TransactionFilter filter) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Transaction> root = query.from(Transaction.class);

        Expression<String> month =
                cb.function("to_char", String.class, root.get("occurredOn"), cb.literal("YYYY-MM"));
        Expression<TransactionType> type = root.get("type");

        query.multiselect(List.of(month, type, cb.sum(root.<BigDecimal>get("amount"))))
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

    private static Predicate scope(
            UUID userId,
            TransactionFilter filter,
            Root<Transaction> root,
            CriteriaQuery<?> query,
            CriteriaBuilder cb) {
        return TransactionSpecifications.matching(userId, filter).toPredicate(root, query, cb);
    }

    public record TypeTotal(
            TransactionType type, BigDecimal total, long count, BigDecimal largest) {}

    public record CategoryTotal(
            UUID categoryId,
            String categoryName,
            TransactionType type,
            BigDecimal total,
            long count) {}

    public record MonthlyTotal(String month, TransactionType type, BigDecimal total) {}
}
