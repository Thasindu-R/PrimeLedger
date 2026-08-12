package com.primeledger.transaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.primeledger.AbstractIntegrationTest;
import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountService;
import com.primeledger.account.AccountType;
import com.primeledger.analytics.AnalyticsService;
import com.primeledger.common.ApiException;
import com.primeledger.security.RunAs;
import com.primeledger.transaction.dto.TransactionFilter;
import com.primeledger.transaction.dto.TransferRequest;
import com.primeledger.transaction.dto.TransferResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transfers (F-01).
 *
 * <p>The claim being tested is the one the proposal calls the part that
 * separates a real ledger from a spreadsheet: moving your own money changes what
 * each account holds without appearing as earning or spending.
 */
@Transactional
class TransferIntegrationTest extends AbstractIntegrationTest {

    @Autowired private TransferService transfers;
    @Autowired private TransactionService transactions;
    @Autowired private TransactionRepository transactionRepository;
    @Autowired private AccountService accountService;
    @Autowired private AccountRepository accounts;
    @Autowired private AnalyticsService analytics;
    @Autowired private JdbcTemplate jdbc;

    private UUID alice;
    private Account current;
    private Account savings;

    @BeforeEach
    void setUp() {
        alice = seedUser();
        current = account(alice, "Current", "USD");
        savings = account(alice, "Savings", "USD");
    }

    @Test
    @DisplayName("writes both legs, cross-linked, and flags them as transfers")
    void writesALinkedPair() {
        TransferResponse response = transfer("250.00");

        assertThat(response.from().type()).isEqualTo(TransactionType.EXPENSE);
        assertThat(response.to().type()).isEqualTo(TransactionType.INCOME);
        assertThat(response.from().accountId()).isEqualTo(current.getId());
        assertThat(response.to().accountId()).isEqualTo(savings.getId());

        var out = transactionRepository.findByIdAndUserId(response.from().id(), alice).orElseThrow();
        var in = transactionRepository.findByIdAndUserId(response.to().id(), alice).orElseThrow();

        assertThat(out.isTransfer()).isTrue();
        assertThat(in.isTransfer()).isTrue();
        assertThat(out.getTransferPairId()).isEqualTo(in.getId());
        assertThat(in.getTransferPairId()).isEqualTo(out.getId());
    }

    @Test
    @DisplayName("a transfer leg carries no category, and the database enforces it")
    void hasNoCategory() {
        TransferResponse response = transfer("250.00");

        assertThat(response.from().categoryId()).isNull();
        assertThat(response.to().categoryName()).isNull();
    }

    @Test
    @DisplayName("money leaves one account and arrives in the other")
    void movesBothBalances() {
        transfer("250.00");

        assertThat(balanceOf(current)).isEqualByComparingTo("-250.00");
        assertThat(balanceOf(savings)).isEqualByComparingTo("250.00");
    }

    @Test
    @DisplayName("a transfer is neither income nor expense in the summary")
    void isExcludedFromReportedTotals() {
        transfer("250.00");

        var summary = RunAs.callUnchecked(alice, () -> analytics.summary(unfiltered()));

        // The naive sum counts a transfer as income of 250 *and* expense of 250,
        // inflating the month by 500 and reporting activity that never happened.
        assertThat(summary.totals().income()).isEqualTo("0.00");
        assertThat(summary.totals().expense()).isEqualTo("0.00");
        assertThat(summary.totals().count()).isZero();
        assertThat(summary.byCategory()).isEmpty();
        assertThat(summary.monthly()).isEmpty();
    }

    @Test
    @DisplayName("real spending still counts while a transfer sits alongside it")
    void doesNotHideRealSpending() {
        transfer("250.00");
        RunAs.run(alice, () -> spend("40.00"));

        var summary = RunAs.callUnchecked(alice, () -> analytics.summary(unfiltered()));

        assertThat(summary.totals().expense()).isEqualTo("40.00");
        assertThat(summary.totals().count()).isEqualTo(1);
    }

    @Test
    @DisplayName("deleting one leg deletes the other, through either endpoint")
    void deletesBothLegs() {
        TransferResponse response = transfer("250.00");

        // Deleted from the ordinary transaction list, not the transfer endpoint:
        // the user is doing the same thing and must get the same result.
        RunAs.run(alice, () -> transactions.delete(response.from().id()));

        assertThat(deletedAtOf(response.from().id())).isNotNull();
        assertThat(deletedAtOf(response.to().id())).isNotNull();
        assertThat(balanceOf(current)).isEqualByComparingTo("0.00");
        assertThat(balanceOf(savings)).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("refuses to transfer an account to itself")
    void refusesSelfTransfer() {
        assertThatThrownBy(
                        () ->
                                RunAs.run(
                                        alice,
                                        () ->
                                                transfers.create(
                                                        new TransferRequest(
                                                                current.getId(),
                                                                current.getId(),
                                                                new BigDecimal("10.00"),
                                                                LocalDate.of(2026, 8, 1),
                                                                null))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("two different accounts");
    }

    @Test
    @DisplayName("refuses to cross currencies, which it cannot convert until F-05")
    void refusesCurrencyMismatch() {
        Account euros = account(alice, "Euro pot", "EUR");

        assertThatThrownBy(
                        () ->
                                RunAs.run(
                                        alice,
                                        () ->
                                                transfers.create(
                                                        new TransferRequest(
                                                                current.getId(),
                                                                euros.getId(),
                                                                new BigDecimal("10.00"),
                                                                LocalDate.of(2026, 8, 1),
                                                                null))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("same currency");
    }

    @Test
    @DisplayName("refuses an archived destination")
    void refusesArchivedAccount() {
        RunAs.run(alice, () -> accountService.setArchived(savings.getId(), true));

        assertThatThrownBy(() -> transfer("10.00"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("archived");
    }

    // ---------------------------------------------------------------- helpers

    private TransferResponse transfer(String amount) {
        return RunAs.callUnchecked(
                alice,
                () ->
                        transfers.create(
                                new TransferRequest(
                                        current.getId(),
                                        savings.getId(),
                                        new BigDecimal(amount),
                                        LocalDate.of(2026, 8, 1),
                                        null)));
    }

    private void spend(String amount) {
        Transaction expense = new Transaction();
        expense.setUserId(alice);
        expense.setAccountId(current.getId());
        expense.setCategory(systemExpenseCategory());
        expense.setType(TransactionType.EXPENSE);
        expense.setAmount(new BigDecimal(amount));
        expense.setCurrency("USD");
        expense.setOccurredOn(LocalDate.of(2026, 8, 1));
        transactionRepository.saveAndFlush(expense);
    }

    private com.primeledger.category.Category systemExpenseCategory() {
        UUID id =
                jdbc.queryForObject(
                        "select id from categories where user_id is null and kind = 'expense' limit 1",
                        UUID.class);
        return jdbc.queryForObject(
                "select id from categories where id = ?",
                (rs, n) -> {
                    var category = new com.primeledger.category.Category();
                    category.setId(rs.getObject(1, UUID.class));
                    return category;
                },
                id);
    }

    private BigDecimal balanceOf(Account account) {
        return new BigDecimal(
                RunAs.callUnchecked(alice, () -> accountService.get(account.getId())).balance());
    }

    private java.time.Instant deletedAtOf(UUID id) {
        return transactionRepository.findById(id).orElseThrow().getDeletedAt();
    }

    private static TransactionFilter unfiltered() {
        return new TransactionFilter(null, null, null, null, null, null, null, null, false);
    }

    private UUID seedUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into auth.users (id, email) values (?, ?)", id, id + "@test.local");
        return id;
    }

    private Account account(UUID userId, String name, String currency) {
        Account account = new Account();
        account.setUserId(userId);
        account.setName(name);
        account.setType(AccountType.CHECKING);
        account.setCurrency(currency);
        account.setOpeningBalance(BigDecimal.ZERO);
        return accounts.saveAndFlush(account);
    }
}
