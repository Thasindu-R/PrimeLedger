package com.primeledger.security;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.function.Supplier;

/**
 * Runs a block of code as a given user when there is no HTTP request to take an
 * identity from.
 *
 * <p>Row-level security does not care that a thread is a scheduled job rather
 * than a request: with no {@code app.user_id} set, every statement it issues
 * sees zero rows and every insert is rejected. Background work therefore has to
 * say who it is acting for, explicitly, and that is what this class is for — the
 * development seeder today, the recurring-transaction materialiser in Phase 6.
 *
 * <p>It is deliberately not a way to escape RLS. There is no "run as everyone"
 * mode; a caller names one user and gets that user's view of the data, the same
 * one they would get through the API.
 */
public final class RunAs {

    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private RunAs() {}

    /** The user the current thread is impersonating, if any. */
    public static Optional<UUID> current() {
        return Optional.ofNullable(CURRENT.get());
    }

    public static <T> T call(UUID userId, Callable<T> work) throws Exception {
        UUID previous = CURRENT.get();
        CURRENT.set(userId);
        try {
            return work.call();
        } finally {
            // Restored rather than cleared: nesting should not silently drop the
            // outer identity, and a pooled thread must never leak one.
            if (previous == null) {
                CURRENT.remove();
            } else {
                CURRENT.set(previous);
            }
        }
    }

    /** {@link #call} for work that throws nothing checked, which is most of it. */
    public static <T> T callUnchecked(UUID userId, Supplier<T> work) {
        UUID previous = CURRENT.get();
        CURRENT.set(userId);
        try {
            return work.get();
        } finally {
            if (previous == null) {
                CURRENT.remove();
            } else {
                CURRENT.set(previous);
            }
        }
    }

    public static void run(UUID userId, Runnable work) {
        try {
            call(userId, () -> {
                work.run();
                return null;
            });
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Unexpected checked exception from RunAs.run", e);
        }
    }
}
