package com.primeledger.recurring;

import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * The one question the nightly materialiser has to ask before it has an
 * identity: which users have a rule due at all.
 *
 * <p>Isolated in its own class for the same reason as {@code
 * BudgetSweepRepository} — it is the single call site of the {@code SECURITY
 * DEFINER} function added in V7, and an escape hatch that lives in one small
 * obvious class is one grep away rather than buried in a service that does five
 * other things.
 */
@Repository
public class RecurringDueRepository {

    private final EntityManager em;

    public RecurringDueRepository(EntityManager em) {
        this.em = em;
    }

    @SuppressWarnings("unchecked")
    public List<UUID> usersWithRulesDue(LocalDate on) {
        return em.createNativeQuery("select app_users_with_due_rules(:on)", UUID.class)
                .setParameter("on", on)
                .getResultList();
    }
}
