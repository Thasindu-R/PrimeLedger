package com.primeledger.budget;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BudgetRepository extends JpaRepository<Budget, UUID> {

    /** Ownership is part of the lookup, never a check afterwards (§8.2). */
    Optional<Budget> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndCategoryIdAndPeriodAndStartsOn(
            UUID userId, UUID categoryId, BudgetPeriod period, LocalDate startsOn);

    /**
     * The budget in force for each category on {@code on}.
     *
     * <p>One row per (category, period): the most recent one that had already
     * started. Rows dated into the future are excluded — a limit set for next
     * month must not change what this month reports — and superseded rows stay
     * in the table so past periods keep reporting against the limit that
     * actually applied.
     */
    @Query(
            """
            select b from Budget b
            join fetch b.category
            where b.userId = :userId
              and b.startsOn <= :on
              and b.startsOn = (
                  select max(prior.startsOn) from Budget prior
                  where prior.userId = b.userId
                    and prior.category = b.category
                    and prior.period = b.period
                    and prior.startsOn <= :on
              )
            order by b.category.name asc
            """)
    List<Budget> findEffectiveOn(@Param("userId") UUID userId, @Param("on") LocalDate on);

    List<Budget> findByUserIdOrderByStartsOnDescIdAsc(UUID userId);
}
