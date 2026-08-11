package com.primeledger.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The identity Hibernate stamps onto each connection.
 *
 * <p>The first test here pins down a bug that shipped and was caught only by
 * running the application: the resolver read the security context directly
 * instead of asking {@link CurrentUserProvider}, so under the fixed-user
 * provider it answered "anonymous" while the services answered "the development
 * user". Every query then ran against an empty database — no error, no failing
 * test, just an application that had quietly lost its data.
 */
class RlsTenantResolverTest {

    @Test
    @DisplayName("the fixed-user provider's identity reaches the connection")
    void usesFixedUserIdentity() {
        UUID devUser = UUID.fromString("00000000-0000-4000-8000-000000000001");
        var resolver = new RlsTenantResolver(() -> new FixedUserProvider(devUser));

        assertThat(resolver.resolveCurrentTenantIdentifier()).isEqualTo(devUser.toString());
    }

    @Test
    @DisplayName("no authenticated user resolves to anonymous, not to a guess")
    void anonymousWithoutIdentity() {
        var resolver = new RlsTenantResolver(JwtCurrentUserProvider::new);

        assertThat(resolver.resolveCurrentTenantIdentifier())
                .isEqualTo(RlsTenantResolver.ANONYMOUS);
    }

    @Test
    @DisplayName("RunAs overrides the request identity for background work")
    void runAsWins() {
        UUID batchUser = UUID.randomUUID();
        var resolver = new RlsTenantResolver(JwtCurrentUserProvider::new);

        RunAs.run(
                batchUser,
                () ->
                        assertThat(resolver.resolveCurrentTenantIdentifier())
                                .isEqualTo(batchUser.toString()));
    }

    @Test
    @DisplayName("a provider that is not available yet resolves to anonymous rather than failing")
    void toleratesMissingProvider() {
        // Connections are acquired during start-up for schema validation, before
        // the rest of the context exists.
        var resolver = new RlsTenantResolver(() -> null);

        assertThat(resolver.resolveCurrentTenantIdentifier())
                .isEqualTo(RlsTenantResolver.ANONYMOUS);
    }
}
