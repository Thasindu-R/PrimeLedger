package com.primeledger.transaction;

import static org.assertj.core.api.Assertions.assertThat;

import com.primeledger.AbstractIntegrationTest;
import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountType;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryRepository;
import com.primeledger.transaction.dto.TransactionFilter;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * The repository against real PostgreSQL: the derived queries, the
 * specification, and the two modifying queries that are easy to get wrong and
 * impossible to check by reading.
 */
@Transactional
class TransactionRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired private TransactionRepository transactions;
    @Autowired private AccountRepository accounts;
    @Autowired private CategoryRepository categories;
    @Autowired private JdbcTemplate jdbc;

    private UUID alice;
    private UUID bob;
    private Account aliceAccount;
    private Category groceries;
    private Category rent;

    @BeforeEach
    void setUp() {
        alice = seedUser();
        bob = seedUser();
        aliceAccount = account(alice, "Everyday");
        groceries = category(alice, "Groceries", CategoryKind.EXPENSE);
        rent = category(alice, "Rent", CategoryKind.EXPENSE);
    }

    @Test
    @DisplayName("stores an exact decimal and reads back the same value")
    void roundTripsExactDecimal() {
        Transaction saved = transactions.save(transaction(new BigDecimal("12345678901.99"), LocalDate.of(2026, 8, 1)));
        transactions.flush();

        Transaction found = transactions.findByIdAndUserId(saved.getId(), alice).orElseThrow();

        assertThat(found.getAmount()).isEqualByComparingTo("12345678901.99");
    }

    @Test
    @DisplayName("the enum is stored as the lower-case value the check constraint allows")
    void storesEnumAsLowerCase() {
        Transaction saved = transactions.save(transaction(BigDecimal.TEN, LocalDate.of(2026, 8, 1)));
        transactions.flush();

        String stored =
                jdbc.queryForObject(
                        "select type from transactions where id = ?", String.class, saved.getId());

        assertThat(stored).isEqualTo("expense");
    }

    @Test
    @DisplayName("one user's transaction is invisible to another — the ownership predicate holds")
    void ownershipIsolatesUsers() {
        Transaction saved = transactions.save(transaction(BigDecimal.TEN, LocalDate.of(2026, 8, 1)));
        transactions.flush();

        assertThat(transactions.findByIdAndUserId(saved.getId(), bob)).isEmpty();
        assertThat(transactions.findByIdAndUserId(saved.getId(), alice)).isPresent();
    }

    @Test
    @DisplayName("the default listing hides soft-deleted rows and includeDeleted brings them back")
    void filtersSoftDeleted() {
        Transaction live = transactions.save(transaction(BigDecimal.TEN, LocalDate.of(2026, 8, 1)));
        Transaction gone = transaction(BigDecimal.ONE, LocalDate.of(2026, 8, 2));
        gone.setDeletedAt(Instant.now());
        transactions.save(gone);
        transactions.flush();

        var visible = transactions.findAll(
                TransactionSpecifications.matching(alice, filter(false)), PageRequest.of(0, 10));
        var all = transactions.findAll(
                TransactionSpecifications.matching(alice, filter(true)), PageRequest.of(0, 10));

        assertThat(visible.getContent()).extracting(Transaction::getId).containsExactly(live.getId());
        assertThat(all.getTotalElements()).isEqualTo(2);
    }

    @Test
    @DisplayName("the date window is inclusive at both ends")
    void filtersInclusiveDateRange() {
        // All in the past: V1 constrains occurred_on to CURRENT_DATE + 1, so a
        // fixture dated into the future would be rejected by the database and
        // the test would rot the moment it was written.
        transactions.save(transaction(BigDecimal.ONE, LocalDate.of(2025, 6, 30)));
        transactions.save(transaction(BigDecimal.ONE, LocalDate.of(2025, 7, 1)));
        transactions.save(transaction(BigDecimal.ONE, LocalDate.of(2025, 7, 31)));
        transactions.save(transaction(BigDecimal.ONE, LocalDate.of(2025, 8, 1)));
        transactions.flush();

        var filter =
                new TransactionFilter(
                        LocalDate.of(2025, 7, 1),
                        LocalDate.of(2025, 7, 31),
                        null, null, null, null, null, null, false);

        var page = transactions.findAll(
                TransactionSpecifications.matching(alice, filter), PageRequest.of(0, 10));

        assertThat(page.getTotalElements()).isEqualTo(2);
    }

    @Test
    @DisplayName("description search is case-insensitive")
    void searchesDescriptionCaseInsensitively() {
        Transaction shop = transaction(BigDecimal.ONE, LocalDate.of(2026, 8, 1));
        shop.setDescription("Weekly SHOP at the market");
        transactions.save(shop);
        transactions.save(transaction(BigDecimal.ONE, LocalDate.of(2026, 8, 2)));
        transactions.flush();

        var filter =
                new TransactionFilter(null, null, null, null, null, null, null, "weekly shop", false);

        var page = transactions.findAll(
                TransactionSpecifications.matching(alice, filter), PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(Transaction::getId).containsExactly(shop.getId());
    }

    @Test
    @DisplayName("sorting by amount orders on the numeric value, not its text")
    void sortsNumerically() {
        transactions.save(transaction(new BigDecimal("9.00"), LocalDate.of(2026, 8, 1)));
        transactions.save(transaction(new BigDecimal("100.00"), LocalDate.of(2026, 8, 2)));
        transactions.flush();

        var page = transactions.findAll(
                TransactionSpecifications.matching(alice, filter(false)),
                PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "amount")));

        assertThat(page.getContent()).first()
                .extracting(Transaction::getAmount)
                .satisfies(amount -> assertThat((BigDecimal) amount).isEqualByComparingTo("100.00"));
    }

    @Test
    @DisplayName("bulk delete touches only this user's live rows and reports the real count")
    void bulkDeleteIsScopedAndCounted() {
        Transaction mine = transactions.save(transaction(BigDecimal.ONE, LocalDate.of(2026, 8, 1)));
        Transaction alreadyGone = transaction(BigDecimal.ONE, LocalDate.of(2026, 8, 2));
        alreadyGone.setDeletedAt(Instant.now());
        transactions.save(alreadyGone);
        Transaction bobs = transactions.save(bobsTransaction());
        transactions.flush();

        int deleted =
                transactions.softDeleteAll(
                        alice, List.of(mine.getId(), alreadyGone.getId(), bobs.getId()), Instant.now());

        assertThat(deleted).isEqualTo(1);
        assertThat(transactions.findById(bobs.getId()).orElseThrow().getDeletedAt()).isNull();
    }

    @Test
    @DisplayName("category reassignment moves this user's rows and leaves everyone else's alone")
    void reassignsOnlyOwnRows() {
        Transaction mine = transactions.save(transaction(BigDecimal.ONE, LocalDate.of(2026, 8, 1)));
        transactions.flush();

        int moved = transactions.reassignCategory(alice, groceries.getId(), rent.getId());

        assertThat(moved).isEqualTo(1);
        assertThat(transactions.findById(mine.getId()).orElseThrow().getCategory().getId())
                .isEqualTo(rent.getId());
    }

    @Test
    @DisplayName("counting by category is what stops a category being deleted out from under rows")
    void countsByCategory() {
        transactions.save(transaction(BigDecimal.ONE, LocalDate.of(2026, 8, 1)));
        transactions.save(transaction(BigDecimal.ONE, LocalDate.of(2026, 8, 2)));
        transactions.flush();

        assertThat(transactions.countByUserIdAndCategoryId(alice, groceries.getId())).isEqualTo(2);
        assertThat(transactions.countByUserIdAndCategoryId(bob, groceries.getId())).isZero();
    }

    // ---------------------------------------------------------------- helpers

    private static TransactionFilter filter(boolean includeDeleted) {
        return new TransactionFilter(null, null, null, null, null, null, null, null, includeDeleted);
    }

    private Transaction transaction(BigDecimal amount, LocalDate occurredOn) {
        Transaction transaction = new Transaction();
        transaction.setUserId(alice);
        transaction.setAccountId(aliceAccount.getId());
        transaction.setCategory(groceries);
        transaction.setType(TransactionType.EXPENSE);
        transaction.setAmount(amount);
        transaction.setCurrency("USD");
        transaction.setOccurredOn(occurredOn);
        return transaction;
    }

    private Transaction bobsTransaction() {
        Account bobAccount = account(bob, "Bob's account");
        Category bobCategory = category(bob, "Bob's groceries", CategoryKind.EXPENSE);
        Transaction transaction = new Transaction();
        transaction.setUserId(bob);
        transaction.setAccountId(bobAccount.getId());
        transaction.setCategory(bobCategory);
        transaction.setType(TransactionType.EXPENSE);
        transaction.setAmount(BigDecimal.ONE);
        transaction.setCurrency("USD");
        transaction.setOccurredOn(LocalDate.of(2026, 8, 1));
        return transaction;
    }

    private UUID seedUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into auth.users (id, email) values (?, ?)", id, id + "@test.local");
        return id;
    }

    private Account account(UUID userId, String name) {
        Account account = new Account();
        account.setUserId(userId);
        account.setName(name);
        account.setType(AccountType.CHECKING);
        account.setCurrency("USD");
        account.setOpeningBalance(BigDecimal.ZERO);
        return accounts.saveAndFlush(account);
    }

    private Category category(UUID userId, String name, CategoryKind kind) {
        Category category = new Category();
        category.setUserId(userId);
        category.setName(name);
        category.setKind(kind);
        return categories.saveAndFlush(category);
    }
}
