package com.primeledger;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Base for every integration test: a real PostgreSQL 16, migrated by Flyway,
 * with Hibernate validating the mapping against it on start-up.
 *
 * <p>Real Postgres rather than H2 because the things worth testing here —
 * check constraints, partial indexes, and from Phase 3 the row-level security
 * policies — do not exist in an in-memory substitute. §7.4 is explicit that
 * those policies must be exercised rather than assumed.
 *
 * <p>{@code disabledWithoutDocker} skips the suite on a machine with no Docker
 * daemon instead of failing it; CI always has one.
 */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
public abstract class AbstractIntegrationTest {

    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("primeledger")
                    .withUsername("primeledger")
                    .withPassword("primeledger");

    static {
        // Started once for the whole suite and reused: a container per test class
        // would dominate the run time for no extra coverage.
        POSTGRES.start();
    }
}
