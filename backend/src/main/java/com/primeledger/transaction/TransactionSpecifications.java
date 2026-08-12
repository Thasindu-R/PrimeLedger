package com.primeledger.transaction;

import com.primeledger.transaction.dto.TransactionFilter;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/**
 * Builds the {@code GET /transactions} predicate.
 *
 * <p>The user predicate is added first and unconditionally — it is not one
 * filter among many, it is the precondition for every read.
 */
public final class TransactionSpecifications {

    private TransactionSpecifications() {}

    /**
     * The predicate for reporting: everything {@link #matching} selects, minus
     * transfer legs.
     *
     * <p>This is the exclusion F-01 calls the part that separates a real ledger
     * from a spreadsheet. Moving 500 from current to savings is not income of 500
     * and not expenditure of 500; counting it as either — and the naive sum
     * counts it as both — inflates the month by a thousand and reports a balance
     * change that never happened.
     *
     * <p>Deliberately a second named specification rather than a flag on the
     * filter. Which rows a *report* covers is not the caller's choice, and a
     * boolean parameter would eventually be passed the wrong way round.
     */
    public static Specification<Transaction> reporting(UUID userId, TransactionFilter filter) {
        return (root, query, cb) ->
                cb.and(
                        matching(userId, filter).toPredicate(root, query, cb),
                        cb.isFalse(root.get("transfer")));
    }

    public static Specification<Transaction> matching(UUID userId, TransactionFilter filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("userId"), userId));

            if (!filter.includeDeleted()) {
                predicates.add(cb.isNull(root.get("deletedAt")));
            }
            if (filter.from() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("occurredOn"), filter.from()));
            }
            if (filter.to() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("occurredOn"), filter.to()));
            }
            if (filter.type() != null) {
                predicates.add(cb.equal(root.get("type"), filter.type()));
            }
            if (filter.categoryId() != null) {
                predicates.add(cb.equal(root.get("category").get("id"), filter.categoryId()));
            }
            if (filter.accountId() != null) {
                predicates.add(cb.equal(root.get("accountId"), filter.accountId()));
            }
            if (filter.minAmount() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("amount"), filter.minAmount()));
            }
            if (filter.maxAmount() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("amount"), filter.maxAmount()));
            }
            if (filter.search() != null && !filter.search().isBlank()) {
                // Substring rather than full-text: the GIN index in V1 is there
                // for the Phase 7 search endpoint, and LIKE keeps the semantics
                // identical to the client-side filter it replaces.
                String pattern = "%" + filter.search().trim().toLowerCase() + "%";
                predicates.add(cb.like(cb.lower(root.get("description")), pattern));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
