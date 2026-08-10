package com.primeledger.common;

import java.util.List;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Bounds what a caller may ask for on a paginated endpoint.
 *
 * <p>{@code ?sort=} names a JPA property, so accepting it unchecked lets a
 * caller order by anything reachable from the entity graph — unindexed columns,
 * associations that force a join, fields that are none of their business. And
 * an unbounded {@code ?size=} turns one request into a full table read.
 */
public final class Pagination {

    public static final int MAX_PAGE_SIZE = 200;
    public static final int DEFAULT_PAGE_SIZE = 50;

    private Pagination() {}

    /**
     * @param sortable the properties this endpoint permits ordering by
     * @param fallback applied when the caller asked for no ordering, or only for
     *     ones that were rejected
     * @throws ApiException with VALIDATION_FAILED if a requested property is not
     *     permitted — silently ignoring it would return data in an order the
     *     caller did not ask for and has no way to notice
     */
    public static Pageable sanitise(Pageable requested, Set<String> sortable, Sort fallback) {
        int size = Math.min(Math.max(requested.getPageSize(), 1), MAX_PAGE_SIZE);
        int page = Math.max(requested.getPageNumber(), 0);

        List<Sort.Order> rejected =
                requested.getSort().stream()
                        .filter(order -> !sortable.contains(order.getProperty()))
                        .toList();
        if (!rejected.isEmpty()) {
            throw ApiException.validation(
                    "Cannot sort by %s. Sortable fields: %s"
                            .formatted(
                                    rejected.stream().map(Sort.Order::getProperty).toList(),
                                    sortable.stream().sorted().toList()));
        }

        Sort sort = requested.getSort().isSorted() ? requested.getSort() : fallback;
        return PageRequest.of(page, size, sort);
    }
}
