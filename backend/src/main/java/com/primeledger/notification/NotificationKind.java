package com.primeledger.notification;

/** Mirrors the {@code notifications.kind} check constraint in V4. */
public enum NotificationKind {
    /** A budget crossed 80% or 100% of its limit for a period (F-02). */
    BUDGET_THRESHOLD
}
