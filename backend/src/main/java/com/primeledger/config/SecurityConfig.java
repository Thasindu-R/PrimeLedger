package com.primeledger.config;

import static org.springframework.security.config.http.SessionCreationPolicy.STATELESS;

import com.primeledger.security.SupabaseJwtConverter;
import java.util.Arrays;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * The resource-server configuration (proposal §9.2).
 *
 * <p>Tokens are minted by Supabase Auth and verified here against its published
 * JWKS. The API never sees a password, never holds a session, and never calls
 * Supabase to check a token: RS256 verification is local, and the public keys
 * are cached, so a rotated signing key is picked up without a redeploy and
 * without a per-request round trip.
 *
 * <p>There is a second, deliberately crippled chain for working locally without
 * a Supabase project. It is selected by {@code primeledger.dev.fixed-user}, it
 * refuses to start under the prod profile, and it announces itself in the log,
 * because "why is authentication off in this environment?" should never be a
 * question anyone has to investigate.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    private static final String[] PUBLIC_PATHS = {
        "/actuator/health",
        "/actuator/health/**",
        "/actuator/info",
        "/swagger-ui.html",
        "/swagger-ui/**",
        "/v3/api-docs",
        "/v3/api-docs/**",
    };

    private static final String FIXED_USER = "primeledger.dev.fixed-user";

    @Bean
    @ConditionalOnProperty(name = FIXED_USER, havingValue = "false", matchIfMissing = true)
    public SecurityFilterChain jwtChain(HttpSecurity http, JwtDecoder jwtDecoder) throws Exception {
        return http
                // Stateless bearer-token API: there is no cookie for a forged
                // cross-site form to ride on, so CSRF tokens would protect
                // nothing and break every client.
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(
                        a ->
                                a.requestMatchers(PUBLIC_PATHS)
                                        .permitAll()
                                        // Everything else, including anything a
                                        // later phase adds, is authenticated
                                        // unless it is named above.
                                        .anyRequest()
                                        .authenticated())
                .oauth2ResourceServer(
                        o ->
                                o.jwt(
                                        j ->
                                                j.decoder(jwtDecoder)
                                                        .jwtAuthenticationConverter(
                                                                new SupabaseJwtConverter())))
                .headers(h -> h.httpStrictTransportSecurity(Customizer.withDefaults()))
                .build();
    }

    @Bean
    @ConditionalOnProperty(name = FIXED_USER, havingValue = "false", matchIfMissing = true)
    public JwtDecoder jwtDecoder(
            @Value("${supabase.jwks-uri:}") String jwksUri,
            @Value("${supabase.issuer:}") String issuer,
            @Value("${supabase.audience:authenticated}") String audience) {

        if (jwksUri.isBlank() || issuer.isBlank()) {
            throw new IllegalStateException(
                    "supabase.jwks-uri and supabase.issuer must be set (see backend/.env.example). "
                            + "To run locally without a Supabase project, set "
                            + FIXED_USER
                            + "=true instead.");
        }

        // Keys are fetched from Supabase and cached, so rotating a signing key
        // needs no redeploy and costs no per-request round trip.
        NimbusJwtDecoder decoder =
                NimbusJwtDecoder.withJwkSetUri(jwksUri)
                        .jwsAlgorithm(SignatureAlgorithm.RS256)
                        .build();

        decoder.setJwtValidator(validators(issuer, audience));
        return decoder;
    }

    /**
     * Issuer, expiry and audience. The audience check is the one that is easy to
     * leave out and worth keeping: without it a token minted by the same Supabase
     * project for a different audience would be accepted here.
     */
    public static OAuth2TokenValidator<Jwt> validators(String issuer, String audience) {
        OAuth2TokenValidator<Jwt> defaults = JwtValidators.createDefaultWithIssuer(issuer);
        OAuth2TokenValidator<Jwt> audienceValidator =
                new JwtClaimValidator<List<String>>(
                        JwtClaimNames.AUD, aud -> aud != null && aud.contains(audience));

        return new DelegatingOAuth2TokenValidator<>(defaults, audienceValidator);
    }

    /**
     * Local development only: no tokens, every request attributed to the fixed
     * development user. RLS still applies — the connection still carries that
     * user's id — so this weakens authentication, not isolation.
     */
    @Bean
    @ConditionalOnProperty(name = FIXED_USER, havingValue = "true")
    public SecurityFilterChain fixedUserChain(HttpSecurity http, Environment environment)
            throws Exception {

        if (Arrays.asList(environment.getActiveProfiles()).contains("prod")) {
            throw new IllegalStateException(
                    FIXED_USER + "=true disables authentication and must never be set in prod");
        }

        log.warn(
                "AUTHENTICATION IS DISABLED ({}=true). Every request is attributed to the fixed "
                        + "development user. This is for local development without a Supabase project.",
                FIXED_USER);

        return http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(a -> a.anyRequest().permitAll())
                .build();
    }
}
