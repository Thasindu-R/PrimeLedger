package com.primeledger.transaction;

/**
 * Mirrors the {@code transactions.type} check constraint in V1.
 *
 * <p>Kept as a check constraint rather than a native PostgreSQL enum so a new
 * value is a data change, not a type migration (proposal §7.3).
 */
public enum TransactionType {
    INCOME,
    EXPENSE
}
