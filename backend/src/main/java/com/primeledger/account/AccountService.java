package com.primeledger.account;

import com.primeledger.account.dto.AccountRequest;
import com.primeledger.account.dto.AccountResponse;
import com.primeledger.common.ApiException;
import com.primeledger.security.CurrentUserProvider;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Accounts and their balances (F-01).
 *
 * <p>Phase 4 added only what it could not do without — reading accounts and
 * provisioning a default one. Phase 5 makes them a real feature: several
 * accounts, each with its own balance, which is what turns the app from one
 * undifferentiated pool into a ledger.
 */
@Service
public class AccountService {

    static final String DEFAULT_NAME = "Everyday";
    static final String DEFAULT_CURRENCY = "USD";
    private static final String DEFAULT_COLOUR = "#4F46E5";

    private final AccountRepository accounts;
    private final CurrentUserProvider currentUser;

    public AccountService(AccountRepository accounts, CurrentUserProvider currentUser) {
        this.accounts = accounts;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> list(boolean includeArchived) {
        UUID userId = currentUser.currentUserId();

        List<Account> rows =
                includeArchived
                        ? accounts.findByUserIdOrderByNameAsc(userId)
                        : accounts.findByUserIdAndArchivedFalseOrderByNameAsc(userId);

        // One aggregate query for every account, rather than one per account.
        Map<UUID, AccountRepository.AccountMovement> movements = movementsByAccount(userId);

        return rows.stream().map(account -> toResponse(account, movements)).toList();
    }

    @Transactional(readOnly = true)
    public AccountResponse get(UUID id) {
        Account account = ownedOrThrow(id);
        return toResponse(account, movementsByAccount(account.getUserId()));
    }

    @Transactional
    public AccountResponse create(AccountRequest request) {
        UUID userId = currentUser.currentUserId();

        if (accounts.existsByUserIdAndNameIgnoreCase(userId, request.name().trim())) {
            throw ApiException.conflict(
                    "An account called '%s' already exists".formatted(request.name().trim()));
        }

        Account account = new Account();
        account.setUserId(userId);
        apply(request, account);

        return toResponse(saveHandlingRace(account), movementsByAccount(userId));
    }

    @Transactional
    public AccountResponse update(UUID id, AccountRequest request) {
        Account account = ownedOrThrow(id);
        UUID userId = account.getUserId();

        if (accounts.existsByUserIdAndNameIgnoreCaseAndIdNot(userId, request.name().trim(), id)) {
            throw ApiException.conflict(
                    "An account called '%s' already exists".formatted(request.name().trim()));
        }

        // Changing the currency of an account that already holds transactions
        // would silently reinterpret every amount in it — 1,000 rupees becoming
        // 1,000 dollars. Multi-currency conversion is F-05; until then the only
        // safe answer is no.
        if (!account.getCurrency().equals(request.currency()) && hasTransactions(id, userId)) {
            throw ApiException.businessRule(
                    "This account already holds transactions, so its currency cannot be changed. "
                            + "Create a new account in %s instead."
                                    .formatted(request.currency()));
        }

        apply(request, account);
        return toResponse(accounts.saveAndFlush(account), movementsByAccount(userId));
    }

    /**
     * Archives an account: it stops appearing in pickers, and its history stays.
     *
     * <p>This is the operation a user actually wants when they close a bank
     * account. Deleting would either destroy the transactions filed under it or
     * be refused by the {@code ON DELETE RESTRICT} on {@code account_id} — and
     * losing a year of history to close one card is not a reasonable trade.
     */
    @Transactional
    public AccountResponse setArchived(UUID id, boolean archived) {
        Account account = ownedOrThrow(id);

        if (archived && lastActiveAccount(account)) {
            // With no active account left, nothing can be recorded at all: the
            // add form has nothing to file a transaction under.
            throw ApiException.businessRule(
                    "This is your only active account. Add another before archiving this one.");
        }

        account.setArchived(archived);
        return toResponse(accounts.saveAndFlush(account), movementsByAccount(account.getUserId()));
    }

    /** Hard delete, permitted only while the account is still empty. */
    @Transactional
    public void delete(UUID id) {
        Account account = ownedOrThrow(id);
        UUID userId = account.getUserId();

        if (hasTransactions(id, userId)) {
            throw ApiException.businessRule(
                    "This account holds transactions and cannot be deleted. Archive it instead "
                            + "to keep its history.");
        }
        if (lastActiveAccount(account)) {
            throw ApiException.businessRule(
                    "This is your only active account. Add another before deleting this one.");
        }

        accounts.delete(account);
    }

    /**
     * The caller's default account, created on first use.
     *
     * <p>Idempotent: the first *active* account the user owns is returned if
     * there is one, so calling this on every page load converges rather than
     * accumulating. Archived accounts are skipped deliberately — handing back an
     * account the user has closed would file new transactions into it.
     */
    @Transactional
    public AccountResponse ensureDefault() {
        UUID userId = currentUser.currentUserId();

        return accounts.findByUserIdAndArchivedFalseOrderByNameAsc(userId).stream()
                .findFirst()
                .map(account -> toResponse(account, movementsByAccount(userId)))
                .orElseGet(() -> toResponse(createDefault(userId), Map.of()));
    }

    /** True when the account exists, belongs to the caller, and is usable for writes. */
    @Transactional(readOnly = true)
    public boolean isWritable(UUID accountId, UUID userId) {
        return accounts.findByIdAndUserId(accountId, userId)
                .filter(account -> !account.isArchived())
                .isPresent();
    }

    // ---------------------------------------------------------------- internals

    private Account createDefault(UUID userId) {
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
            return accounts.findByUserIdAndArchivedFalseOrderByNameAsc(userId).stream()
                    .findFirst()
                    .orElseThrow(() -> race);
        }
    }

    private Account saveHandlingRace(Account account) {
        try {
            return accounts.saveAndFlush(account);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict(
                    "An account called '%s' already exists".formatted(account.getName()));
        }
    }

    private static void apply(AccountRequest request, Account account) {
        account.setName(request.name().trim());
        account.setType(request.type());
        account.setCurrency(request.currency());
        account.setOpeningBalance(request.openingBalance());
        account.setColour(request.colour());
    }

    private Account ownedOrThrow(UUID id) {
        return accounts.findByIdAndUserId(id, currentUser.currentUserId())
                .orElseThrow(() -> ApiException.notFound("Account", id));
    }

    private boolean hasTransactions(UUID accountId, UUID userId) {
        AccountRepository.AccountMovement movement = movementsByAccount(userId).get(accountId);
        return movement != null && movement.getTxnCount() > 0;
    }

    private boolean lastActiveAccount(Account account) {
        return accounts.findByUserIdAndArchivedFalseOrderByNameAsc(account.getUserId()).stream()
                .filter(other -> !other.getId().equals(account.getId()))
                .findAny()
                .isEmpty();
    }

    private Map<UUID, AccountRepository.AccountMovement> movementsByAccount(UUID userId) {
        Map<UUID, AccountRepository.AccountMovement> byAccount = new HashMap<>();
        for (AccountRepository.AccountMovement movement : accounts.movementsFor(userId)) {
            byAccount.put(movement.getAccountId(), movement);
        }
        return byAccount;
    }

    private static AccountResponse toResponse(
            Account account, Map<UUID, AccountRepository.AccountMovement> movements) {

        AccountRepository.AccountMovement movement = movements.get(account.getId());
        BigDecimal moved = movement == null ? BigDecimal.ZERO : movement.getMovement();
        long count = movement == null ? 0 : movement.getTxnCount();

        return new AccountResponse(
                account.getId(),
                account.getName(),
                account.getType(),
                account.getCurrency(),
                money(account.getOpeningBalance()),
                money(account.getOpeningBalance().add(moved)),
                account.getColour(),
                account.isArchived(),
                count,
                account.getCreatedAt(),
                account.getUpdatedAt());
    }

    /** Two decimal places, always, so the client never has to guess the scale. */
    private static String money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
