package com.primeledger.budget;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.primeledger.AbstractIntegrationTest;
import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountType;
import com.primeledger.budget.dto.BudgetRequest;
import com.primeledger.budget.dto.BudgetResponse;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryRepository;
import com.primeledger.common.ApiException;
import com.primeledger.security.RunAs;
import com.primeledger.transaction.Transaction;
import com.primeledger.transaction.TransactionRepository;
import com.primeledger.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.Clock;
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
 * A budget limit is an amount, and it is compared against spending recorded in
 * whatever currencies the user's accounts happen to hold (F-02 × F-05, V8).
 *
 * <p>The defect being pinned here shipped in Phase 5 and was invisible until
 * Phase 6 made a second currency reachable: {@code spendByCategory} summed a
 * category across every account and compared the raw total to the limit. A user
 * with a rupee account and a dollar budget was told they had spent 6,010% of it.
 *
 * <p>{@code @Transactional}, unlike {@code BudgetIntegrationTest}: nothing here
 * emits a notification, so there is no {@code REQUIRES_NEW} boundary to work
 * around — and rolling back matters, because {@code fx_rates} is shared
 * reference data with no owner and rows left behind would be visible to every
 * other test in the suite.
 */
@Transactional
class BudgetCurrencyIntegrationTest extends AbstractIntegrationTest {

    @Autowired private BudgetService budgets;
    @Autowired private TransactionRepository transactions;
    @Autowired private AccountRepository accounts;
    @Autowired private CategoryRepository categories;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private Clock clock;

    private UUID alice;
    private Category groceries;
    private LocalDate today;
    private LocalDate periodStart;

    @BeforeEach
    void setUp() {
        today = LocalDate.now(clock);
        periodStart = today.withDayOfMonth(1);

        alice = seedUser();
        profile(alice, "USD");
        groceries = category(alice, "Groceries " + UUID.randomUUID());

        // Published on the first of the month, so every transaction dated within
        // it converts at a rate that exists. 1 USD buys 300 LKR: 330/1.10.
        rate("EUR", periodStart, "1.0");
        rate("USD", periodStart, "1.10");
        rate("LKR", periodStart, "330.0");
    }

    @Test
    @DisplayName("converts spending into the budget's currency instead of adding the numbers up")
    void convertsSpendIntoTheBudgetCurrency() {
        budget("500.00", "USD");

        spend("50.00", "USD");
        // 30,000 rupees is 100 dollars. Added raw it is 30,000, and the budget
        // reads 6,010% — the bug this test exists for.
        spend("30000.00", "LKR");

        BudgetResponse position = current().getFirst();

        assertThat(position.currency()).isEqualTo("USD");
        assertThat(position.spent()).isEqualTo("150.00");
        assertThat(position.remaining()).isEqualTo("350.00");
        assertThat(position.percentUsed()).isEqualTo(30.0);
        assertThat(position.status()).isEqualTo(BudgetStatus.OK);
    }

    @Test
    @DisplayName("a budget set in rupees measures dollar spending in rupees, not the reverse")
    void convertsInTheOtherDirectionToo() {
        // The limit is never converted — spending is converted into it. A budget
        // is a statement in one currency and stays one.
        budget("150000.00", "LKR");

        spend("100.00", "USD"); // 30,000 LKR
        spend("15000.00", "LKR");

        BudgetResponse position = current().getFirst();

        assertThat(position.currency()).isEqualTo("LKR");
        assertThat(position.spent()).isEqualTo("45000.00");
        assertThat(position.percentUsed()).isEqualTo(30.0);
    }

    /**
     * The failure mode that matters. An unconvertible row is skipped by SUM, so
     * the budget reads comfortably under with no sign that a third of the
     * spending is missing from it.
     */
    @Test
    @DisplayName("counts what it could not convert rather than reporting a budget as under")
    void reportsUnconvertibleSpending() {
        budget("500.00", "USD");

        spend("100.00", "USD");
        // No rate has ever been published for this one.
        spend("9999.00", "XYZ");

        BudgetResponse position = current().getFirst();

        assertThat(position.spent()).isEqualTo("100.00");
        assertThat(position.unconverted()).isEqualTo(1);
    }

    @Test
    @DisplayName("takes the caller's base currency when the request does not name one")
    void defaultsToTheProfileBaseCurrency() {
        budget("500.00", null);

        assertThat(current().getFirst().currency()).isEqualTo("USD");
    }

    /**
     * Re-denominating in place would keep the number and change the meaning,
     * for a period that has already been reported against.
     */
    @Test
    @DisplayName("refuses to change a budget's currency")
    void currencyIsImmutable() {
        budget("500.00", "USD");
        UUID id = UUID.fromString(current().getFirst().id().toString());

        assertThatThrownBy(
                        () ->
                                RunAs.run(
                                        alice,
                                        () ->
                                                budgets.update(
                                                        id,
                                                        new BudgetRequest(
                                                                groceries.getId(),
                                                                BudgetPeriod.MONTHLY,
                                                                new BigDecimal("500.00"),
                                                                null,
                                                                "LKR"))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("currency cannot be changed");
    }

    @Test
    @DisplayName("a single-currency ledger reports exactly what it did before")
    void singleCurrencyIsUnchanged() {
        budget("1000.00", "USD");
        spend("250.00", "USD");

        BudgetResponse position = current().getFirst();

        assertThat(position.spent()).isEqualTo("250.00");
        assertThat(position.percentUsed()).isEqualTo(25.0);
        assertThat(position.unconverted()).isZero();
    }

    // ------------------------------------------------------------------ helpers

    private void budget(String limit, String currency) {
        RunAs.run(
                alice,
                () ->
                        budgets.create(
                                new BudgetRequest(
                                        groceries.getId(),
                                        BudgetPeriod.MONTHLY,
                                        new BigDecimal(limit),
                                        null,
                                        currency)));
    }

    private List<BudgetResponse> current() {
        return RunAs.callUnchecked(alice, budgets::current);
    }

    private void spend(String amount, String currency) {
        Transaction transaction = new Transaction();
        transaction.setUserId(alice);
        transaction.setAccountId(account(currency).getId());
        transaction.setCategory(groceries);
        transaction.setType(TransactionType.EXPENSE);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setCurrency(currency);
        transaction.setOccurredOn(today);
        transactions.saveAndFlush(transaction);
    }

    private void rate(String quote, LocalDate on, String rate) {
        jdbc.update(
                "insert into fx_rates (base, quote, rate_date, rate)"
                        + " values ('EUR', ?, ?, ?::numeric)"
                        + " on conflict (base, quote, rate_date) do update set rate = excluded.rate",
                quote,
                on,
                rate);
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

    private void profile(UUID userId, String baseCurrency) {
        jdbc.update(
                "insert into profiles (id, display_name, base_currency) values (?, ?, ?)",
                userId,
                "Alice",
                baseCurrency);
    }

    private Category category(UUID userId, String name) {
        Category category = new Category();
        category.setUserId(userId);
        category.setName(name);
        category.setKind(CategoryKind.EXPENSE);
        return categories.saveAndFlush(category);
    }
}
