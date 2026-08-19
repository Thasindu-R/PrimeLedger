package com.primeledger.analytics.insight;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;

/** Shared number formatting for the sentences the rules write. */
final class InsightFormat {

    /**
     * Grouped and rounded to whole units for prose. "You have spent LKR 12,400"
     * reads as an observation; "LKR 12,437.19" reads as a receipt, and the extra
     * precision is noise in a sentence whose whole point is the comparison.
     * The exact figure travels in the structured {@code amount} field.
     */
    private static final ThreadLocal<DecimalFormat> GROUPED =
            ThreadLocal.withInitial(() -> new DecimalFormat("#,##0"));

    private InsightFormat() {}

    static String prose(BigDecimal amount, String currency) {
        return "%s %s".formatted(currency, GROUPED.get().format(amount.setScale(0, RoundingMode.HALF_UP)));
    }

    /** The exact value, for the structured field the client may re-render. */
    static String exact(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    /** A signed percentage rounded to one place, for both prose and the field. */
    static double percent(BigDecimal from, BigDecimal to) {
        if (from.signum() == 0) return 0;
        return to.subtract(from)
                .multiply(BigDecimal.valueOf(100))
                .divide(from.abs(), 1, RoundingMode.HALF_UP)
                .doubleValue();
    }
}
