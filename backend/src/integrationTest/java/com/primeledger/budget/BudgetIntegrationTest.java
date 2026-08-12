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
import com.primeledger.notification.NotificationRepository;
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

/**
 * Budgets and their threshold alerts (F-02).
 *
 * <p>Deliberately <strong>not</strong> {@code @Transactional}. Notifications are
 * emitted in a {@code REQUIRES_NEW} transaction — they have to be, or a
 * duplicate alert would poison the transaction that triggered it — and that
 * separate transaction cannot see a budget row the test has not committed. A
 * rolled-back test would fail on the foreign key for reasons that have nothing
 * to do with the behaviour under test. Each test uses a fresh user instead.
 */
class BudgetIntegrationTest extends AbstractIntegrationTest {

    @Autowired private BudgetService budgets;
    @Autowired private BudgetEvaluator evaluator;
    @Autowired private BudgetRepository budgetRepository;
    @Autowired private BudgetSweepRepository sweepRepository;
    @Autowired private NotificationRepository notifications;
    @Autowired private TransactionRepository transactions;
    @Autowired private AccountRepository accounts;
    @Autowired private CategoryRepository categories;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private Clock clock;

    private UUID alice;
    private Account account;
    private Category groceries;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        alice = seedUser();
        account = account(alice);
        groceries = category(alice, "Groceries " + UUID.randomUUID(), CategoryKind.EXPENSE);
        today = LocalDate.now(clock);
    }

    @Test
    @DisplayName("reports spend for the current period against the limit")
    void reportsPosition() {
        budget("1000.00");
        spend("250.00", today);

        BudgetResponse position = current().getFirst();

        assertThat(position.spent()).isEqualTo("250.00");
        assertThat(position.remaining()).isEqualTo("750.00");
        assertThat(position.percentUsed()).isEqualTo(25.0);
        assertThat(position.status()).isEqualTo(BudgetStatus.OK);
        assertThat(position.periodStart()).isEqualTo(today.withDayOfMonth(1));
    }

    @Test
    @DisplayName("spending in a different month does not count against this month")
    void isPeriodScoped() {
        budget("1000.00");
        spend("900.00", today.minusMonths(2));

        assertThat(current().getFirst().spent()).isEqualTo("0.00");
    }

    @Test
    @DisplayName("a transfer out is not spending and never counts against a budget")
    void ignoresTransfers() {
        budget("1000.00");

        Transaction leg = expense("900.00", today);
        leg.setCategory(null);
        leg.setTransfer(true);
        transactions.saveAndFlush(leg);

        // Telling a user they blew their grocery budget by moving money into
        // savings would be worse than not having budgets at all.
        assertThat(current().getFirst().spent()).isEqualTo("0.00");
    }

    @Test
    @DisplayName("turns amber at 80% and red at 100%")
    void tracksStatusThresholds() {
        budget("100.00");

        spend("80.00", today);
        assertThat(current().getFirst().status()).isEqualTo(BudgetStatus.WARNING);

        spend("25.00", today);
        BudgetResponse over = current().getFirst();
        assertThat(over.status()).isEqualTo(BudgetStatus.EXCEEDED);
        assertThat(over.percentUsed()).isEqualTo(105.0);
        // Uncapped and negative: "over by 5.00" is the fact the user needs.
        assertThat(over.remaining()).isEqualTo("-5.00");
    }

    @Test
    @DisplayName("emits one alert per threshold per period, however often it is evaluated")
    void emitsIdempotently() {
        budget("100.00");
        spend("85.00", today);

        assertThat(evaluate()).isEqualTo(1);

        // The evaluator runs after every write and again nightly. Without the
        // unique index in V4 this is where the bell fills up with duplicates.
        assertThat(evaluate()).isZero();
        assertThat(evaluate()).isZero();

        assertThat(unreadFor(alice)).hasSize(1);
        assertThat(unreadFor(alice).getFirst().getThreshold()).isEqualTo((short) 80);
    }

    @Test
    @DisplayName("crossing 100 later still alerts, because it is a different threshold")
    void alertsAgainAtTheHigherThreshold() {
        budget("100.00");
        spend("85.00", today);
        evaluate();

        spend("30.00", today);
        assertThat(evaluate()).isEqualTo(1);

        assertThat(unreadFor(alice))
                .extracting(n -> n.getThreshold())
                .containsExactlyInAnyOrder((short) 80, (short) 100);
    }

    @Test
    @DisplayName("jumping straight past both thresholds reports being over, not a stale warning")
    void reportsOnlyTheHighestThresholdCrossed() {
        budget("100.00");
        spend("400.00", today);

        assertThat(evaluate()).isEqualTo(1);
        assertThat(unreadFor(alice)).singleElement().satisfies(
                n -> assertThat(n.getThreshold()).isEqualTo((short) 100));
    }

    @Test
    @DisplayName("staying under budget says nothing at all")
    void staysQuietUnderTheLimit() {
        budget("1000.00");
        spend("100.00", today);

        assertThat(evaluate()).isZero();
        assertThat(unreadFor(alice)).isEmpty();
    }

    @Test
    @DisplayName("a superseded limit leaves earlier periods reporting the limit that applied")
    void keepsHistory() {
        LocalDate lastMonth = today.minusMonths(1).withDayOfMonth(1);
        RunAs.run(
                alice,
                () ->
                        budgets.create(
                                new BudgetRequest(
                                        groceries.getId(),
                                        BudgetPeriod.MONTHLY,
                                        new BigDecimal("500.00"),
                                        lastMonth)));
        budget("1000.00");

        // Both rows survive; the current one is the one in force.
        assertThat(budgetRepository.findByUserIdOrderByStartsOnDescIdAsc(alice)).hasSize(2);
        assertThat(current()).singleElement().satisfies(
                b -> assertThat(b.limitAmount()).isEqualTo("1000.00"));
    }

    @Test
    @DisplayName("refuses a budget on an income category")
    void refusesIncomeCategory() {
        Category salary = category(alice, "Salary " + UUID.randomUUID(), CategoryKind.INCOME);

        assertThatThrownBy(
                        () ->
                                RunAs.run(
                                        alice,
                                        () ->
                                                budgets.create(
                                                        new BudgetRequest(
                                                                salary.getId(),
                                                                BudgetPeriod.MONTHLY,
                                                                new BigDecimal("100.00"),
                                                                null))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("income category");
    }

    @Test
    @DisplayName("refuses a monthly budget that does not start on the first of a month")
    void refusesMidPeriodStart() {
        assertThatThrownBy(
                        () ->
                                RunAs.run(
                                        alice,
                                        () ->
                                                budgets.create(
                                                        new BudgetRequest(
                                                                groceries.getId(),
                                                                BudgetPeriod.MONTHLY,
                                                                new BigDecimal("100.00"),
                                                                today.withDayOfMonth(17)))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("first day");
    }

    @Test
    @DisplayName("the sweep can enumerate users despite row-level security")
    void sweepSeesUsersWithBudgets() {
        budget("100.00");

        // The one thing RLS deliberately prevents a background job from doing,
        // granted through the narrow SECURITY DEFINER function in V6.
        assertThat(sweepRepository.usersWithBudgets()).contains(alice);
    }

    @Test
    @DisplayName("the sweep alerts a user who has gone over without touching anyone else")
    void sweepEmitsForOverspentUsers() {
        budget("100.00");
        spend("150.00", today);

        UUID bob = seedUser();

        assertThat(evaluator.sweep()).isGreaterThanOrEqualTo(1);
        assertThat(unreadFor(alice)).isNotEmpty();
        assertThat(unreadFor(bob)).isEmpty();
    }

    // ---------------------------------------------------------------- helpers

    private void budget(String limit) {
        RunAs.run(
                alice,
                () ->
                        budgets.create(
                                new BudgetRequest(
                                        groceries.getId(),
                                        BudgetPeriod.MONTHLY,
                                        new BigDecimal(limit),
                                        null)));
    }

    private List<BudgetResponse> current() {
        return RunAs.callUnchecked(alice, budgets::current);
    }

    private int evaluate() {
        return RunAs.callUnchecked(alice, () -> evaluator.evaluate(alice));
    }

    private void spend(String amount, LocalDate on) {
        transactions.saveAndFlush(expense(amount, on));
    }

    private Transaction expense(String amount, LocalDate on) {
        Transaction expense = new Transaction();
        expense.setUserId(alice);
        expense.setAccountId(account.getId());
        expense.setCategory(groceries);
        expense.setType(TransactionType.EXPENSE);
        expense.setAmount(new BigDecimal(amount));
        expense.setCurrency("USD");
        expense.setOccurredOn(on);
        return expense;
    }

    private List<com.primeledger.notification.Notification> unreadFor(UUID userId) {
        return notifications.findAll().stream()
                .filter(n -> n.getUserId().equals(userId))
                .toList();
    }

    private UUID seedUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into auth.users (id, email) values (?, ?)", id, id + "@test.local");
        return id;
    }

    private Account account(UUID userId) {
        Account account = new Account();
        account.setUserId(userId);
        account.setName("Everyday " + UUID.randomUUID());
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
