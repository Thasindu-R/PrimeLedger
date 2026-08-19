package com.primeledger.recurring;

import com.primeledger.category.Category;
import com.primeledger.common.Auditable;
import com.primeledger.transaction.TransactionType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A standing instruction to create a transaction on a schedule (F-03).
 *
 * <p>Template plus schedule. The template half is a transaction in every respect
 * except that it has not happened yet; the schedule half is {@link #frequency},
 * {@link #interval}, {@link #startsOn} and {@link #nextRunOn}.
 *
 * <p>What the rule is <em>not</em> is an owner of the transactions it creates.
 * Each generated row is a normal transaction — editable, deletable, and
 * severable from the rule — so a one-off rent increase is an edit to one
 * transaction rather than a change to the rule and a rewriting of history. The
 * foreign key back to here is {@code ON DELETE SET NULL} for the same reason:
 * deleting the instruction does not delete the record of what it already did.
 */
@Entity
@Table(name = "recurring_rules")
@Getter
@Setter
@NoArgsConstructor
public class RecurringRule extends Auditable {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    /** What the user calls it — "Rent", "Netflix". Not the description. */
    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    /** An association, because every response carries the category's name. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    // Translated to lower case by TransactionTypeConverter (autoApply).
    @Column(name = "type", nullable = false)
    private TransactionType type;

    @Column(name = "amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    // CHAR(3) in V1, which PostgreSQL reports as bpchar; without this Hibernate
    // expects varchar and fails validation on start-up.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "description")
    private String description;

    // Translated to lower case by FrequencyConverter (autoApply).
    @Column(name = "frequency", nullable = false)
    private Frequency frequency;

    /**
     * How many {@link #frequency} units between occurrences. The column is named
     * {@code interval} in V1 — a PostgreSQL type name, but a legal column name,
     * so it needs no quoting.
     */
    @Column(name = "interval", nullable = false)
    private int interval = 1;

    /**
     * The first occurrence, fixed at creation. Every later occurrence is
     * computed from it rather than from the one before, which is what keeps a
     * rule that starts on the 31st on the 31st (see {@link Frequency}).
     */
    @Column(name = "starts_on", nullable = false)
    private LocalDate startsOn;

    /** Where the schedule has got to: the next occurrence not yet materialised. */
    @Column(name = "next_run_on", nullable = false)
    private LocalDate nextRunOn;

    @Column(name = "ends_on")
    private LocalDate endsOn;

    /**
     * Paused, not deleted. A subscription taken on holiday comes back with its
     * schedule and its history intact, and the alternative — delete and recreate
     * — would sever every transaction it had already generated.
     */
    @Column(name = "is_paused", nullable = false)
    private boolean paused;

    @Column(name = "last_run_on")
    private LocalDate lastRunOn;

    /** True when this rule has an occurrence waiting to be materialised on {@code on}. */
    public boolean isDueOn(LocalDate on) {
        return !paused && !nextRunOn.isAfter(on) && !isFinished();
    }

    /**
     * True when the schedule has run past its end date and will never fire
     * again. Distinct from paused, which is reversible.
     */
    public boolean isFinished() {
        return endsOn != null && nextRunOn.isAfter(endsOn);
    }
}
