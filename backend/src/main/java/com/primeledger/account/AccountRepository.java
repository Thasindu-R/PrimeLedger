package com.primeledger.account;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    /**
     * Ownership is part of the lookup, never a check afterwards — that is what
     * makes "not found" and "someone else's" the same answer (proposal §8.2).
     */
    Optional<Account> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByIdAndUserId(UUID id, UUID userId);

    List<Account> findByUserIdOrderByNameAsc(UUID userId);

    List<Account> findByUserIdAndArchivedFalseOrderByNameAsc(UUID userId);

    boolean existsByUserIdAndNameIgnoreCaseAndIdNot(UUID userId, String name, UUID id);

    boolean existsByUserIdAndNameIgnoreCase(UUID userId, String name);

    /**
     * Net movement and live row count per account, in one pass (F-01).
     *
     * <p>Income adds and expense subtracts, which is all a balance is. Transfer
     * legs are deliberately not excluded: a transfer out is stored as an expense
     * on the source account and an income on the destination, so the plain sum
     * already moves the money correctly between them. It is only the *reporting*
     * totals that must ignore transfers, and those are computed elsewhere.
     *
     * <p>Native because the {@code case} is over the enum's stored text form,
     * which JPQL cannot express without naming the converter.
     */
    @Query(
            value =
                    """
                    select t.account_id                                                as accountId,
                           coalesce(sum(case when t.type = 'income' then t.amount
                                             else -t.amount end), 0)                   as movement,
                           count(*)                                                    as txnCount
                    from transactions t
                    where t.user_id = :userId
                      and t.deleted_at is null
                    group by t.account_id
                    """,
            nativeQuery = true)
    List<AccountMovement> movementsFor(@Param("userId") UUID userId);

    /** Projection for {@link #movementsFor}. */
    interface AccountMovement {
        UUID getAccountId();

        java.math.BigDecimal getMovement();

        long getTxnCount();
    }
}
