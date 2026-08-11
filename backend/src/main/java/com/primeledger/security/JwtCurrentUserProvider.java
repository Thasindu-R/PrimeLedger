package com.primeledger.security;

import java.util.Optional;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * The Phase 3 {@link CurrentUserProvider}: identity comes from the {@code sub}
 * claim of a validated Supabase JWT (proposal §9.2).
 *
 * <p>The token has already been checked by the resource-server filter — RS256
 * signature against the cached JWKS, issuer, expiry — before anything reaches
 * here. This class only reads the result; it never validates, so there is no
 * second, weaker code path that could disagree with the first.
 *
 * <p>{@link RunAs} takes precedence, because background work has no
 * {@code SecurityContext} to read.
 */
public class JwtCurrentUserProvider implements CurrentUserProvider {

    @Override
    public Optional<UUID> currentUserIdIfPresent() {
        // RunAs first: background work has no SecurityContext to read.
        Optional<UUID> impersonated = RunAs.current();
        if (impersonated.isPresent()) return impersonated;

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (!(authentication instanceof JwtAuthenticationToken token) || !token.isAuthenticated()) {
            return Optional.empty();
        }

        return Optional.of(subjectOf(token.getToken()));
    }

    /**
     * Supabase issues UUID subjects. A token that carries something else is
     * structurally valid but unusable, and a {@code sub} we cannot parse must not
     * become a query against a user id of "null".
     */
    static UUID subjectOf(Jwt jwt) {
        String subject = jwt.getSubject();

        if (subject == null || subject.isBlank()) {
            throw new IllegalStateException("JWT has no sub claim");
        }

        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("JWT sub is not a UUID: " + subject, e);
        }
    }
}
