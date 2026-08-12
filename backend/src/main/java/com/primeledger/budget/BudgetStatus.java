package com.primeledger.budget;

import java.math.BigDecimal;

/**
 * Where a budget stands, as the progress bar colours it (F-02): green, amber at
 * 80%, red at 100%.
 *
 * <p>The thresholds live here rather than in the UI because the notification
 * evaluator uses the same numbers, and a bar that turns amber at a different
 * point from the alert that fires would be two sources of truth disagreeing in
 * front of the user.
 */
public enum BudgetStatus {
    OK,
    WARNING,
    EXCEEDED;

    public static final short WARNING_THRESHOLD = 80;
    public static final short EXCEEDED_THRESHOLD = 100;

    public static BudgetStatus of(double percentUsed) {
        if (percentUsed >= EXCEEDED_THRESHOLD) return EXCEEDED;
        if (percentUsed >= WARNING_THRESHOLD) return WARNING;
        return OK;
    }

    /**
     * Percentage of the limit used, uncapped.
     *
     * <p>Not clamped to 100: "you are at 340% of your dining budget" is the fact
     * the user needs, and clamping it would hide the difference between slightly
     * over and catastrophically over.
     */
    public static double percentUsed(BigDecimal spent, BigDecimal limit) {
        if (limit.signum() <= 0) return 0;
        return spent.doubleValue() / limit.doubleValue() * 100.0;
    }
}
