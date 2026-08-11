package com.primeledger;

import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * One PostgreSQL 16 for the whole suite.
 *
 * <p>Held here rather than on a base class because Phase 3 introduced a second
 * kind of integration test — one that connects as the unprivileged runtime role
 * — and both kinds should share a container. A container per base class would
 * double the slowest part of the run for no extra coverage.
 *
 * <p>The container is created on first use rather than in a static initialiser.
 * That distinction matters on a machine with no Docker: a static initialiser
 * runs the moment anything so much as mentions this class, turning "skip these
 * tests" into {@code ExceptionInInitializerError} for the whole suite. Lazily,
 * {@link #dockerAvailable()} gets to answer first and nothing is constructed.
 */
public final class PostgresContainer {

    /** The privileged role: owns the schema, runs migrations, bypasses RLS. */
    public static final String ADMIN_USER = "primeledger";

    public static final String ADMIN_PASSWORD = "primeledger";

    /** The unprivileged runtime role created by {@code V2__row_level_security.sql}. */
    public static final String APP_USER = "primeledger_app";

    /** Matches docker/postgres-init/00-create-app-role.sql. */
    public static final String APP_PASSWORD = "primeledger_app_dev";

    private static PostgreSQLContainer<?> instance;

    private PostgresContainer() {}

    public static synchronized PostgreSQLContainer<?> instance() {
        if (instance == null) {
            instance =
                    new PostgreSQLContainer<>("postgres:16-alpine")
                            .withDatabaseName("primeledger")
                            .withUsername(ADMIN_USER)
                            .withPassword(ADMIN_PASSWORD)
                            // Gives primeledger_app the ability to log in, which
                            // the migrations deliberately do not do. Runs before
                            // Flyway.
                            .withInitScript("db/local/00-create-app-role.sql");
            // Started once for the whole suite and reused: a container per test
            // class would dominate the run time for no extra coverage.
            instance.start();
        }
        return instance;
    }

    public static String jdbcUrl() {
        return instance().getJdbcUrl();
    }

    /**
     * Replaces {@code @Testcontainers(disabledWithoutDocker = true)}, which
     * cannot be used once the container is shared rather than owned by one class.
     *
     * <p>Catches {@link Throwable} rather than {@link RuntimeException}: a broken
     * or half-stopped Docker installation surfaces as an {@code Error} from
     * static initialisation inside the client library, and a suite that cannot
     * run should skip rather than fail.
     */
    public static boolean dockerAvailable() {
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (Throwable t) {
            return false;
        }
    }
}
