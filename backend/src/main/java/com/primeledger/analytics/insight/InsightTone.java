package com.primeledger.analytics.insight;

/**
 * How an observation should read (F-07).
 *
 * <p>Separate from {@link InsightKind} because the same rule produces both: a
 * category being down 40% is {@link #GOOD}, up 40% is {@link #WARNING}, and the
 * client should not have to re-derive that from a signed number to pick a
 * colour. It is also the sort order — a user scanning four observations should
 * meet the one that costs them money first.
 */
public enum InsightTone {
    WARNING,
    NEUTRAL,
    GOOD
}
