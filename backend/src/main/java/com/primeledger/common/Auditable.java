package com.primeledger.common;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * created_at / updated_at for every owned entity (proposal §6.3).
 *
 * <p>The database carries the same defaults and an updated_at trigger. That
 * overlap is deliberate: Hibernate keeps the in-memory entity correct without a
 * re-read, and the trigger keeps the row correct for writes that never go
 * through JPA — a Flyway data migration, or psql.
 */
@MappedSuperclass
@Getter
@Setter
public abstract class Auditable {

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
