package com.primeledger.account;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    /**
     * Ownership is part of the lookup, never a check afterwards — that is what
     * makes "not found" and "someone else's" the same answer (proposal §8.2).
     */
    Optional<Account> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByIdAndUserId(UUID id, UUID userId);

    List<Account> findByUserIdOrderByNameAsc(UUID userId);
}
