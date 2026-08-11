package com.primeledger.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountType;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryRepository;
import com.primeledger.transaction.Transaction;
import com.primeledger.transaction.TransactionRepository;
import com.primeledger.transaction.TransactionType;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The Phase 3 deliverable, stated as a test: two accounts exist and provably
 * cannot see each other's data.
 *
 * <p>What makes these assertions worth anything is where the filtering happens.
 * Several of them issue SQL with <em>no</em> {@code WHERE user_id = ?} clause at
 * all — the kind of query a future refactor might leave behind — and still come
 * back empty. That is PostgreSQL applying the policies from V2, not the
 * repository being careful, and it is the promise NFR-06 actually makes:
 * isolation survives an application-layer mistake.
 *
 * <p>Every block runs inside {@link RunAs}, which is what puts an identity on
 * the connection. Nothing here grants a privilege the API does not have.
 */
class RlsIsolationIntegrationTest extends AbstractRlsIntegrationTest {

    @Autowired private TransactionRepository transactions;
    @Autowired private AccountRepository accounts;
    @Autowired private CategoryRepository categories;
    @Autowired private TransactionTemplate tx;
    @Autowired private EntityManager entityManager;

    private UUID alice;
    private UUID bob;
    private UUID aliceTransaction;

    @BeforeEach
    void setUp() {
        alice = createUser("alice");
        bob = createUser("bob");
        aliceTransaction = asUser(alice, () -> seedTransaction(alice, "Alice groceries"));
        asUser(bob, () -> seedTransaction(bob, "Bob rent"));
    }

    @Test
    @DisplayName("a user's list query returns only their own rows")
    void listIsScopedToOwner() {
        List<Transaction> aliceRows = asUser(alice, () -> transactions.findAll());
        List<Transaction> bobRows = asUser(bob, () -> transactions.findAll());

        assertThat(aliceRows).extracting(Transaction::getDescription).containsExactly("Alice groceries");
        assertThat(bobRows).extracting(Transaction::getDescription).containsExactly("Bob rent");
    }

    @Test
    @DisplayName("raw SQL with no owner filter still returns only the caller's rows")
    void unfilteredSqlIsStillIsolated() {
        // The query a developer writes when they forget. The database is what
        // stops it, which is the entire argument for putting the control here.
        Supplier<Long> countEverything =
                () ->
                        ((Number)
                                        entityManager
                                                .createNativeQuery("select count(*) from transactions")
                                                .getSingleResult())
                                .longValue();

        assertThat(asUser(alice, countEverything)).isEqualTo(1L);
        assertThat(asUser(bob, countEverything)).isEqualTo(1L);
    }

    @Test
    @DisplayName("fetching another user's transaction by its exact id returns nothing")
    void cannotReadAnotherUsersRowById() {
        var found = asUser(bob, () -> transactions.findById(aliceTransaction));

        // Not "forbidden" — invisible. Bob cannot distinguish Alice's row from a
        // row that was never created, which is the same indistinguishability the
        // API's 404 relies on.
        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("updating another user's row affects nothing")
    void cannotUpdateAnotherUsersRow() {
        int updated =
                asUser(
                        bob,
                        () ->
                                entityManager
                                        .createNativeQuery(
                                                "update transactions set description = 'hijacked' where id = ?1")
                                        .setParameter(1, aliceTransaction)
                                        .executeUpdate());

        assertThat(updated).isZero();

        String description =
                asUser(
                        alice,
                        () -> transactions.findById(aliceTransaction).orElseThrow().getDescription());
        assertThat(description).isEqualTo("Alice groceries");
    }

    @Test
    @DisplayName("deleting another user's row affects nothing")
    void cannotDeleteAnotherUsersRow() {
        int deleted =
                asUser(
                        bob,
                        () ->
                                entityManager
                                        .createNativeQuery("delete from transactions where id = ?1")
                                        .setParameter(1, aliceTransaction)
                                        .executeUpdate());

        assertThat(deleted).isZero();
        assertThat(asUser(alice, () -> transactions.findById(aliceTransaction))).isPresent();
    }

    @Test
    @DisplayName("writing a row owned by someone else is rejected outright")
    void cannotInsertRowOwnedByAnotherUser() {
        // Not silently ignored like a read: WITH CHECK turns an attempt to write
        // outside your own data into an error.
        assertThatThrownBy(
                        () ->
                                asUser(
                                        bob,
                                        () -> {
                                            Account smuggled = new Account();
                                            smuggled.setUserId(alice);
                                            smuggled.setName("Smuggled");
                                            smuggled.setType(AccountType.CHECKING);
                                            smuggled.setCurrency("USD");
                                            smuggled.setOpeningBalance(BigDecimal.ZERO);
                                            return accounts.saveAndFlush(smuggled);
                                        }))
                .hasMessageContaining("row-level security");
    }

    @Test
    @DisplayName("a connection with no identity sees nothing at all")
    void anonymousConnectionSeesNothing() {
        // No RunAs: app.user_id is empty, app_current_user_id() is NULL, and
        // `user_id = NULL` is never true. Absence of an identity fails closed.
        long visible =
                tx.execute(
                        status ->
                                ((Number)
                                                entityManager
                                                        .createNativeQuery(
                                                                "select count(*) from transactions")
                                                        .getSingleResult())
                                        .longValue());

        assertThat(visible).isZero();
    }

    @Test
    @DisplayName("system categories are shared; user categories are not")
    void systemCategoriesAreVisibleToEveryone() {
        asUser(alice, () -> saveCategory(alice, "Alice private", CategoryKind.EXPENSE));

        List<Category> bobSees = asUser(bob, () -> categories.findAll());

        assertThat(bobSees)
                .as("the V3 system categories are visible to every user")
                .anyMatch(Category::isSystem);
        assertThat(bobSees)
                .as("Bob's own categories are visible to Bob")
                .anyMatch(c -> !c.isSystem() && bob.equals(c.getUserId()));
        assertThat(bobSees)
                .as("no row Alice owns is visible to Bob")
                .noneMatch(c -> alice.equals(c.getUserId()));
        assertThat(bobSees).extracting(Category::getName).doesNotContain("Alice private");
    }

    // ---------------------------------------------------------------------
    // Fixtures
    // ---------------------------------------------------------------------

    /**
     * Runs a block with an identity on the connection. RunAs is set outside the
     * transaction because the tenant is resolved when the connection is acquired,
     * which happens as the transaction begins.
     */
    private <T> T asUser(UUID userId, Supplier<T> work) {
        return RunAs.callUnchecked(userId, () -> tx.execute(status -> work.get()));
    }

    private void asUser(UUID userId, Runnable work) {
        asUser(
                userId,
                () -> {
                    work.run();
                    return null;
                });
    }

    /** auth.users carries no policy — it is GoTrue's table, standing in locally. */
    private UUID createUser(String name) {
        UUID id = UUID.randomUUID();
        tx.executeWithoutResult(
                status ->
                        entityManager
                                .createNativeQuery(
                                        "insert into auth.users (id, email) values (?1, ?2)")
                                .setParameter(1, id)
                                .setParameter(2, name + "-" + id + "@primeledger.test")
                                .executeUpdate());
        return id;
    }

    private UUID seedTransaction(UUID userId, String description) {
        Account account = new Account();
        account.setUserId(userId);
        account.setName("Everyday");
        account.setType(AccountType.CHECKING);
        account.setCurrency("USD");
        account.setOpeningBalance(BigDecimal.ZERO);
        accounts.saveAndFlush(account);

        Category category = saveCategory(userId, "Groceries", CategoryKind.EXPENSE);

        Transaction transaction = new Transaction();
        transaction.setUserId(userId);
        transaction.setAccountId(account.getId());
        transaction.setCategory(category);
        transaction.setType(TransactionType.EXPENSE);
        transaction.setAmount(new BigDecimal("42.00"));
        transaction.setCurrency("USD");
        transaction.setOccurredOn(LocalDate.of(2025, 6, 1));
        transaction.setDescription(description);
        return transactions.saveAndFlush(transaction).getId();
    }

    private Category saveCategory(UUID userId, String name, CategoryKind kind) {
        Category category = new Category();
        category.setUserId(userId);
        category.setName(name);
        category.setKind(kind);
        category.setSystem(false);
        return categories.saveAndFlush(category);
    }
}
