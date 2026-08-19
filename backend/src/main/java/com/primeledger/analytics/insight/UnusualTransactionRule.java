package com.primeledger.analytics.insight;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * "This LKR 45,000 transaction is 3.2× your usual Shopping expense" (F-07).
 *
 * <p>Measured against the mean single expense in that category over the trailing
 * window, not against the category's total and not against all spending. A large
 * grocery shop and a large rent payment are not comparable events, and comparing
 * either to the ledger-wide average would flag rent every month for ever.
 */
@Component
public class UnusualTransactionRule implements InsightRule {

    /** How many times the usual before it is worth mentioning. */
    private static final BigDecimal MULTIPLE = new BigDecimal("2.5");

    /**
     * A mean drawn from fewer than this many transactions is not a habit, it is
     * an anecdote — and comparing against it produces confident nonsense on any
     * category the user has barely used.
     */
    private static final long MIN_HISTORY = 3;

    /** One. The panel is a summary, and the largest outlier is the interesting one. */
    @Override
    public List<Insight> evaluate(InsightContext context) {
        return context.largestThisMonth().stream()
                .map(expense -> assess(expense, context))
                .flatMap(Optional::stream)
                .findFirst()
                .map(List::of)
                .orElseGet(List::of);
    }

    private Optional<Insight> assess(
            InsightContext.LargeExpense expense, InsightContext context) {

        BigDecimal usual = context.trailingMean().get(expense.categoryId());
        if (usual == null || usual.signum() <= 0) return Optional.empty();

        InsightContext.CategoryFigure history = context.lastMonth().get(expense.categoryId());
        if (history != null && history.count() < MIN_HISTORY) return Optional.empty();

        BigDecimal threshold = usual.multiply(MULTIPLE);
        if (expense.amount().compareTo(threshold) < 0) return Optional.empty();

        BigDecimal ratio = expense.amount().divide(usual, 1, RoundingMode.HALF_UP);

        String what =
                expense.description() == null || expense.description().isBlank()
                        ? "A %s transaction".formatted(expense.categoryName())
                        : "\"%s\"".formatted(expense.description());

        return Optional.of(
                new Insight(
                        InsightKind.UNUSUAL_TRANSACTION,
                        InsightTone.WARNING,
                        "Unusually large %s expense".formatted(expense.categoryName()),
                        "%s came to %s — about %s× your usual %s expense."
                                .formatted(
                                        what,
                                        InsightFormat.prose(expense.amount(), context.currency()),
                                        ratio.stripTrailingZeros().toPlainString(),
                                        expense.categoryName()),
                        expense.transactionId(),
                        expense.categoryName(),
                        InsightFormat.exact(expense.amount()),
                        null));
    }
}
