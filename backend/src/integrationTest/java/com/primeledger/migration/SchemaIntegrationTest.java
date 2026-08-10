package com.primeledger.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.primeledger.AbstractIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * V1 as applied, not as written.
 *
 * <p>The context starting at all already proves two things: Flyway ran, and
 * Hibernate's {@code validate} found every mapped column. What is left to check
 * is the part of the schema that no entity mapping expresses — the constraints
 * that will one day be the only thing standing between a bug and bad data.
 */
class SchemaIntegrationTest extends AbstractIntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    @Test
    @DisplayName("every table from §7 exists")
    void createsEveryTable() {
        List<String> tables =
                jdbc.queryForList(
                        """
                        select table_name from information_schema.tables
                        where table_schema = 'public' and table_type = 'BASE TABLE'
                        """,
                        String.class);

        assertThat(tables)
                .contains(
                        "profiles",
                        "accounts",
                        "categories",
                        "transactions",
                        "budgets",
                        "recurring_rules",
                        "savings_goals",
                        "fx_rates");
    }

    @Test
    @DisplayName("money is NUMERIC(15,2) and not a float")
    void amountIsExactDecimal() {
        var column =
                jdbc.queryForMap(
                        """
                        select data_type, numeric_precision, numeric_scale
                        from information_schema.columns
                        where table_name = 'transactions' and column_name = 'amount'
                        """);

        assertThat(column.get("data_type")).isEqualTo("numeric");
        assertThat(column.get("numeric_precision")).isEqualTo(15);
        assertThat(column.get("numeric_scale")).isEqualTo(2);
    }

    @Test
    @DisplayName("a non-positive amount is refused by the database, not just by the service")
    void refusesNonPositiveAmount() {
        UUID user = seedUser();

        assertThatThrownBy(() -> insertTransaction(user, "0.00", "2026-08-01"))
                .hasMessageContaining("amount");
    }

    @Test
    @DisplayName("a far-future date is refused by the database — D-09, one layer down")
    void refusesFutureDate() {
        UUID user = seedUser();

        assertThatThrownBy(() -> insertTransaction(user, "10.00", "3000-01-01"))
                .hasMessageContaining("occurred_on");
    }

    @Test
    @DisplayName("a description over 500 characters is refused")
    void refusesOverlongDescription() {
        UUID user = seedUser();
        UUID account = seedAccount(user);
        UUID category = seedCategory(user, "expense");

        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        """
                                        insert into transactions
                                            (user_id, account_id, category_id, type, amount, currency,
                                             occurred_on, description)
                                        values (?, ?, ?, 'expense', 10.00, 'USD', '2026-08-01', ?)
                                        """,
                                        user,
                                        account,
                                        category,
                                        "x".repeat(501)))
                .hasMessageContaining("description");
    }

    @Test
    @DisplayName("a system category cannot have an owner, and a user category must")
    void enforcesSystemCategoryOwnership() {
        UUID user = seedUser();

        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        """
                                        insert into categories (user_id, name, kind, is_system)
                                        values (?, 'Broken', 'expense', true)
                                        """,
                                        user))
                .hasMessageContaining("categories_system_has_no_owner");
    }

    @Test
    @DisplayName("two system categories cannot share a name — NULL owners are not distinct here")
    void deduplicatesSystemCategories() {
        jdbc.update(
                "insert into categories (user_id, name, kind, is_system) values (null, 'Groceries', 'expense', true)");

        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "insert into categories (user_id, name, kind, is_system) values (null, 'groceries', 'expense', true)"))
                .hasMessageContaining("idx_categories_system_name");
    }

    @Test
    @DisplayName("updated_at moves on its own, even for a write that never sees JPA")
    void triggerMaintainsUpdatedAt() {
        UUID user = seedUser();
        UUID account = seedAccount(user);

        var before = jdbc.queryForObject(
                "select updated_at from accounts where id = ?", java.sql.Timestamp.class, account);
        jdbc.update("update accounts set name = 'Renamed' where id = ?", account);
        var after = jdbc.queryForObject(
                "select updated_at from accounts where id = ?", java.sql.Timestamp.class, account);

        assertThat(after).isAfterOrEqualTo(before);
    }

    @Test
    @DisplayName("fx_rates has no owner column — it is shared reference data (§7.4)")
    void fxRatesHasNoOwner() {
        List<String> columns =
                jdbc.queryForList(
                        "select column_name from information_schema.columns where table_name = 'fx_rates'",
                        String.class);

        assertThat(columns).doesNotContain("user_id");
    }

    // ---------------------------------------------------------------- helpers

    private UUID seedUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into auth.users (id, email) values (?, ?)", id, id + "@test.local");
        return id;
    }

    private UUID seedAccount(UUID user) {
        return jdbc.queryForObject(
                """
                insert into accounts (user_id, name, type, currency)
                values (?, 'Everyday', 'checking', 'USD') returning id
                """,
                UUID.class,
                user);
    }

    private UUID seedCategory(UUID user, String kind) {
        return jdbc.queryForObject(
                """
                insert into categories (user_id, name, kind) values (?, ?, ?) returning id
                """,
                UUID.class,
                user,
                "Category " + UUID.randomUUID(),
                kind);
    }

    private void insertTransaction(UUID user, String amount, String occurredOn) {
        UUID account = seedAccount(user);
        UUID category = seedCategory(user, "expense");
        jdbc.update(
                """
                insert into transactions
                    (user_id, account_id, category_id, type, amount, currency, occurred_on)
                values (?, ?, ?, 'expense', ?::numeric, 'USD', ?::date)
                """,
                user,
                account,
                category,
                amount,
                occurredOn);
    }
}
