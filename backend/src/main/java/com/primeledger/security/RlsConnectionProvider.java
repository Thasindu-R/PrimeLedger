package com.primeledger.security;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.hibernate.engine.jdbc.connections.spi.MultiTenantConnectionProvider;

/**
 * Sets {@code app.user_id} on every connection Hibernate takes out of the pool,
 * so the policies in {@code V2__row_level_security.sql} have an identity to
 * compare against (proposal §7.4, §9.2).
 *
 * <p><strong>Why session scope rather than {@code SET LOCAL}.</strong> The
 * proposal describes {@code SET LOCAL app.user_id}, which is transaction-scoped
 * and unwinds by itself. But Hibernate acquires the connection before the
 * transaction begins, and {@code SET LOCAL} outside a transaction block is a
 * no-op that merely emits a warning — the setting would silently never apply.
 * Setting it at session scope on acquisition works with the pool instead of
 * against it, and the invariant that makes it safe is simple: <em>every</em>
 * acquisition sets the value, including the anonymous case, so a connection can
 * never carry a previous borrower's identity into its next use. The reset on
 * release is a second line of defence, not the primary one.
 */
public class RlsConnectionProvider implements MultiTenantConnectionProvider<String> {

    private static final String SET_USER = "SELECT set_config('app.user_id', ?, false)";

    private final transient DataSource dataSource;

    public RlsConnectionProvider(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * Used by Hibernate for schema tooling and start-up validation, where there
     * is no tenant. It still gets an explicit empty identity rather than
     * whatever the pooled connection last held.
     */
    @Override
    public Connection getAnyConnection() throws SQLException {
        return getConnection(RlsTenantResolver.ANONYMOUS);
    }

    @Override
    public void releaseAnyConnection(Connection connection) throws SQLException {
        releaseConnection(RlsTenantResolver.ANONYMOUS, connection);
    }

    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
        Connection connection = dataSource.getConnection();

        try {
            applyIdentity(connection, tenantIdentifier);
        } catch (SQLException e) {
            // A connection whose identity could not be set is more dangerous than
            // no connection at all — it would run with whatever the last borrower
            // left behind. Return it and fail.
            connection.close();
            throw e;
        }

        return connection;
    }

    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection)
            throws SQLException {
        try {
            applyIdentity(connection, RlsTenantResolver.ANONYMOUS);
        } finally {
            connection.close();
        }
    }

    private void applyIdentity(Connection connection, String tenantIdentifier) throws SQLException {
        // set_config with a bind parameter rather than string-built SQL: the
        // identifier reaches the database as a value and can never be read as
        // statement text.
        try (PreparedStatement statement = connection.prepareStatement(SET_USER)) {
            statement.setString(1, isAnonymous(tenantIdentifier) ? "" : tenantIdentifier);
            statement.execute();
        }
    }

    private static boolean isAnonymous(String tenantIdentifier) {
        return tenantIdentifier == null || RlsTenantResolver.ANONYMOUS.equals(tenantIdentifier);
    }

    @Override
    public boolean supportsAggressiveRelease() {
        // Aggressive release would return the connection to the pool between
        // statements inside one transaction, and the identity would have to be
        // re-established on a connection that may not even be the same one.
        return false;
    }

    @Override
    public boolean isUnwrappableAs(Class<?> unwrapType) {
        return MultiTenantConnectionProvider.class.equals(unwrapType)
                || RlsConnectionProvider.class.equals(unwrapType);
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> T unwrap(Class<T> unwrapType) {
        if (isUnwrappableAs(unwrapType)) {
            return (T) this;
        }
        throw new IllegalArgumentException("Cannot unwrap to " + unwrapType);
    }
}
