package com.primeledger.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import com.primeledger.AbstractIntegrationTest;
import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountType;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryRepository;
import com.primeledger.transaction.Transaction;
import com.primeledger.transaction.TransactionRepository;
import com.primeledger.transaction.TransactionType;
import com.primeledger.transaction.dto.TransactionFilter;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * The grouped aggregates against real PostgreSQL.
 *
 * <p>These cannot be checked by reading the code: {@code to_char} is rendered by
 * Hibernate and executed by Postgres, and whether the resulting {@code GROUP BY}
 * is even legal is a question only the database can answer.
 */
@Transactional
class AnalyticsRepositoryIntegrationTest extends AbstractIntegrationTest {

    /**
     * The reporting currency for these tests, and the same one every fixture
     * transaction is in.
     *
     * <p>Deliberately matched, so {@code fx_convert} takes its identity branch
     * and returns each amount untouched without consulting a rate. The subject
     * here is grouping and filtering; conversion has its own suite in {@code
     * FxConversionIntegrationTest}, and coupling these tests to a rate table
     * would make a grouping failure and a missing exchange rate look identical.
     */
    private static final String BASE = "USD";

    @Autowired private AnalyticsRepository analytics;
    @Autowired private TransactionRepository transactions;
    @Autowired private AccountRepository accounts;
    @Autowired private CategoryRepository categories;
    @Autowired private JdbcTemplate jdbc;

    private UUID alice;
    private UUID bob;
    private Account aliceAccount;
    private Category groceries;
    private Category salary;

    @BeforeEach
    void setUp() {
        alice = seedUser();
        bob = seedUser();
        aliceAccount = account(alice, "Everyday");
        groceries = category(alice, "Groceries", CategoryKind.EXPENSE);
        salary = category(alice, "Salary", CategoryKind.INCOME);
    }

    @Test
    @DisplayName("totals are summed per type, not lumped together")
    void sumsPerType() {
        save(expense("40.00", LocalDate.of(2026, 8, 1)));
        save(expense("2.50", LocalDate.of(2026, 8, 2)));
        save(income("1000.00", LocalDate.of(2026, 8, 3)));

        var totals = analytics.totalsByType(alice, unfiltered(), BASE);

        assertThat(totals)
                .extracting(AnalyticsRepository.TypeTotal::type)
                .containsExactlyInAnyOrder(TransactionType.EXPENSE, TransactionType.INCOME);
        assertThat(amountFor(totals, TransactionType.EXPENSE)).isEqualByComparingTo("42.50");
        assertThat(amountFor(totals, TransactionType.INCOME)).isEqualByComparingTo("1000.00");
    }

    @Test
    @DisplayName("counts the rows and finds the largest, per type")
    void countsAndFindsTheLargest() {
        save(expense("10.00", LocalDate.of(2026, 8, 1)));
        save(expense("9999.00", LocalDate.of(2025, 1, 1)));
        save(expense("10.00", LocalDate.of(2026, 8, 2)));
        save(income("50.00", LocalDate.of(2026, 8, 3)));

        var totals = analytics.totalsByType(alice, unfiltered(), BASE);

        var expenses =
                totals.stream().filter(row -> row.type() == TransactionType.EXPENSE).findFirst();

        // The dashboard shows both, and neither can be derived from a page: the
        // count would be the page size, and the largest expense here is the
        // oldest row, which the default newest-first ordering puts off page one.
        assertThat(expenses).get().satisfies(row -> {
            assertThat(row.count()).isEqualTo(3);
            assertThat(row.largest()).isEqualByComparingTo("9999.00");
        });
    }

    @Test
    @DisplayName("exact decimals survive summation — no float drift")
    void sumsExactly() {
        save(expense("0.10", LocalDate.of(2026, 8, 1)));
        save(expense("0.20", LocalDate.of(2026, 8, 2)));

        var totals = analytics.totalsByType(alice, unfiltered(), BASE);

        // 0.1 + 0.2 is famously not 0.3 in binary floating point. NUMERIC(15,2)
        // all the way through is the whole reason amounts are BigDecimal (§7.3).
        assertThat(amountFor(totals, TransactionType.EXPENSE)).isEqualByComparingTo("0.30");
    }

    @Test
    @DisplayName("the same month in two different years stays in two buckets (D-02)")
    void bucketsByYearAndMonth() {
        save(expense("10.00", LocalDate.of(2025, 1, 15)));
        save(expense("25.00", LocalDate.of(2026, 1, 15)));

        var monthly = analytics.totalsByMonth(alice, unfiltered(), BASE);

        assertThat(monthly)
                .extracting(AnalyticsRepository.MonthlyTotal::month)
                .containsExactly("2025-01", "2026-01");
        assertThat(monthly.getFirst().total()).isEqualByComparingTo("10.00");
        assertThat(monthly.getLast().total()).isEqualByComparingTo("25.00");
    }

    @Test
    @DisplayName("a month with both income and expense produces one row per type")
    void splitsAMonthByType() {
        save(expense("40.00", LocalDate.of(2026, 8, 1)));
        save(income("100.00", LocalDate.of(2026, 8, 2)));

        var monthly = analytics.totalsByMonth(alice, unfiltered(), BASE);

        assertThat(monthly).hasSize(2);
        assertThat(monthly)
                .allSatisfy(row -> assertThat(row.month()).isEqualTo("2026-08"))
                .extracting(AnalyticsRepository.MonthlyTotal::type)
                .containsExactlyInAnyOrder(TransactionType.EXPENSE, TransactionType.INCOME);
    }

    @Test
    @DisplayName("months come back oldest first, so the client need not re-sort")
    void ordersMonthsAscending() {
        save(expense("1.00", LocalDate.of(2026, 3, 1)));
        save(expense("1.00", LocalDate.of(2025, 11, 1)));
        save(expense("1.00", LocalDate.of(2026, 1, 1)));

        assertThat(analytics.totalsByMonth(alice, unfiltered(), BASE))
                .extracting(AnalyticsRepository.MonthlyTotal::month)
                .containsExactly("2025-11", "2026-01", "2026-03");
    }

    @Test
    @DisplayName("category totals carry the name and count, largest first")
    void groupsByCategory() {
        Category rent = category(alice, "Rent", CategoryKind.EXPENSE);
        save(expense("5.00", LocalDate.of(2026, 8, 1)));
        save(expense("5.00", LocalDate.of(2026, 8, 2)));
        Transaction big = expense("900.00", LocalDate.of(2026, 8, 3));
        big.setCategory(rent);
        save(big);

        var byCategory = analytics.totalsByCategory(alice, unfiltered(), BASE);

        assertThat(byCategory)
                .extracting(AnalyticsRepository.CategoryTotal::categoryName)
                .containsExactly("Rent", "Groceries");
        assertThat(byCategory.getLast().count()).isEqualTo(2);
        assertThat(byCategory.getLast().total()).isEqualByComparingTo("10.00");
    }

    @Test
    @DisplayName("soft-deleted rows are excluded, exactly as they are from the list")
    void excludesSoftDeleted() {
        save(expense("10.00", LocalDate.of(2026, 8, 1)));
        Transaction gone = expense("999.00", LocalDate.of(2026, 8, 2));
        gone.setDeletedAt(Instant.now());
        save(gone);

        assertThat(amountFor(analytics.totalsByType(alice, unfiltered(), BASE), TransactionType.EXPENSE))
                .isEqualByComparingTo("10.00");
    }

    @Test
    @DisplayName("the date filter narrows the summary the same way it narrows the list")
    void honoursTheDateFilter() {
        save(expense("10.00", LocalDate.of(2025, 12, 31)));
        save(expense("20.00", LocalDate.of(2026, 1, 1)));

        var filter =
                new TransactionFilter(
                        LocalDate.of(2026, 1, 1), null, null, null, null, null, null, null, false);

        assertThat(amountFor(analytics.totalsByType(alice, filter, BASE), TransactionType.EXPENSE))
                .isEqualByComparingTo("20.00");
    }

    @Test
    @DisplayName("one user's totals never include another's rows")
    void isolatesUsers() {
        save(expense("10.00", LocalDate.of(2026, 8, 1)));

        assertThat(analytics.totalsByType(bob, unfiltered(), BASE)).isEmpty();
        assertThat(analytics.totalsByCategory(bob, unfiltered(), BASE)).isEmpty();
        assertThat(analytics.totalsByMonth(bob, unfiltered(), BASE)).isEmpty();
    }

    @Test
    @DisplayName("an empty ledger produces no rows rather than a row of zeroes")
    void returnsNothingWhenEmpty() {
        assertThat(analytics.totalsByType(alice, unfiltered(), BASE)).isEmpty();
    }

    // ---------------------------------------------------------------- helpers

    private static TransactionFilter unfiltered() {
        return new TransactionFilter(null, null, null, null, null, null, null, null, false);
    }

    private static BigDecimal amountFor(
            java.util.List<AnalyticsRepository.TypeTotal> totals, TransactionType type) {
        return totals.stream()
                .filter(row -> row.type() == type)
                .map(AnalyticsRepository.TypeTotal::total)
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    private void save(Transaction transaction) {
        transactions.saveAndFlush(transaction);
    }

    private Transaction expense(String amount, LocalDate occurredOn) {
        return transaction(amount, occurredOn, TransactionType.EXPENSE, groceries);
    }

    private Transaction income(String amount, LocalDate occurredOn) {
        return transaction(amount, occurredOn, TransactionType.INCOME, salary);
    }

    private Transaction transaction(
            String amount, LocalDate occurredOn, TransactionType type, Category category) {
        Transaction transaction = new Transaction();
        transaction.setUserId(alice);
        transaction.setAccountId(aliceAccount.getId());
        transaction.setCategory(category);
        transaction.setType(type);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setCurrency("USD");
        transaction.setOccurredOn(occurredOn);
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
