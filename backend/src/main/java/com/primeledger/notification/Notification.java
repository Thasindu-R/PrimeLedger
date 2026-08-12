package com.primeledger.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One thing worth telling the user about (V4). */
@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    // Translated to lower snake case by NotificationKindConverter (autoApply).
    @Column(name = "kind", nullable = false)
    private NotificationKind kind;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "body", nullable = false)
    private String body;

    /**
     * The three columns that together identify a budget threshold event. V4 has
     * a unique index over them, which is what makes emission idempotent: the
     * evaluator can run after every write and nightly without the bell filling
     * up with the same alert.
     */
    @Column(name = "budget_id")
    private UUID budgetId;

    @Column(name = "period_start")
    private LocalDate periodStart;

    @Column(name = "threshold")
    private Short threshold;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    public boolean isRead() {
        return readAt != null;
    }
}
