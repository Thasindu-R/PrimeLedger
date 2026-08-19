package com.primeledger.recurring;

import com.primeledger.budget.BudgetEvaluator;
import com.primeledger.security.RunAs;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns due rules into transactions (F-03).
 *
 * <p>The idempotency the proposal asks for is a property of three things
 * together, and it is worth being explicit about which does what:
 *
 * <ul>
 *   <li>{@link RecurringRuleWriter} writes the transaction and advances the
 *       rule's cursor in one database transaction, so an interrupted run leaves
 *       neither half behind.
 *   <li>The cursor is caught up from wherever it actually is, so a night the job
 *       did not run is made good on the next one rather than skipped.
 *   <li>{@code idx_txn_rule_occurrence} makes a duplicate impossible even if the
 *       first two are defeated — by two containers running the sweep at the same
 *       moment, most plausibly.
 * </ul>
 *
 * <p>None of the three is redundant: the first is the mechanism, the second is
 * the requirement, and the third is what holds when a later change breaks one of
 * the others.
 */
@Service
public class RecurringMaterialiser {

    private static final Logger log = LoggerFactory.getLogger(RecurringMaterialiser.class);

    private final RecurringRuleRepository rules;
    private final RecurringDueRepository due;
    private final RecurringRuleWriter writer;
    private final BudgetEvaluator budgets;
    private final Clock clock;

    public RecurringMaterialiser(
            RecurringRuleRepository rules,
            RecurringDueRepository due,
            RecurringRuleWriter writer,
            BudgetEvaluator budgets,
            Clock clock) {
        this.rules = rules;
        this.due = due;
        this.writer = writer;
        this.budgets = budgets;
        this.clock = clock;
    }

    /**
     * The nightly run: every user with a rule due, brought up to today.
     *
     * <p>Each user is materialised inside {@link RunAs}, so the job reads and
     * writes their data through exactly the same row-level security policies a
     * request would. Enumerating the users is the one thing it cannot do that
     * way; see V7.
     *
     * @return how many transactions were created across all users
     */
    @Transactional(readOnly = true)
    public int sweep() {
        LocalDate today = LocalDate.now(clock);
        List<UUID> userIds = due.usersWithRulesDue(today);
        int created = 0;

        for (UUID userId : userIds) {
            try {
                created += RunAs.callUnchecked(userId, () -> materialiseFor(userId, today));
            } catch (RuntimeException e) {
                // One user's bad data must not stop the other users' run.
                log.warn("Recurring materialisation failed for user {}", userId, e);
            }
        }

        log.info(
                "Recurring sweep processed {} users, created {} transactions",
                userIds.size(),
                created);
        return created;
    }

    /**
     * Brings one user's rules up to {@code on}. Assumes an identity is already
     * established — a request's, or {@link RunAs}'s.
     *
     * @return how many transactions were created
     */
    public int materialiseFor(UUID userId, LocalDate on) {
        List<RecurringRule> dueRules = rules.findDueFor(userId, on);
        if (dueRules.isEmpty()) return 0;

        int created = 0;
        for (RecurringRule rule : dueRules) {
            try {
                created += writer.materialise(userId, rule.getId(), on);
            } catch (RuntimeException e) {
                // A category deleted between the read and the write, an account
                // archived, a constraint the template no longer satisfies. The
                // rule's own transaction has rolled back whole, cursor included,
                // so the next run retries it from where it was.
                log.warn("Recurring rule {} could not be materialised", rule.getId(), e);
            }
        }

        if (created > 0) {
            // Rent going out is exactly the kind of expense a budget is about,
            // and the user should hear that it took them over the line on the
            // morning it happened rather than after their next unrelated
            // purchase triggers the after-write path.
            budgets.evaluate(userId);
        }

        return created;
    }
}
