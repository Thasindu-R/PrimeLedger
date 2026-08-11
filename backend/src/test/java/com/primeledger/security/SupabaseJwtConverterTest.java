package com.primeledger.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

/** Claim mapping, including the claims that must <em>not</em> be trusted. */
class SupabaseJwtConverterTest {

    private final SupabaseJwtConverter converter = new SupabaseJwtConverter();

    @Test
    @DisplayName("the sub claim becomes the principal name")
    void mapsSubjectToPrincipal() {
        UUID userId = UUID.randomUUID();

        var token = converter.convert(jwt(userId.toString()).build());

        assertThat(token).isNotNull();
        assertThat(token.getName()).isEqualTo(userId.toString());
    }

    @Test
    @DisplayName("the role claim becomes a granted authority")
    void mapsRoleClaim() {
        var token = converter.convert(jwt(UUID.randomUUID().toString()).build());

        assertThat(authorities(token)).contains("ROLE_AUTHENTICATED");
    }

    @Test
    @DisplayName("roles in app_metadata are granted")
    void mapsAppMetadataRoles() {
        var token =
                converter.convert(
                        jwt(UUID.randomUUID().toString())
                                .claim("app_metadata", Map.of("roles", List.of("admin")))
                                .build());

        assertThat(authorities(token)).contains("ROLE_ADMIN");
    }

    @Test
    @DisplayName("roles in user_metadata are ignored — the user can write that themselves")
    void ignoresUserMetadataRoles() {
        // The whole reason app_metadata is read instead: Supabase lets a client
        // update user_metadata on its own account. Honouring it would be a
        // self-service privilege escalation.
        var token =
                converter.convert(
                        jwt(UUID.randomUUID().toString())
                                .claim("user_metadata", Map.of("roles", List.of("admin")))
                                .build());

        assertThat(authorities(token)).doesNotContain("ROLE_ADMIN");
    }

    @Test
    @DisplayName("a subject that is not a UUID is rejected rather than carried forward")
    void rejectsNonUuidSubject() {
        assertThatThrownBy(() -> converter.convert(jwt("not-a-uuid").build()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("sub is not a UUID");
    }

    private static List<String> authorities(
            org.springframework.security.authentication.AbstractAuthenticationToken token) {
        return token.getAuthorities().stream().map(GrantedAuthority::getAuthority).toList();
    }

    private static Jwt.Builder jwt(String subject) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .claim("role", "authenticated")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600));
    }
}
