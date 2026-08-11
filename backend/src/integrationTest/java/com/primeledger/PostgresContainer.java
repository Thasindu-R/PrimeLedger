package com.primeledger;

import org.testcontainers.containers.PostgreSQLContainer;

/**
 * One PostgreSQL 16 for the whole suite.
 *
 * <p>Held here rather than on a base class because Phase 3 introduced a second
 * kind of integration test — one that connects as the unprivileged runtime role
 * — and both kinds should share a container. A container per base class would
 * double the slowest part of the run for no extra coverage.
 */
public final class PostgresContainer {

    /** The privileged role: owns the schema, runs migrations, bypasses RLS. */
    public static final String ADMIN_USER = "primeledger";

    public static final String ADMIN_PASSWORD = "primeledger";

    /** The unprivileged runtime role created by {@code V2__row_level_security.sql}. */
    public static final String APP_USER = "primeledger_app";

    /** Matches docker/postgres-init/00-create-app-role.sql. */
    public static final String APP_PASSWORD = "primeledger_app_dev";

    public static final PostgreSQLContainer<?> INSTANCE =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("primeledger")
                    .withUsername(ADMIN_USER)
                    .withPassword(ADMIN_PASSWORD)
                    // Gives primeledger_app the ability to log in, which the
                    // migrations deliberately do not do. Runs before Flyway.
                    .withInitScript("db/local/00-create-app-role.sql");

    static {
        INSTANCE.start();
    }

    private PostgresContainer() {}
}
