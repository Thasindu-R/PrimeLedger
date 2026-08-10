package com.primeledger.account;

/**
 * Mirrors the {@code accounts.type} check constraint in V1. Stored lower snake
 * case by {@link AccountTypeConverter}.
 */
public enum AccountType {
    CHECKING,
    SAVINGS,
    CASH,
    CREDIT_CARD,
    INVESTMENT
}
