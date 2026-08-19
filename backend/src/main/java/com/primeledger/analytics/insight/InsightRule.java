package com.primeledger.analytics.insight;

import java.util.List;

/**
 * One observation the engine knows how to make (F-07).
 *
 * <p>Deliberately rule-based rather than learned. At this scale a model would be
 * worse on every axis that matters here: a rule can be read, argued with,
 * unit-tested against fixed numbers, and — when a user asks why the app said
 * their spending is up — explained in the same sentence it was computed in.
 *
 * <p>Returning a list rather than an Optional because two rules genuinely have
 * more than one thing to say: several categories can move sharply in the same
 * month.
 */
public interface InsightRule {

    List<Insight> evaluate(InsightContext context);
}
