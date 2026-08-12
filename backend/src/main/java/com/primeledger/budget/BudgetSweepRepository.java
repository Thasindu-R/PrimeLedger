package com.primeledger.budget;

import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * The one query the nightly sweep needs and row-level security will not give it:
 * which users have budgets at all.
 *
 * <p>Isolated in its own class on purpose. It is the single call site of the
 * {@code SECURITY DEFINER} function added in V6, and keeping it here means the
 * escape hatch is one grep away rather than buried in a service that does five
 * other things.
 */
@Repository
public class BudgetSweepRepository {

    private final EntityManager em;

    public BudgetSweepRepository(EntityManager em) {
        this.em = em;
    }

    @SuppressWarnings("unchecked")
    public List<UUID> usersWithBudgets() {
        return em.createNativeQuery("select app_users_with_budgets()", UUID.class).getResultList();
    }
}
