package com.primeledger.currency;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Fetches the day's exchange rates (F-05).
 *
 * <p>Off by default outside production-like profiles, for the same reason as the
 * other two schedulers — but with an extra one here: an integration test that
 * fired this would depend on a third-party HTTP service being up, which is not a
 * property a test suite should have.
 */
@Component
@ConditionalOnProperty(
        name = "primeledger.fx.job.enabled",
        havingValue = "true",
        matchIfMissing = true)
public class FxRateJob {

    private static final Logger log = LoggerFactory.getLogger(FxRateJob.class);

    private final FxRateService rates;

    public FxRateJob(FxRateService rates) {
        this.rates = rates;
    }

    /**
     * 03:00, after both ledger jobs. Nothing depends on the ordering — the rates
     * fetched tonight are for today and every conversion is historical anyway —
     * but a job that writes to a table nothing else is touching is the cheapest
     * one to run last.
     *
     * <p>The European Central Bank publishes once a working day, mid-afternoon
     * CET, so a nightly fetch always finds the current day's figures rather than
     * racing them.
     */
    @Scheduled(cron = "${primeledger.fx.job.cron:0 0 3 * * *}")
    public void run() {
        try {
            rates.refresh();
        } catch (RuntimeException e) {
            // A scheduled method that throws is silently not rescheduled by some
            // executors; swallowing here keeps tomorrow's run alive.
            log.error("Exchange-rate refresh failed", e);
        }
    }

    /**
     * How much history a fresh database is given, in years.
     *
     * <p>Two, matching the furthest back a recurring rule may be dated. A ledger
     * older than that converts its oldest rows at the earliest rate held, which
     * is wrong by however much the currency moved before then — visible, bounded
     * and far better than the alternative of not converting them at all.
     */
    private static final int BACKFILL_YEARS = 2;

    /**
     * A first fetch on start-up, but only into an empty table.
     *
     * <p>History, not just today. Conversion uses the rate on each
     * transaction's own date, so a table holding only this morning's rates
     * converts nothing that happened before this morning — the whole existing
     * ledger comes back understated, and an honest report of a real limitation
     * is indistinguishable from a bug at first glance.
     *
     * <p>The emptiness check is what keeps this from being a second scheduler: a
     * restart at noon on a database that already has rates does nothing at all.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void backfillOnFirstStart() {
        try {
            if (!rates.isEmpty()) return;

            log.info("No exchange rates stored; fetching {} years of history", BACKFILL_YEARS);
            if (rates.backfill(BACKFILL_YEARS) == 0) {
                // The time-series request is the one most likely to be refused
                // or truncated by a free provider. Today's rates alone are worth
                // having, and the nightly job will keep them current.
                rates.refresh();
            }
        } catch (RuntimeException e) {
            log.warn("Initial exchange-rate fetch failed; the nightly job will retry", e);
        }
    }
}
