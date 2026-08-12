package com.primeledger.transaction;

import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * {@link JpaSpecificationExecutor} because the filter set is optional-by-nature
 * — a derived query per combination would be unmaintainable, and a JPQL string
 * full of {@code :param is null} branches defeats the index.
 */
public interface TransactionRepository
        extends JpaRepository<Transaction, UUID>, JpaSpecificationExecutor<Transaction> {

    /** Ownership is part of the lookup, so "not mine" and "not there" agree. */
    Optional<Transaction> findByIdAndUserId(UUID id, UUID userId);

    long countByUserIdAndCategoryId(UUID userId, UUID categoryId);

    /**
     * Bulk soft delete (proposal §8.1, {@code POST /transactions/bulk-delete}).
     *
     * @return how many rows were actually deleted, which is how the caller
     *     learns that some of the ids were not theirs
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            update Transaction t
               set t.deletedAt = :deletedAt
             where t.userId = :userId
               and t.id in :ids
               and t.deletedAt is null
            """)
    int softDeleteAll(
            @Param("userId") UUID userId,
            @Param("ids") Collection<UUID> ids,
            @Param("deletedAt") Instant deletedAt);

    /**
     * Expenditure per category over one date window, for the budget panel (F-02).
     *
     * <p>Grouped rather than one query per budget, because the dashboard shows
     * every budget at once and a query each would be an N+1 on the busiest
     * screen in the app.
     *
     * <p>Transfers are excluded, and so is anything without a category — which
     * since V5 is the same set of rows. Moving money to a savings account is not
     * spending it, and counting it against a budget would tell the user they had
     * blown a limit by saving.
     */
    @Query(
            """
            select t.category.id as categoryId, coalesce(sum(t.amount), 0) as spent
              from Transaction t
             where t.userId = :userId
               and t.deletedAt is null
               and t.transfer = false
               and t.type = :type
               and t.occurredOn between :from and :to
             group by t.category.id
            """)
    java.util.List<CategorySpend> spendByCategory(
            @Param("userId") UUID userId,
            @Param("type") TransactionType type,
            @Param("from") java.time.LocalDate from,
            @Param("to") java.time.LocalDate to);

    /** Projection for {@link #spendByCategory}. */
    interface CategorySpend {
        UUID getCategoryId();

        java.math.BigDecimal getSpent();
    }

    /**
     * Moves a category's transactions aside so the category can be deleted.
     *
     * <p>Native, because JPQL cannot assign through an association path
     * ({@code set t.category.id = ...}) and the alternative — loading every
     * affected row to set a field — is a needless N-row round trip.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            value =
                    """
                    update transactions
                       set category_id = :toCategoryId
                     where user_id = :userId
                       and category_id = :fromCategoryId
                    """,
            nativeQuery = true)
    int reassignCategory(
            @Param("userId") UUID userId,
            @Param("fromCategoryId") UUID fromCategoryId,
            @Param("toCategoryId") UUID toCategoryId);
}
