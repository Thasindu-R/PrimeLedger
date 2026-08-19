package com.primeledger.recurring;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecurringRuleRepository extends JpaRepository<RecurringRule, UUID> {

    /** Ownership is part of the lookup, never a check afterwards (§8.2). */
    Optional<RecurringRule> findByIdAndUserId(UUID id, UUID userId);

    @Query(
            """
            select r from RecurringRule r
            join fetch r.category
            where r.userId = :userId
            order by r.nextRunOn asc, r.name asc
            """)
    List<RecurringRule> findAllOwned(@Param("userId") UUID userId);

    boolean existsByUserIdAndNameIgnoreCase(UUID userId, String name);

    boolean existsByUserIdAndNameIgnoreCaseAndIdNot(UUID userId, String name, UUID id);

    long countByUserIdAndAccountId(UUID userId, UUID accountId);

    long countByUserIdAndCategoryId(UUID userId, UUID categoryId);

    /**
     * One user's rules with an occurrence waiting on {@code on}.
     *
     * <p>Ordered by {@code nextRunOn} so a catch-up run materialises a rule's
     * missed occurrences oldest-first, which is the order they would have been
     * created in had nothing gone wrong.
     */
    @Query(
            """
            select r from RecurringRule r
            join fetch r.category
            where r.userId = :userId
              and r.paused = false
              and r.nextRunOn <= :on
              and (r.endsOn is null or r.nextRunOn <= r.endsOn)
            order by r.nextRunOn asc, r.name asc
            """)
    List<RecurringRule> findDueFor(@Param("userId") UUID userId, @Param("on") LocalDate on);
}
