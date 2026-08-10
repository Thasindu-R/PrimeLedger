package com.primeledger.config;

import com.primeledger.security.CurrentUserProvider;
import com.primeledger.security.FixedUserProvider;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Supplies the Phase 2 {@link CurrentUserProvider}.
 *
 * <p>{@code @ConditionalOnMissingBean} is the hinge: when Phase 3 registers a
 * JWT-backed provider, this fallback disappears on its own and no other class
 * changes.
 */
@Configuration
public class CurrentUserConfig {

    @Bean
    @ConditionalOnMissingBean(CurrentUserProvider.class)
    public CurrentUserProvider fixedUserProvider(
            @Value("${primeledger.dev.user-id:00000000-0000-4000-8000-000000000001}") UUID userId) {
        return new FixedUserProvider(userId);
    }
}
