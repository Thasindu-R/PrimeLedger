package com.primeledger.account;

import com.primeledger.common.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A ledger account (F-01).
 *
 * <p>Phase 2 needed the entity because {@code transactions.account_id} is NOT
 * NULL and must point at a real row. Phase 4 added the read endpoint and default
 * provisioning for the same reason, one level up: a signed-up user with no
 * account cannot record anything. Balances, transfers and the rest of the
 * accounts API are Phase 5.
 */
@Entity
@Table(name = "accounts")
@Getter
@Setter
@NoArgsConstructor
public class Account extends Auditable {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "name", nullable = false)
    private String name;

    // Translated to lower snake case by AccountTypeConverter (autoApply).
    @Column(name = "type", nullable = false)
    private AccountType type;

    // CHAR(3) in V1, which PostgreSQL reports as bpchar; without this Hibernate
    // expects varchar and fails validation on start-up.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "opening_balance", nullable = false, precision = 15, scale = 2)
    private BigDecimal openingBalance = BigDecimal.ZERO;

    @Column(name = "colour")
    private String colour;

    @Column(name = "is_archived", nullable = false)
    private boolean archived;
}
