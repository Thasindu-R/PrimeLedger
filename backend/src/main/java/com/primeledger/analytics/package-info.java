/**
 * Read-side aggregation: summary, timeseries, category breakdown and insights.
 * Queries here are the ones that need indexes; they do not mutate state.
 *
 * <p>Proposal §6.3. Summary, timeseries and breakdown arrive in Phase 4 when the
 * dashboard starts reading from the server; the insights rules engine (F-07) in
 * Phase 7.
 */
package com.primeledger.analytics;
