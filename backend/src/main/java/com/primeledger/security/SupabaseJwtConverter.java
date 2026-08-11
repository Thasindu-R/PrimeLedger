package com.primeledger.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Turns a validated Supabase token into an {@link org.springframework.security.core.Authentication}
 * (proposal §9.2).
 *
 * <p>Supabase puts the user id in {@code sub}, a coarse {@code role} claim
 * (normally {@code authenticated}), and anything the project adds under
 * {@code app_metadata}. Roles are read from {@code app_metadata} rather than
 * {@code user_metadata} for a reason worth recording: {@code user_metadata} is
 * writable by the user themselves through the Supabase client, so trusting it
 * would let any account grant itself whatever authority it liked.
 */
public class SupabaseJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private static final String ROLE_CLAIM = "role";
    private static final String APP_METADATA = "app_metadata";
    private static final String ROLES_KEY = "roles";

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        // Fails fast on a token whose subject is not a usable user id, rather
        // than letting it through to be discovered by a query that returns
        // nothing for reasons nobody can explain.
        JwtCurrentUserProvider.subjectOf(jwt);

        return new JwtAuthenticationToken(jwt, authorities(jwt), jwt.getSubject());
    }

    private static Collection<GrantedAuthority> authorities(Jwt jwt) {
        Collection<GrantedAuthority> authorities = new ArrayList<>();

        String role = jwt.getClaimAsString(ROLE_CLAIM);
        if (role != null && !role.isBlank()) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
        }

        for (String extra : appMetadataRoles(jwt)) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + extra.toUpperCase()));
        }

        return authorities;
    }

    private static List<String> appMetadataRoles(Jwt jwt) {
        Map<String, Object> appMetadata = jwt.getClaimAsMap(APP_METADATA);

        if (appMetadata == null || !(appMetadata.get(ROLES_KEY) instanceof Collection<?> roles)) {
            return List.of();
        }

        return roles.stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .filter(r -> !r.isBlank())
                .toList();
    }
}
