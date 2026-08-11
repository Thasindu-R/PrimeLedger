package com.primeledger.config;

import com.primeledger.security.CurrentUserProvider;
import com.primeledger.security.FixedUserProvider;
import com.primeledger.security.JwtCurrentUserProvider;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Chooses where the current user's identity comes from.
 *
 * <p>Phase 3 makes the JWT-backed provider the default and leaves the Phase 2
 * fixed provider available behind an explicit flag, because a few things — the
 * development seeder, a local run with no Supabase project to hand — still need
 * an identity without a token.
 *
 * <p>The choice is made on one property with mutually exclusive conditions
 * rather than {@code @ConditionalOnMissingBean}. That annotation resolves by
 * bean-definition order outside auto-configuration, and "which provider is
 * active" is too important to depend on the order two {@code @Bean} methods
 * happen to be declared in.
 */
@Configuration
public class CurrentUserConfig {

    private static final String FIXED_USER = "primeledger.dev.fixed-user";

    @Bean
    @ConditionalOnProperty(name = FIXED_USER, havingValue = "true")
    public CurrentUserProvider fixedUserProvider(
            @Value("${primeledger.dev.user-id:00000000-0000-4000-8000-000000000001}") UUID userId) {
        return new FixedUserProvider(userId);
    }

    @Bean
    @ConditionalOnProperty(name = FIXED_USER, havingValue = "false", matchIfMissing = true)
    public CurrentUserProvider jwtCurrentUserProvider() {
        return new JwtCurrentUserProvider();
    }
}
