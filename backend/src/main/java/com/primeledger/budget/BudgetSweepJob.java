package com.primeledger.budget;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs the budget sweep once a night (F-02).
 *
 * <p>Off by default outside production-like profiles: a scheduler firing inside
 * every integration test would make the suite depend on the wall clock, which
 * is the fastest way to a flaky build.
 */
@Component
@ConditionalOnProperty(
        name = "primeledger.budgets.sweep.enabled",
        havingValue = "true",
        matchIfMissing = true)
public class BudgetSweepJob {

    private static final Logger log = LoggerFactory.getLogger(BudgetSweepJob.class);

    private final BudgetEvaluator evaluator;

    public BudgetSweepJob(BudgetEvaluator evaluator) {
        this.evaluator = evaluator;
    }

    /**
     * 02:00 in the server's zone. Late enough that a transaction entered late in
     * the evening is included, early enough to be done before anyone looks.
     */
    @Scheduled(cron = "${primeledger.budgets.sweep.cron:0 0 2 * * *}")
    public void run() {
        try {
            evaluator.sweep();
        } catch (RuntimeException e) {
            // A scheduled method that throws is silently not rescheduled by some
            // executors; swallowing here keeps tomorrow's run alive.
            log.error("Budget sweep failed", e);
        }
    }
}
