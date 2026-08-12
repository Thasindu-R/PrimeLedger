package com.primeledger.account;

import static org.assertj.core.api.Assertions.assertThat;

import com.primeledger.AbstractIntegrationTest;
import com.primeledger.account.dto.AccountResponse;
import com.primeledger.security.RunAs;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default-account provisioning — the one write Phase 4 added to a feature that
 * otherwise belongs to Phase 5.
 *
 * <p>The property that matters is idempotence. The frontend calls this on every
 * load, because it needs an account id before it can post anything; if it
 * created a row each time, a week of use would leave a user with a list of
 * identical accounts.
 */
@Transactional
class AccountServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired private AccountService service;
    @Autowired private AccountRepository accounts;
    @Autowired private JdbcTemplate jdbc;

    private UUID alice;
    private UUID bob;

    @BeforeEach
    void setUp() {
        alice = seedUser();
        bob = seedUser();
    }

    @Test
    @DisplayName("a user with no accounts gets one created")
    void provisionsOnFirstUse() {
        AccountResponse created = RunAs.callUnchecked(alice, service::ensureDefault);

        assertThat(created.name()).isEqualTo(AccountService.DEFAULT_NAME);
        assertThat(created.currency()).isEqualTo(AccountService.DEFAULT_CURRENCY);
        assertThat(created.type()).isEqualTo(AccountType.CHECKING);
        assertThat(created.archived()).isFalse();
        assertThat(accounts.findByUserIdOrderByNameAsc(alice)).hasSize(1);
    }

    @Test
    @DisplayName("calling it again returns the same account instead of making another")
    void isIdempotent() {
        AccountResponse first = RunAs.callUnchecked(alice, service::ensureDefault);
        AccountResponse second = RunAs.callUnchecked(alice, service::ensureDefault);
        AccountResponse third = RunAs.callUnchecked(alice, service::ensureDefault);

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(third.id()).isEqualTo(first.id());
        assertThat(accounts.findByUserIdOrderByNameAsc(alice)).hasSize(1);
    }

    @Test
    @DisplayName("an existing account is adopted rather than joined by a second one")
    void adoptsAnExistingAccount() {
        AccountResponse existing =
                RunAs.callUnchecked(
                        alice,
                        () -> {
                            Account account = new Account();
                            account.setUserId(alice);
                            account.setName("Savings");
                            account.setType(AccountType.SAVINGS);
                            account.setCurrency("EUR");
                            account.setOpeningBalance(java.math.BigDecimal.ZERO);
                            accounts.saveAndFlush(account);
                            return service.ensureDefault();
                        });

        assertThat(existing.name()).isEqualTo("Savings");
        assertThat(accounts.findByUserIdOrderByNameAsc(alice)).hasSize(1);
    }

    @Test
    @DisplayName("provisioning for one user does not give another user an account")
    void isolatesUsers() {
        RunAs.callUnchecked(alice, service::ensureDefault);

        assertThat(accounts.findByUserIdOrderByNameAsc(bob)).isEmpty();
        assertThat(RunAs.callUnchecked(bob, service::list)).isEmpty();
    }

    @Test
    @DisplayName("the list reports what the user owns and nothing else")
    void listsOwnAccountsOnly() {
        RunAs.callUnchecked(alice, service::ensureDefault);
        RunAs.callUnchecked(bob, service::ensureDefault);

        assertThat(RunAs.callUnchecked(alice, service::list)).hasSize(1);
        assertThat(RunAs.callUnchecked(bob, service::list)).hasSize(1);
        assertThat(RunAs.callUnchecked(alice, service::list).getFirst().id())
                .isNotEqualTo(RunAs.callUnchecked(bob, service::list).getFirst().id());
    }

    private UUID seedUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into auth.users (id, email) values (?, ?)", id, id + "@test.local");
        return id;
    }
}
