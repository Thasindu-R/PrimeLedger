package com.primeledger.transaction;

import com.primeledger.category.Category;
import com.primeledger.common.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A single ledger entry (proposal §7.2).
 *
 * <p>Amount is {@link BigDecimal} against a {@code NUMERIC(15,2)} column and is
 * never a float, anywhere, at any point. It crosses the wire as a decimal
 * string for the same reason (§7.3).
 *
 * <p>Deletes are soft: {@link #deletedAt} is set and every read filters it out,
 * which is what makes {@code POST /transactions/{id}/restore} possible.
 */
@Entity
@Table(name = "transactions")
@Getter
@Setter
@NoArgsConstructor
public class Transaction extends Auditable {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    /**
     * Loaded lazily and mapped as an association because the response carries
     * the category's name; the rest of the foreign keys are plain UUIDs until a
     * later phase gives them behaviour.
     *
     * <p>Null on a transfer leg, and only on a transfer leg — V5 has a check
     * constraint tying the two together. Moving your own money between your own
     * accounts has no category, and inventing one for it would put a fake row in
     * every picker, breakdown and budget (see V5 for why).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(name = "recurring_rule_id")
    private UUID recurringRuleId;

    @Column(name = "type", nullable = false)
    private TransactionType type;

    @Column(name = "amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    // CHAR(3) in V1, which PostgreSQL reports as bpchar; without this Hibernate
    // expects varchar and fails validation on start-up.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @Column(name = "description")
    private String description;

    @Column(name = "is_transfer", nullable = false)
    private boolean transfer;

    @Column(name = "transfer_pair_id")
    private UUID transferPairId;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public boolean isDeleted() {
        return deletedAt != null;
    }
}
