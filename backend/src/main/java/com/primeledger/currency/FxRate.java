package com.primeledger.currency;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One published exchange rate on one day (F-05).
 *
 * <p>The one table in the schema with no {@code user_id} and no row-level
 * security policy, deliberately: an exchange rate is a public fact, identical
 * for every user, and giving it an owner would mean storing the same number once
 * per account holder (§7.4).
 *
 * <p>{@code NUMERIC(18,8)} rather than the {@code (15,2)} used for money. A rate
 * is not an amount — LKR against EUR runs to hundreds, JPY against EUR to
 * fractions, and two decimal places would round a Japanese yen conversion into
 * uselessness.
 */
@Entity
@Table(name = "fx_rates")
@Getter
@Setter
@NoArgsConstructor
public class FxRate {

    @EmbeddedId private Id id;

    @Column(name = "rate", nullable = false, precision = 18, scale = 8)
    private BigDecimal rate;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    public FxRate(Id id, BigDecimal rate) {
        this.id = id;
        this.rate = rate;
    }

    /** The natural key: what, against what, when. */
    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    public static class Id implements Serializable {

        private static final long serialVersionUID = 1L;

        // CHAR(3) in V1, which PostgreSQL reports as bpchar; without this
        // Hibernate expects varchar and fails validation on start-up.
        @JdbcTypeCode(SqlTypes.CHAR)
        @Column(name = "base", nullable = false, length = 3)
        private String base;

        @JdbcTypeCode(SqlTypes.CHAR)
        @Column(name = "quote", nullable = false, length = 3)
        private String quote;

        @Column(name = "rate_date", nullable = false)
        private LocalDate rateDate;

        public Id(String base, String quote, LocalDate rateDate) {
            this.base = base;
            this.quote = quote;
            this.rateDate = rateDate;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof Id id)) return false;
            return Objects.equals(base, id.base)
                    && Objects.equals(quote, id.quote)
                    && Objects.equals(rateDate, id.rateDate);
        }

        @Override
        public int hashCode() {
            return Objects.hash(base, quote, rateDate);
        }
    }
}
