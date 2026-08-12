package com.primeledger.notification;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, Limit limit);

    Optional<Notification> findByIdAndUserId(UUID id, UUID userId);

    long countByUserIdAndReadAtIsNull(UUID userId);

    /**
     * Has this exact threshold crossing already been reported?
     *
     * <p>A pre-check, not the guarantee. The unique index in V4 is the
     * guarantee; this only keeps the ordinary case — the evaluator running for
     * the hundredth time on an unchanged budget — from provoking a constraint
     * violation and rolling back a transaction to learn something it could have
     * read.
     */
    boolean existsByUserIdAndBudgetIdAndPeriodStartAndThreshold(
            UUID userId, UUID budgetId, java.time.LocalDate periodStart, Short threshold);

    /** Marks everything unread as read in one statement, rather than N updates. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            update Notification n set n.readAt = :now
            where n.userId = :userId and n.readAt is null
            """)
    int markAllRead(@Param("userId") UUID userId, @Param("now") Instant now);
}
