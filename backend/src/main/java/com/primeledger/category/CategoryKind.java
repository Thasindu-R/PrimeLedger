package com.primeledger.category;

/**
 * Whether a category classifies money coming in or going out. Mirrors the
 * {@code categories.kind} check constraint in V1.
 */
public enum CategoryKind {
    INCOME,
    EXPENSE
}
