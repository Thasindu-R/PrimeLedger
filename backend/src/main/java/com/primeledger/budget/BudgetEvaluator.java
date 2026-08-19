package com.primeledger.budget;

import com.primeledger.notification.NotificationService;
import com.primeledger.security.RunAs;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.UnexpectedRollbackException;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns budget positions into notifications (F-02).
 *
 * <p>Runs after every write that could move a budget, and again on a nightly
 * sweep. Running that often is only safe because emission is idempotent: the
 * unique index in V4 means the second and subsequent detections of the same
 * crossing insert nothing, so the bell gets one "Groceries is over budget" for
 * August however many times August is evaluated.
 */
@Service
public class BudgetEvaluator {

    private static final Logger log = LoggerFactory.getLogger(BudgetEvaluator.class);

    private static final DateTimeFormatter PERIOD_LABEL =
            DateTimeFormatter.ofPattern("MMMM yyyy");

    private final BudgetService budgets;
    private final BudgetSweepRepository sweep;
    private final NotificationService notifications;
    private final com.primeledger.security.CurrentUserProvider currentUser;
    private final Clock clock;

    public BudgetEvaluator(
            BudgetService budgets,
            BudgetSweepRepository sweep,
            NotificationService notifications,
            com.primeledger.security.CurrentUserProvider currentUser,
            Clock clock) {
        this.budgets = budgets;
        this.sweep = sweep;
        this.notifications = notifications;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    /**
     * Evaluates the current caller's budgets, swallowing any failure.
     *
     * <p>For call sites where the alert is a side effect of an operation the user
     * asked for something else from — creating a budget, saving a transaction.
     * The thing they asked for has already succeeded by this point, and failing
     * it now to report a notification problem would be the wrong trade.
     */
    public void evaluateQuietly() {
        try {
            evaluate(currentUser.currentUserId());
        } catch (RuntimeException e) {
            log.warn("Budget evaluation failed", e);
        }
    }

    /**
     * Evaluates one user's budgets and emits any threshold not yet reported.
     *
     * @return how many notifications were actually created
     */
    @Transactional
    public int evaluate(UUID userId) {
        LocalDate today = LocalDate.now(clock);
        int emitted = 0;

        for (BudgetService.Position position : budgets.positionsOn(userId, today)) {
            emitted += emitFor(userId, position);
        }
        return emitted;
    }

    private int emitFor(UUID userId, BudgetService.Position position) {
        // Only the highest threshold crossed. Jumping from 40% to 140% in one
        // transaction should say "over budget", not queue up a warning that was
        // already obsolete when it was written.
        short threshold;
        if (position.status() == BudgetStatus.EXCEEDED) {
            threshold = BudgetStatus.EXCEEDED_THRESHOLD;
        } else if (position.status() == BudgetStatus.WARNING) {
            threshold = BudgetStatus.WARNING_THRESHOLD;
        } else {
            return 0;
        }

        Budget budget = position.budget();
        String category = budget.getCategory().getName();
        String period = PERIOD_LABEL.format(position.periodStart());

        String title =
                threshold == BudgetStatus.EXCEEDED_THRESHOLD
                        ? "%s is over budget".formatted(category)
                        : "%s is nearly over budget".formatted(category);

        // The currency is named because it no longer has to be the one the user
        // reads everything else in: a budget carries its own since V8, and "you
        // have spent 48,000 of your 50,000 limit" is ambiguous the moment two
        // currencies are in play.
        String body =
                "You have spent %s %s of your %s limit for %s."
                        .formatted(
                                budget.getCurrency(),
                                money(position.spent()),
                                money(budget.getLimitAmount()),
                                period);

        // The ordinary case: this budget was already at 85% the last hundred
        // times it was evaluated, and the user has been told once.
        if (notifications.alreadyReported(
                userId, budget.getId(), position.periodStart(), threshold)) {
            return 0;
        }

        try {
            notifications.emitBudgetThreshold(
                    userId, budget.getId(), position.periodStart(), threshold, title, body);
            return 1;
        } catch (DataIntegrityViolationException | UnexpectedRollbackException raced) {
            // Two evaluations of the same crossing at once — an after-write call
            // and the nightly sweep, say. The unique index in V4 let exactly one
            // of them through, which is the guarantee doing its job. Caught here,
            // outside the emitting transaction, because inside it the transaction
            // is already doomed.
            log.debug(
                    "Budget {} was already alerted at {}% for period starting {}",
                    budget.getId(), threshold, position.periodStart());
            return 0;
        }
    }

    /**
     * The nightly sweep.
     *
     * <p>Catches what the after-write path cannot: a period that has rolled over,
     * and any evaluation that was skipped because the process restarted
     * mid-request — free-tier containers do restart.
     *
     * <p>Each user is evaluated inside {@link RunAs}, so the sweep reads their
     * data through exactly the same row-level security policies a request would.
     * Enumerating the users is the one thing it cannot do that way; see V6.
     */
    @Transactional(readOnly = true)
    public int sweep() {
        List<UUID> userIds = sweep.usersWithBudgets();
        int emitted = 0;

        for (UUID userId : userIds) {
            try {
                emitted += RunAs.callUnchecked(userId, () -> evaluate(userId));
            } catch (RuntimeException e) {
                // One user's bad data must not stop the other users' sweep.
                log.warn("Budget sweep failed for user {}", userId, e);
            }
        }

        log.info("Budget sweep evaluated {} users, emitted {} notifications", userIds.size(), emitted);
        return emitted;
    }

    private static String money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
