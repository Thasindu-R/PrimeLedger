package com.primeledger;

import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;

/**
 * Base for repository and schema tests: a real PostgreSQL 16, migrated by
 * Flyway, with Hibernate validating the mapping against it on start-up.
 *
 * <p>Real Postgres rather than H2 because the things worth testing here — check
 * constraints, partial indexes, row-level security — do not exist in an
 * in-memory substitute (§7.4).
 *
 * <p><strong>These tests connect as the privileged role, which bypasses RLS.</strong>
 * That is deliberate. Their subject is SQL semantics — does this specification
 * generate the right predicate, does this native update touch the right rows —
 * and threading an identity through every fixture would obscure that without
 * testing anything extra. The policies themselves are proved separately, as the
 * unprivileged role, by {@link com.primeledger.security.RlsIsolationIntegrationTest}
 * and {@link com.primeledger.security.AuthIntegrationTest}. Keeping the two
 * concerns in different suites is what stops either from quietly weakening.
 */
@SpringBootTest(
        properties = {
            // No JWKS to reach in tests; identity comes from RunAs.
            "primeledger.dev.fixed-user=true",
            // The privileged role legitimately bypasses RLS here, so the start-up
            // guard would fail every one of these tests for the wrong reason.
            "primeledger.security.require-rls=false",
        })
@EnabledIf("dockerAvailable")
public abstract class AbstractIntegrationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", PostgresContainer.INSTANCE::getJdbcUrl);
        registry.add("spring.datasource.username", () -> PostgresContainer.ADMIN_USER);
        registry.add("spring.datasource.password", () -> PostgresContainer.ADMIN_PASSWORD);
        registry.add("spring.flyway.user", () -> PostgresContainer.ADMIN_USER);
        registry.add("spring.flyway.password", () -> PostgresContainer.ADMIN_PASSWORD);
    }

    /**
     * Replaces {@code @Testcontainers(disabledWithoutDocker = true)}, which
     * cannot help here: the container is started from a static initialiser so the
     * suite shares one, and that runs before any JUnit condition is evaluated.
     */
    static boolean dockerAvailable() {
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (RuntimeException e) {
            return false;
        }
    }
}
