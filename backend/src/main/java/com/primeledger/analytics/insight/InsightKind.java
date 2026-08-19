package com.primeledger.analytics.insight;

/**
 * The observations the engine can make (F-07, FR-30).
 *
 * <p>An enum rather than a free string because the client renders each kind
 * differently — an icon, a colour, and in two cases a link to the thing being
 * talked about. Matching on prose would break the first time a rule's wording
 * was improved.
 */
public enum InsightKind {
    /** A category moved sharply against last month. */
    CATEGORY_SHIFT,
    /** One transaction is far larger than that category's usual. */
    UNUSUAL_TRANSACTION,
    /** Spending so far this month, extrapolated to month end. */
    MONTH_END_PROJECTION,
    /** Savings rate moving over the trailing window. */
    SAVINGS_RATE_TREND
}
