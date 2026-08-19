package com.primeledger.budget;

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
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A spending limit for one category over one repeating period (F-02).
 *
 * <p>{@link #startsOn} is what makes a budget period-scoped rather than
 * absolute. A row says "from this date, the limit for this category is this
 * much", and the limit in force on any given day is the latest row that had
 * started by then. Raising August's grocery budget therefore leaves July's
 * reported position exactly as it was — the proposal's requirement that changing
 * a limit next month does not rewrite history.
 */
@Entity
@Table(name = "budgets")
@Getter
@Setter
@NoArgsConstructor
public class Budget extends Auditable {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    /** An association, because every response carries the category's name. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    // Translated to lower case by BudgetPeriodConverter (autoApply).
    @Column(name = "period", nullable = false)
    private BudgetPeriod period;

    @Column(name = "limit_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal limitAmount;

    /**
     * What {@link #limitAmount} is denominated in (V8).
     *
     * <p>Fixed at creation. Spending is converted into this for comparison,
     * rather than the limit being converted into anything — so a user who
     * changes the currency they report in still has a grocery budget that means
     * what it meant when they set it.
     */
    // CHAR(3) in V8, which PostgreSQL reports as bpchar; without this Hibernate
    // expects varchar and fails validation on start-up.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "starts_on", nullable = false)
    private LocalDate startsOn;
}
