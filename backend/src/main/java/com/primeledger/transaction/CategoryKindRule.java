package com.primeledger.transaction;

import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.common.ApiException;

/**
 * An expense may only be filed under an expense category, and income under an
 * income one.
 *
 * <p>Extracted from {@code TransactionService} when Phase 6 gave recurring rules
 * the same template fields and therefore the same rule to enforce. Two copies
 * would not have stayed identical — the second would have kept the check and
 * lost the message, or vice versa — and this is exactly the drift D-01 was
 * about, one level up again.
 *
 * <p>The database cannot express it: the constraint spans two tables and depends
 * on which of them is being written.
 */
public final class CategoryKindRule {

    private CategoryKindRule() {}

    /** The category kind a transaction of this type has to be filed under. */
    public static CategoryKind requiredFor(TransactionType type) {
        return type == TransactionType.INCOME ? CategoryKind.INCOME : CategoryKind.EXPENSE;
    }

    /**
     * @param subject what the caller is creating, for the message — "transaction"
     *     or "recurring rule". The rest of the sentence is identical either way.
     */
    public static void requireMatches(Category category, TransactionType type, String subject) {
        if (category.getKind() == requiredFor(type)) {
            return;
        }

        String categoryKind = category.getKind().name().toLowerCase();
        String transactionKind = type.name().toLowerCase();

        throw ApiException.businessRule(
                "Category '%s' is %s %s category and cannot be used for %s %s %s"
                        .formatted(
                                category.getName(),
                                article(categoryKind),
                                categoryKind,
                                article(transactionKind),
                                transactionKind,
                                subject));
    }

    /**
     * "a expense" reads as a bug in the product to anyone who sees it, and this
     * message is user-facing. Only ever applied to the two kind names, so a vowel
     * check is the whole rule rather than an approximation of one.
     */
    private static String article(String word) {
        return "aeiou".indexOf(word.charAt(0)) >= 0 ? "an" : "a";
    }
}
