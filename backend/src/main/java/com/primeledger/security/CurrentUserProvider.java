package com.primeledger.security;

import java.util.Optional;
import java.util.UUID;

/**
 * The single place the application asks "who is this request for?".
 *
 * <p>Every service filters by the value this returns, and the row-level security
 * context is set from it, so swapping the implementation swaps the identity
 * everywhere without touching a service or a repository.
 */
public interface CurrentUserProvider {

    /**
     * The current user, or empty when there is none — an unauthenticated request,
     * or a start-up thread.
     *
     * <p>This is the variant the RLS plumbing uses, because "nobody" is a normal
     * state there rather than an error: a connection with no identity simply sees
     * no rows.
     */
    Optional<UUID> currentUserIdIfPresent();

    /**
     * The current user, or a failure. For call sites that cannot proceed without
     * one, which is every service method.
     */
    default UUID currentUserId() {
        return currentUserIdIfPresent()
                .orElseThrow(
                        () ->
                                new IllegalStateException(
                                        "No authenticated user on this thread. An endpoint that reads the "
                                                + "current user is reachable without authentication — check "
                                                + "SecurityConfig."));
    }
}
