package com.primeledger.recurring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.primeledger.AbstractIntegrationTest;
import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountType;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryRepository;
import com.primeledger.common.ApiException;
import com.primeledger.recurring.dto.RecurringRuleRequest;
import com.primeledger.recurring.dto.RecurringRuleResponse;
import com.primeledger.security.RunAs;
import com.primeledger.transaction.Transaction;
import com.primeledger.transaction.TransactionRepository;
import com.primeledger.transaction.TransactionType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Recurring rules and the materialiser (F-03).
 *
 * <p>Deliberately <strong>not</strong> {@code @Transactional}, for the same
 * reason as {@code BudgetIntegrationTest} and one more. The writer runs each
 * rule in a {@code REQUIRES_NEW} transaction — that boundary is the idempotency
 * design, not an implementation detail — and a separate transaction cannot see a
 * rule the test has not committed. Testing it inside a rolling-back transaction
 * would be testing something else. Each test uses a fresh user instead.
 */
class RecurringIntegrationTest extends AbstractIntegrationTest {

    @Autowired private RecurringRuleService rules;
    @Autowired private RecurringRuleRepository ruleRepository;
    @Autowired private RecurringMaterialiser materialiser;
    @Autowired private RecurringDueRepository dueRepository;
    @Autowired private TransactionRepository transactions;
    @Autowired private AccountRepository accounts;
    @Autowired private CategoryRepository categories;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private Clock clock;

    private UUID alice;
    private Account account;
    private Category rent;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        alice = seedUser();
        account = account(alice, "USD");
        rent = category(alice, "Rent " + UUID.randomUUID(), CategoryKind.EXPENSE);
        today = LocalDate.now(clock);
    }

    @Test
    @DisplayName("catches up every occurrence missed since the start date")
    void materialisesBackdatedOccurrences() {
        // Three months back: today's occurrence plus the two before it.
        LocalDate startsOn = today.minusMonths(3);
        create(rule(startsOn, Frequency.MONTHLY, 1, null));

        assertThat(run()).isEqualTo(4);
        assertThat(occurrenceDates())
                .containsExactly(
                        startsOn,
                        startsOn.plusMonths(1),
                        startsOn.plusMonths(2),
                        startsOn.plusMonths(3));
    }

    @Test
    @DisplayName("a second run creates nothing — the missed-night case, twice over")
    void isIdempotent() {
        create(rule(today.minusMonths(2), Frequency.MONTHLY, 1, null));

        int first = run();
        int second = run();

        assertThat(first).isEqualTo(3);
        assertThat(second).isZero();
        assertThat(occurrenceDates()).hasSize(3);
    }

    @Test
    @DisplayName("a deleted instance is not resurrected by the next catch-up")
    void doesNotRegenerateADeletedInstance() {
        create(rule(today.minusMonths(1), Frequency.MONTHLY, 1, null));
        run();

        // The user deletes one of the generated rows: they did not want that
        // month's charge. Soft delete, which is what the API does.
        Transaction first = generated().getFirst();
        first.setDeletedAt(Instant.now(clock));
        transactions.saveAndFlush(first);

        // Rewinding the cursor is the situation a restored backup or a corrected
        // rule would produce; without the occurrence check it would rewrite the
        // row the user removed.
        rewindCursorTo(today.minusMonths(1));

        assertThat(run()).isZero();
        assertThat(transactions.findById(first.getId()).orElseThrow().getDeletedAt()).isNotNull();
    }

    @Test
    @DisplayName("advances the cursor past occurrences it skipped, rather than retrying for ever")
    void advancesPastSkippedOccurrences() {
        RecurringRuleResponse created = create(rule(today.minusMonths(1), Frequency.MONTHLY, 1, null));
        run();
        rewindCursorTo(today.minusMonths(1));

        run();

        RecurringRule after = ruleRepository.findByIdAndUserId(created.id(), alice).orElseThrow();
        assertThat(after.getNextRunOn()).isAfter(today);
    }

    @Test
    @DisplayName("a paused rule is not materialised and is not enumerated as due")
    void pausedRuleDoesNothing() {
        RecurringRuleRequest request = rule(today.minusMonths(1), Frequency.MONTHLY, 1, null);
        create(
                new RecurringRuleRequest(
                        request.name(),
                        request.accountId(),
                        request.categoryId(),
                        request.type(),
                        request.amount(),
                        request.description(),
                        request.frequency(),
                        request.interval(),
                        request.startsOn(),
                        request.endsOn(),
                        true));

        assertThat(run()).isZero();
        assertThat(dueRepository.usersWithRulesDue(today)).doesNotContain(alice);
    }

    @Test
    @DisplayName("stops at the end date and reports itself finished")
    void honoursTheEndDate() {
        LocalDate startsOn = today.minusMonths(3);
        // An end date between the second and third occurrence.
        create(rule(startsOn, Frequency.MONTHLY, 1, startsOn.plusMonths(1)));

        assertThat(run()).isEqualTo(2);

        RecurringRuleResponse after = list().getFirst();
        assertThat(after.finished()).isTrue();
        assertThat(after.nextRunOn()).isNull();
        assertThat(run()).isZero();
    }

    /**
     * The refusal itself is the easy half. The half worth a test is that the
     * message names the date: it is built by concatenating two literals and
     * formatting them, and {@code .formatted} binds to the second literal alone
     * unless the concatenation is parenthesised — which leaves a raw {@code %s}
     * in front of the user and no way to tell how far back is far enough.
     */
    @Test
    @DisplayName("refuses a rule dated further back than the backfill limit, and says how far")
    void refusesAbsurdBackdating() {
        RecurringRuleRequest tooOld = rule(today.minusYears(5), Frequency.DAILY, 1, null);

        assertThatThrownBy(() -> create(tooOld))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining(today.minusMonths(24).toString())
                .hasMessageNotContaining("%s");
    }

    @Test
    @DisplayName("the rule takes its currency from the account, whatever the request said")
    void currencyComesFromTheAccount() {
        Account euros = account(alice, "EUR");

        RecurringRuleResponse created =
                create(
                        new RecurringRuleRequest(
                                "Subscription " + UUID.randomUUID(),
                                euros.getId(),
                                rent.getId(),
                                TransactionType.EXPENSE,
                                new BigDecimal("9.99"),
                                null,
                                Frequency.MONTHLY,
                                1,
                                today,
                                null,
                                null));

        assertThat(created.currency()).isEqualTo("EUR");

        run();
        assertThat(generated().getFirst().getCurrency()).isEqualTo("EUR");
    }

    @Test
    @DisplayName("deleting a rule keeps the transactions it generated and severs them")
    void deleteRetainsTransactions() {
        RecurringRuleResponse created = create(rule(today.minusMonths(1), Frequency.MONTHLY, 1, null));
        run();
        assertThat(generated()).hasSize(2);

        RunAs.run(alice, () -> rules.delete(created.id()));

        assertThat(ruleRepository.findByIdAndUserId(created.id(), alice)).isEmpty();

        List<Transaction> survivors =
                transactions.findAll().stream()
                        .filter(t -> alice.equals(t.getUserId()))
                        .toList();
        assertThat(survivors).hasSize(2);
        assertThat(survivors).allSatisfy(t -> assertThat(t.getRecurringRuleId()).isNull());
    }

    @Test
    @DisplayName("the sweep finds a user through the SECURITY DEFINER enumerator")
    void sweepEnumeratesUsersWithDueRules() {
        create(rule(today, Frequency.MONTHLY, 1, null));

        assertThat(dueRepository.usersWithRulesDue(today)).contains(alice);
        assertThat(materialiser.sweep()).isPositive();
        assertThat(occurrenceDates()).containsExactly(today);
    }

    @Test
    @DisplayName("generated transactions are ordinary rows: editable, and not transfers")
    void generatedRowsAreOrdinary() {
        create(rule(today, Frequency.MONTHLY, 1, null));
        run();

        Transaction generated = generated().getFirst();
        assertThat(generated.isTransfer()).isFalse();
        assertThat(generated.getDeletedAt()).isNull();
        assertThat(generated.getCategory().getId()).isEqualTo(rent.getId());
        assertThat(generated.getAccountId()).isEqualTo(account.getId());
        assertThat(generated.getAmount()).isEqualByComparingTo("1500.00");
    }

    // ------------------------------------------------------------------ helpers

    private RecurringRuleRequest rule(
            LocalDate startsOn, Frequency frequency, int interval, LocalDate endsOn) {
        return new RecurringRuleRequest(
                "Rent " + UUID.randomUUID(),
                account.getId(),
                rent.getId(),
                TransactionType.EXPENSE,
                new BigDecimal("1500.00"),
                null,
                frequency,
                interval,
                startsOn,
                endsOn,
                null);
    }

    private RecurringRuleResponse create(RecurringRuleRequest request) {
        return RunAs.callUnchecked(alice, () -> rules.create(request));
    }

    private List<RecurringRuleResponse> list() {
        return RunAs.callUnchecked(alice, rules::list);
    }

    private int run() {
        return RunAs.callUnchecked(alice, () -> materialiser.materialiseFor(alice, today));
    }

    private List<Transaction> generated() {
        return transactions.findAll().stream()
                .filter(t -> alice.equals(t.getUserId()) && t.getRecurringRuleId() != null)
                .sorted(Comparator.comparing(Transaction::getOccurredOn))
                .toList();
    }

    private List<LocalDate> occurrenceDates() {
        return generated().stream().map(Transaction::getOccurredOn).toList();
    }

    /**
     * Puts the cursor back where it was before a run, without touching the
     * transactions — the state a restored backup leaves behind, and the one the
     * idempotency guarantee is actually for.
     */
    private void rewindCursorTo(LocalDate nextRunOn) {
        jdbc.update("update recurring_rules set next_run_on = ? where user_id = ?", nextRunOn, alice);
    }

    private UUID seedUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into auth.users (id, email) values (?, ?)", id, id + "@test.local");
        return id;
    }

    private Account account(UUID userId, String currency) {
        Account account = new Account();
        account.setUserId(userId);
        account.setName("Everyday " + UUID.randomUUID());
        account.setType(AccountType.CHECKING);
        account.setCurrency(currency);
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
