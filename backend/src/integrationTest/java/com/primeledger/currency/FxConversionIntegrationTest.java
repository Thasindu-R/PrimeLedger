package com.primeledger.currency;

import static org.assertj.core.api.Assertions.assertThat;

import com.primeledger.AbstractIntegrationTest;
import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountType;
import com.primeledger.analytics.AnalyticsRepository;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryRepository;
import com.primeledger.transaction.Transaction;
import com.primeledger.transaction.TransactionRepository;
import com.primeledger.transaction.TransactionType;
import com.primeledger.transaction.dto.TransactionFilter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Historical conversion (F-05) — the {@code fx_convert} function in V7 and the
 * aggregates built on it.
 *
 * <p>The requirement being tested is narrower than "converts correctly", and it
 * is the narrow part that is easy to get wrong: <em>a transaction converts at
 * the rate on its own date</em>. A conversion that used today's rate would pass
 * any test that only ever looked at today.
 */
@Transactional
class FxConversionIntegrationTest extends AbstractIntegrationTest {

    private static final LocalDate JANUARY = LocalDate.of(2026, 1, 15);
    private static final LocalDate JUNE = LocalDate.of(2026, 6, 15);

    @Autowired private AnalyticsRepository analytics;
    @Autowired private TransactionRepository transactions;
    @Autowired private AccountRepository accounts;
    @Autowired private CategoryRepository categories;
    @Autowired private JdbcTemplate jdbc;

    private UUID alice;
    private Category groceries;

    @BeforeEach
    void setUp() {
        alice = seedUser();
        groceries = category(alice, "Groceries " + UUID.randomUUID());

        // EUR is the stored base, so its rate against itself is 1. Everything
        // else is triangulated through it.
        rate("EUR", JANUARY, "1.0");
        rate("USD", JANUARY, "1.10");
        rate("GBP", JANUARY, "0.80");

        // By June the dollar has moved a long way. Any conversion of a January
        // transaction that uses these numbers is the bug.
        rate("EUR", JUNE, "1.0");
        rate("USD", JUNE, "2.20");
        rate("GBP", JUNE, "0.80");
    }

    @Test
    @DisplayName("converts at the rate on the transaction's own date, not today's")
    void convertsHistorically() {
        // 110 dollars in January, when a euro bought 1.10 dollars: 100 euros.
        // At June's rate it would be 50, and that is the number this must not
        // produce however long ago January was.
        spend("110.00", "USD", JANUARY);

        assertThat(expenseTotal("EUR")).isEqualByComparingTo("100.00");
    }

    @Test
    @DisplayName("a past total does not move when a later rate does")
    void pastTotalsAreStable() {
        spend("110.00", "USD", JANUARY);
        BigDecimal beforeTheMove = expenseTotal("EUR");

        // A new, wildly different rate published today.
        rate("USD", LocalDate.of(2026, 12, 1), "9.99");

        assertThat(expenseTotal("EUR")).isEqualByComparingTo(beforeTheMove);
    }

    @Test
    @DisplayName("uses the most recent rate on or before the date, because weekends exist")
    void fallsBackToTheLastPublishedRate() {
        // Nothing is published on the 20th; January's rate is the one in force.
        spend("110.00", "USD", JANUARY.plusDays(5));

        assertThat(expenseTotal("EUR")).isEqualByComparingTo("100.00");
    }

    @Test
    @DisplayName("same currency in and out is left exactly alone")
    void identityConversionIsExact() {
        spend("1234.56", "EUR", JANUARY);

        assertThat(expenseTotal("EUR")).isEqualByComparingTo("1234.56");
    }

    @Test
    @DisplayName("cross rates go through the base: dollars to pounds at January's rates")
    void triangulatesThroughTheBase() {
        // 110 USD is 100 EUR is 80 GBP.
        spend("110.00", "USD", JANUARY);

        assertThat(expenseTotal("GBP")).isEqualByComparingTo("80.00");
    }

    @Test
    @DisplayName("sums two currencies into one figure")
    void addsAcrossCurrencies() {
        spend("110.00", "USD", JANUARY); // 100 EUR
        spend("80.00", "GBP", JANUARY); // 100 EUR

        assertThat(expenseTotal("EUR")).isEqualByComparingTo("200.00");
    }

    @Test
    @DisplayName("counts what it could not convert instead of silently dropping it")
    void reportsUnconvertibleRows() {
        spend("110.00", "USD", JANUARY);
        // No rate has ever been published for this currency.
        spend("5000.00", "LKR", JANUARY);

        AnalyticsRepository.TypeTotal expenses = expenses("EUR");

        assertThat(expenses.count()).isEqualTo(2);
        assertThat(expenses.unconvertible()).isEqualTo(1);
        // The rupees are absent from the sum — which is exactly why the count
        // above has to be reported rather than assumed to be zero.
        assertThat(expenses.total()).isEqualByComparingTo("100.00");
    }

    @Test
    @DisplayName("a transaction older than every stored rate is unconvertible, not mispriced")
    void datesBeforeTheFirstRateAreUnconvertible() {
        spend("110.00", "USD", JANUARY.minusYears(5));

        assertThat(expenses("EUR").unconvertible()).isEqualTo(1);
    }

    // ------------------------------------------------------------------ helpers

    private AnalyticsRepository.TypeTotal expenses(String baseCurrency) {
        List<AnalyticsRepository.TypeTotal> totals =
                analytics.totalsByType(alice, unfiltered(), baseCurrency);
        return totals.stream()
                .filter(row -> row.type() == TransactionType.EXPENSE)
                .findFirst()
                .orElseThrow();
    }

    private BigDecimal expenseTotal(String baseCurrency) {
        return expenses(baseCurrency).total();
    }

    private static TransactionFilter unfiltered() {
        return new TransactionFilter(null, null, null, null, null, null, null, null, false);
    }

    private void rate(String quote, LocalDate on, String rate) {
        jdbc.update(
                "insert into fx_rates (base, quote, rate_date, rate) values ('EUR', ?, ?, ?::numeric)"
                        + " on conflict (base, quote, rate_date) do update set rate = excluded.rate",
                quote,
                on,
                rate);
    }

    private void spend(String amount, String currency, LocalDate on) {
        Transaction transaction = new Transaction();
        transaction.setUserId(alice);
        transaction.setAccountId(account(currency).getId());
        transaction.setCategory(groceries);
        transaction.setType(TransactionType.EXPENSE);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setCurrency(currency);
        transaction.setOccurredOn(on);
        transactions.saveAndFlush(transaction);
    }

    private Account account(String currency) {
        Account account = new Account();
        account.setUserId(alice);
        account.setName(currency + " " + UUID.randomUUID());
        account.setType(AccountType.CHECKING);
        account.setCurrency(currency);
        account.setOpeningBalance(BigDecimal.ZERO);
        return accounts.saveAndFlush(account);
    }

    private UUID seedUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into auth.users (id, email) values (?, ?)", id, id + "@test.local");
        return id;
    }

    private Category category(UUID userId, String name) {
        Category category = new Category();
        category.setUserId(userId);
        category.setName(name);
        category.setKind(CategoryKind.EXPENSE);
        return categories.saveAndFlush(category);
    }
}
