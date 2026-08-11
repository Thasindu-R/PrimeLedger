package com.primeledger.security;

import java.util.function.Supplier;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;

/**
 * Tells Hibernate which user a connection is about to be used for.
 *
 * <p>Hibernate's multi-tenancy hook is being used here for its plumbing rather
 * than its usual purpose: there is one database and one schema, and the
 * "tenant" is simply the current user id, which {@link RlsConnectionProvider}
 * turns into {@code app.user_id} on the connection. It is the one place
 * Hibernate offers that runs on every connection acquisition, which is exactly
 * the granularity RLS needs.
 *
 * <p>The identity comes from {@link CurrentUserProvider} rather than being read
 * out of the security context directly. That indirection is not decoration — it
 * is what keeps the row filter and the application's own {@code WHERE user_id =
 * ?} clauses agreeing on who the user is. When they disagreed, every request in
 * fixed-user mode ran against an empty database while appearing to work.
 *
 * <p>The anonymous case is not an error. Hibernate acquires connections during
 * start-up for schema validation, long before any request exists, and those must
 * succeed — they just must not see user data, which is what an unset
 * {@code app.user_id} guarantees.
 */
public class RlsTenantResolver implements CurrentTenantIdentifierResolver<String> {

    /**
     * Deliberately not a UUID and not empty: Hibernate requires a non-null
     * identifier, and a value that cannot parse as a UUID means a bug that leaks
     * this string into a policy comparison fails closed rather than matching
     * somebody's rows.
     */
    public static final String ANONYMOUS = "anonymous";

    /**
     * A supplier rather than the bean itself, so the resolver can be built while
     * the {@code EntityManagerFactory} is being configured without forcing the
     * provider to exist yet.
     */
    private final Supplier<CurrentUserProvider> currentUser;

    public RlsTenantResolver(Supplier<CurrentUserProvider> currentUser) {
        this.currentUser = currentUser;
    }

    @Override
    public String resolveCurrentTenantIdentifier() {
        CurrentUserProvider provider = currentUser.get();
        if (provider == null) return ANONYMOUS;

        return provider.currentUserIdIfPresent().map(Object::toString).orElse(ANONYMOUS);
    }

    /**
     * False, because the identity legitimately differs between one session and
     * the next on a pooled thread. Validating it would reject the second request
     * a thread serves.
     */
    @Override
    public boolean validateExistingCurrentSessions() {
        return false;
    }
}
