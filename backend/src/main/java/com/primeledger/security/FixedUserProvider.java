package com.primeledger.security;

import java.util.Optional;
import java.util.UUID;

/**
 * Phase 2 stand-in: every request is attributed to one configured user.
 *
 * <p>Phase 2 ships deliberately without authentication ("No auth yet, no
 * frontend wiring" — proposal §12), but the ownership column exists from V1 and
 * services must filter on it from the first line of code. Putting the lookup
 * behind {@link CurrentUserProvider} keeps that filtering real and testable
 * now, and makes the Phase 3 change a one-bean substitution.
 *
 * @see com.primeledger.config.CurrentUserConfig
 */
public class FixedUserProvider implements CurrentUserProvider {

    private final UUID userId;

    public FixedUserProvider(UUID userId) {
        this.userId = userId;
    }

    @Override
    public Optional<UUID> currentUserIdIfPresent() {
        // Always present, including on start-up threads — which is what lets the
        // development seeder and the RLS context work without a request.
        return Optional.of(userId);
    }
}
