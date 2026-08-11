package com.primeledger.security;

import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Verifies at start-up that row-level security actually binds for the role the
 * application connects as.
 *
 * <p>This exists because the failure it catches is invisible. PostgreSQL lets a
 * superuser, and a table owner without {@code FORCE ROW LEVEL SECURITY}, ignore
 * every policy silently — no error, no log line, just full access to every
 * user's rows. Point the connection pool at the migration role by accident and
 * the application keeps working perfectly, all its tests keep passing, and the
 * single control the whole design leans on is off.
 *
 * <p>So it is checked rather than assumed, and the check runs before the
 * application accepts traffic. NFR-06 requires isolation to hold "even if an
 * application-layer filter is omitted"; that promise is only worth anything if
 * the database is in a position to keep it.
 */
public class RlsGuard {

    private static final Logger log = LoggerFactory.getLogger(RlsGuard.class);

    /** Tables that must have RLS enabled and forced. fx_rates is ownerless by design. */
    private static final String UNPROTECTED_TABLES =
            """
            SELECT c.relname
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public'
               AND c.relkind = 'r'
               AND c.relname IN ('profiles', 'accounts', 'categories', 'recurring_rules',
                                 'transactions', 'budgets', 'savings_goals')
               AND NOT (c.relrowsecurity AND c.relforcerowsecurity)
            """;

    private final JdbcTemplate jdbc;
    private final boolean enforce;

    public RlsGuard(DataSource dataSource, boolean enforce) {
        this.jdbc = new JdbcTemplate(dataSource);
        this.enforce = enforce;
    }

    public void verify() {
        String role = jdbc.queryForObject("SELECT current_user", String.class);

        Boolean superuser =
                jdbc.queryForObject(
                        "SELECT rolsuper FROM pg_roles WHERE rolname = current_user", Boolean.class);
        Boolean bypasses =
                jdbc.queryForObject(
                        "SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user",
                        Boolean.class);

        if (Boolean.TRUE.equals(superuser) || Boolean.TRUE.equals(bypasses)) {
            fail(
                    ("The API is connecting as '%s', which bypasses row-level security "
                                    + "(superuser=%s, bypassrls=%s). Every policy in V2 is inert and users "
                                    + "can read each other's data. Point spring.datasource.username at the "
                                    + "unprivileged runtime role (primeledger_app) and leave the privileged "
                                    + "one to Flyway.")
                            .formatted(role, superuser, bypasses));
            return;
        }

        var unprotected = jdbc.queryForList(UNPROTECTED_TABLES, String.class);
        if (!unprotected.isEmpty()) {
            fail(
                    ("Row-level security is not enabled and forced on: %s. A migration has "
                                    + "probably added a user-owned table without a policy.")
                            .formatted(String.join(", ", unprotected)));
            return;
        }

        log.info(
                "Row-level security verified: connected as '{}', policies forced on all user-owned tables",
                role);
    }

    private void fail(String message) {
        if (enforce) {
            throw new IllegalStateException(message);
        }
        // Disabling the guard is a deliberate local-development choice, so it
        // warns loudly rather than staying quiet about it.
        log.error("ROW-LEVEL SECURITY IS NOT IN EFFECT. {}", message);
    }
}
