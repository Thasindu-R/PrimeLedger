package com.primeledger.security;

import java.util.UUID;

/**
 * The single place the application asks "who is this request for?".
 *
 * <p>Every service filters by the value this returns, so Phase 3 swaps one
 * implementation — reading the {@code sub} claim off the validated Supabase JWT
 * and setting {@code app.user_id} for row-level security — without touching a
 * service or a repository.
 */
public interface CurrentUserProvider {

    UUID currentUserId();
}
