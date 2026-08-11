package com.primeledger.config;

import com.primeledger.security.CurrentUserProvider;
import com.primeledger.security.RlsConnectionProvider;
import com.primeledger.security.RlsGuard;
import com.primeledger.security.RlsTenantResolver;
import javax.sql.DataSource;
import org.hibernate.cfg.AvailableSettings;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the row-level security context into Hibernate (proposal §7.4, §9.2).
 *
 * <p>The two objects are registered directly as Hibernate settings rather than
 * left to be discovered as beans. Multi-tenancy has to be configured as the
 * {@code EntityManagerFactory} is built, and doing it explicitly here means the
 * behaviour does not depend on which auto-configuration happens to run.
 */
@Configuration
public class RlsConfig {

    @Bean
    public HibernatePropertiesCustomizer rlsMultiTenancy(
            DataSource dataSource, ObjectProvider<CurrentUserProvider> currentUser) {

        RlsConnectionProvider connectionProvider = new RlsConnectionProvider(dataSource);
        // Resolved lazily: this runs while the EntityManagerFactory is being
        // built, and the identity is only needed once connections are handed out.
        RlsTenantResolver tenantResolver = new RlsTenantResolver(currentUser::getIfAvailable);

        return properties -> {
            properties.put(AvailableSettings.MULTI_TENANT_CONNECTION_PROVIDER, connectionProvider);
            properties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, tenantResolver);
        };
    }

    /**
     * Runs once the context is up and the schema is migrated, so it inspects the
     * database the application will actually serve from.
     */
    @Bean
    public ApplicationListener<ApplicationReadyEvent> rlsGuard(
            DataSource dataSource,
            @Value("${primeledger.security.require-rls:true}") boolean requireRls) {

        RlsGuard guard = new RlsGuard(dataSource, requireRls);
        return event -> guard.verify();
    }
}
