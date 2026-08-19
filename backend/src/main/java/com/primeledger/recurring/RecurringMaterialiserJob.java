package com.primeledger.recurring;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs the recurring materialiser once a night (F-03).
 *
 * <p>Off by default outside production-like profiles, for the same reason as the
 * budget sweep: a scheduler firing inside every integration test would make the
 * suite depend on the wall clock, which is the fastest way to a flaky build.
 */
@Component
@ConditionalOnProperty(
        name = "primeledger.recurring.sweep.enabled",
        havingValue = "true",
        matchIfMissing = true)
public class RecurringMaterialiserJob {

    private static final Logger log = LoggerFactory.getLogger(RecurringMaterialiserJob.class);

    private final RecurringMaterialiser materialiser;

    public RecurringMaterialiserJob(RecurringMaterialiser materialiser) {
        this.materialiser = materialiser;
    }

    /**
     * 01:30, half an hour before the budget sweep. The ordering is deliberate:
     * transactions generated tonight should be counted by tonight's budget
     * evaluation rather than tomorrow's. The materialiser also evaluates budgets
     * for any user it wrote for, so the two are belt and braces rather than a
     * dependency — a change to either cron is safe.
     */
    @Scheduled(cron = "${primeledger.recurring.sweep.cron:0 30 1 * * *}")
    public void run() {
        try {
            materialiser.sweep();
        } catch (RuntimeException e) {
            // A scheduled method that throws is silently not rescheduled by some
            // executors; swallowing here keeps tomorrow's run alive.
            log.error("Recurring sweep failed", e);
        }
    }
}
