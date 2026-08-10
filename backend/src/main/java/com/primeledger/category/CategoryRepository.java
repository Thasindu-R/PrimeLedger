package com.primeledger.category;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    /**
     * The list every caller wants: this user's categories plus the system ones
     * (proposal §8.1, {@code GET /categories}).
     */
    @Query(
            """
            select c from Category c
            where c.userId = :userId or c.userId is null
            order by c.kind asc, c.sortOrder asc, lower(c.name) asc
            """)
    List<Category> findVisibleTo(@Param("userId") UUID userId);

    /** Visible means owned or system; either is a legal FK target. */
    @Query(
            """
            select c from Category c
            where c.id = :id and (c.userId = :userId or c.userId is null)
            """)
    Optional<Category> findVisibleById(@Param("id") UUID id, @Param("userId") UUID userId);

    /** Only a user's own categories can be written to. */
    Optional<Category> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndKindAndNameIgnoreCase(UUID userId, CategoryKind kind, String name);
}
