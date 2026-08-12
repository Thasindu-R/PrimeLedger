package com.primeledger.account;

import com.primeledger.account.dto.AccountResponse;
import com.primeledger.security.CurrentUserProvider;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads for the accounts a user owns, and the one write Phase 4 needs.
 *
 * <p>Phase 5 owns accounts properly — creating them, renaming them, archiving
 * them, transfers between them, computed balances. What Phase 4 needs is
 * narrower and non-negotiable: {@code transactions.account_id} is NOT NULL, so
 * until a user has at least one account they cannot record anything at all. A
 * freshly signed-up user has none, because nothing in the API ever made one —
 * {@code DevDataSeeder} only runs under the dev profile.
 *
 * <p>Hence {@link #ensureDefault()}, and nothing more.
 */
@Service
public class AccountService {

    static final String DEFAULT_NAME = "Everyday";
    static final String DEFAULT_CURRENCY = "USD";
    private static final String DEFAULT_COLOUR = "#4F46E5";

    private final AccountRepository accounts;
    private final AccountMapper mapper;
    private final CurrentUserProvider currentUser;

    public AccountService(
            AccountRepository accounts, AccountMapper mapper, CurrentUserProvider currentUser) {
        this.accounts = accounts;
        this.mapper = mapper;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> list() {
        return accounts.findByUserIdOrderByNameAsc(currentUser.currentUserId()).stream()
                .map(mapper::toResponse)
                .toList();
    }

    /**
     * The caller's default account, created on first use.
     *
     * <p>Idempotent: the first account the user owns is returned if there is one,
     * so calling this on every page load converges rather than accumulating. It
     * is a POST rather than folded into {@code GET /accounts} because a GET that
     * writes is a GET that cannot be cached or retried safely, and this one
     * genuinely inserts.
     */
    @Transactional
    public AccountResponse ensureDefault() {
        UUID userId = currentUser.currentUserId();

        return accounts.findByUserIdOrderByNameAsc(userId).stream()
                .findFirst()
                .map(mapper::toResponse)
                .orElseGet(() -> mapper.toResponse(create(userId)));
    }

    private Account create(UUID userId) {
        Account account = new Account();
        account.setUserId(userId);
        account.setName(DEFAULT_NAME);
        account.setType(AccountType.CHECKING);
        account.setCurrency(DEFAULT_CURRENCY);
        account.setOpeningBalance(BigDecimal.ZERO);
        account.setColour(DEFAULT_COLOUR);

        try {
            return accounts.saveAndFlush(account);
        } catch (DataIntegrityViolationException race) {
            // Two tabs signing in at once both saw no accounts. One of them lost
            // the accounts_name_unique_per_user race; the row it wanted exists,
            // so return that rather than failing a request the user did not make.
            return accounts.findByUserIdOrderByNameAsc(userId).stream()
                    .findFirst()
                    .orElseThrow(() -> race);
        }
    }
}
