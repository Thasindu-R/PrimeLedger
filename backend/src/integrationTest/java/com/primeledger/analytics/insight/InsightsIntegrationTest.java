package com.primeledger.analytics.insight;

import static org.assertj.core.api.Assertions.assertThat;

import com.primeledger.AbstractIntegrationTest;
import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountType;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryRepository;
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
 * The half of F-07 the rule tests cannot cover: gathering the facts.
 *
 * <p>{@code InsightRuleTest} proves the rules say the right thing about a set of
 * numbers. What it cannot prove is that those numbers are the right ones — that
 * the trailing window really is the three months before this one, that "last
 * month" is the same span rather than all of it, and that the totals arrive
 * converted. Those are all questions about the queries, so they need a database.
 */
@Transactional
class InsightsIntegrationTest extends AbstractIntegrationTest {

    @Autowired private InsightsService insights;
    @Autowired private TransactionRepository transactions;
    @Autowired private AccountRepository accounts;
    @Autowired private CategoryRepository categories;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private Clock clock;

    private UUID alice;
    private Account account;
    private Category food;
    private LocalDate today;
    private LocalDate monthStart;

    @BeforeEach
    void setUp() {
        today = LocalDate.now(clock);
        monthStart = today.withDayOfMonth(1);

        alice = seedUser();
        profile(alice);
        account = account(alice);
        food = category(alice, "Food " + UUID.randomUUID());
    }

    @Test
    @DisplayName("notices a category that has risen against the same span of last month")
    void reportsACategoryShift() {
        spend("1000.00", monthStart.minusMonths(1));
        spend("1340.00", monthStart);

        List<Insight> found = RunAs.callUnchecked(alice, insights::forCurrentUser);

        assertThat(found)
                .filteredOn(insight -> insight.kind() == InsightKind.CATEGORY_SHIFT)
                .singleElement()
                .satisfies(
                        insight -> {
                            assertThat(insight.subjectId()).isEqualTo(food.getId());
                            assertThat(insight.detail()).contains("34%");
                        });
    }

    /**
     * The window boundary that is easy to get wrong and impossible to see: last
     * month means the same number of days into it, not all of it.
     */
    @Test
    @DisplayName("compares like spans, so late-month spending last month is not counted")
    void comparesTheSameSpan() {
        LocalDate lastMonthEnd = monthStart.minusDays(1);
        // Dated the final day of last month. It is only inside the comparison
        // window if today is that far into this month.
        spend("5000.00", lastMonthEnd);
        spend("1000.00", monthStart);

        InsightContext context = RunAs.callUnchecked(alice, () -> insights.contextFor(alice));

        boolean lastMonthFullyElapsed = today.getDayOfMonth() >= lastMonthEnd.getDayOfMonth();
        BigDecimal expected =
                lastMonthFullyElapsed ? new BigDecimal("5000.00") : BigDecimal.ZERO;

        assertThat(context.lastMonth().values().stream()
                        .map(InsightContext.CategoryFigure::total)
                        .reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo(expected);
    }

    @Test
    @DisplayName("draws the usual from the three months before this one, not this one")
    void trailingWindowExcludesTheCurrentMonth() {
        spend("60.00", monthStart.minusMonths(1));
        spend("40.00", monthStart.minusMonths(2));
        // This month's spending must not dilute the mean it is about to be
        // compared against.
        spend("9000.00", monthStart);

        InsightContext context = RunAs.callUnchecked(alice, () -> insights.contextFor(alice));

        assertThat(context.trailingMean().get(food.getId())).isEqualByComparingTo("50.00");
    }

    @Test
    @DisplayName("a ledger with nothing in it produces no observations rather than an error")
    void emptyLedgerIsQuiet() {
        assertThat(RunAs.callUnchecked(alice, insights::forCurrentUser)).isEmpty();
    }

    @Test
    @DisplayName("the month's totals reach the context")
    void gathersMonthTotals() {
        spend("250.00", monthStart);
        earn("1000.00", monthStart);

        InsightContext context = RunAs.callUnchecked(alice, () -> insights.contextFor(alice));

        assertThat(context.expenseThisMonth()).isEqualByComparingTo("250.00");
        assertThat(context.incomeThisMonth()).isEqualByComparingTo("1000.00");
        assertThat(context.currency()).isEqualTo("USD");
    }

    // ------------------------------------------------------------------ helpers

    private void spend(String amount, LocalDate on) {
        write(amount, on, TransactionType.EXPENSE);
    }

    private void earn(String amount, LocalDate on) {
        write(amount, on, TransactionType.INCOME);
    }

    private void write(String amount, LocalDate on, TransactionType type) {
        Transaction transaction = new Transaction();
        transaction.setUserId(alice);
        transaction.setAccountId(account.getId());
        transaction.setCategory(food);
        transaction.setType(type);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setCurrency("USD");
        transaction.setOccurredOn(on);
        transactions.saveAndFlush(transaction);
    }

    private UUID seedUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into auth.users (id, email) values (?, ?)", id, id + "@test.local");
        return id;
    }

    private void profile(UUID userId) {
        jdbc.update(
                "insert into profiles (id, display_name, base_currency) values (?, ?, 'USD')",
                userId,
                "Alice");
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

    private Category category(UUID userId, String name) {
        Category category = new Category();
        category.setUserId(userId);
        category.setName(name);
        category.setKind(CategoryKind.EXPENSE);
        return categories.saveAndFlush(category);
    }
}
