package com.primeledger.transaction;

import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.common.ApiException;
import com.primeledger.security.CurrentUserProvider;
import com.primeledger.transaction.dto.TransferRequest;
import com.primeledger.transaction.dto.TransferResponse;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Moving money between two of the caller's own accounts (F-01).
 *
 * <p>A transfer is two ordinary transactions written together: an expense on
 * the source and an income on the destination, both flagged {@code isTransfer},
 * each carrying the other's id. Storing it as a pair rather than a third kind of
 * row is what makes account balances fall out of the same sum as everything else
 * — the money leaves one account and arrives in the other with no special case
 * in the balance query.
 *
 * <p>The write is atomic. Half a transfer is money that has left one account and
 * arrived nowhere, which is the one outcome a ledger must never produce, so
 * every path through this class either writes both legs or neither.
 */
@Service
public class TransferService {

    private final TransactionRepository transactions;
    private final AccountRepository accounts;
    private final TransactionMapper mapper;
    private final CurrentUserProvider currentUser;
    private final Clock clock;

    public TransferService(
            TransactionRepository transactions,
            AccountRepository accounts,
            TransactionMapper mapper,
            CurrentUserProvider currentUser,
            Clock clock) {
        this.transactions = transactions;
        this.accounts = accounts;
        this.mapper = mapper;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @Transactional
    public TransferResponse create(TransferRequest request) {
        UUID userId = currentUser.currentUserId();

        if (request.fromAccountId().equals(request.toAccountId())) {
            throw ApiException.businessRule("A transfer needs two different accounts");
        }

        Account from = usableAccount(request.fromAccountId(), userId);
        Account to = usableAccount(request.toAccountId(), userId);

        // Converting between currencies is F-05. Until the rates and the
        // conversion date exist, a cross-currency transfer could only guess at
        // the amount arriving, and a guess in a ledger is a defect.
        if (!from.getCurrency().equals(to.getCurrency())) {
            throw ApiException.businessRule(
                    "Both accounts must use the same currency: %s holds %s and %s holds %s"
                            .formatted(
                                    from.getName(),
                                    from.getCurrency(),
                                    to.getName(),
                                    to.getCurrency()));
        }

        requireSaneDate(request.occurredOn());

        String description =
                request.description() == null || request.description().isBlank()
                        ? "Transfer from %s to %s".formatted(from.getName(), to.getName())
                        : request.description().trim();

        Transaction out = leg(userId, from, TransactionType.EXPENSE, request, description);
        Transaction in = leg(userId, to, TransactionType.INCOME, request, description);

        // Both rows first: transfer_pair_id is a foreign key to transactions, so
        // neither id exists until its row does.
        transactions.saveAndFlush(out);
        transactions.saveAndFlush(in);

        out.setTransferPairId(in.getId());
        in.setTransferPairId(out.getId());
        transactions.saveAndFlush(out);
        transactions.saveAndFlush(in);

        return new TransferResponse(mapper.toResponse(out), mapper.toResponse(in));
    }

    /**
     * Deletes both legs of a transfer, given either one.
     *
     * <p>Soft, like every other delete, and symmetrical: removing one side alone
     * would leave the ledger claiming money left an account and never arrived.
     */
    @Transactional
    public void delete(UUID legId) {
        UUID userId = currentUser.currentUserId();

        Transaction leg =
                transactions
                        .findByIdAndUserId(legId, userId)
                        .orElseThrow(() -> ApiException.notFound("Transfer", legId));

        if (!leg.isTransfer()) {
            throw ApiException.businessRule(
                    "That transaction is not a transfer; delete it through /transactions");
        }
        if (leg.isDeleted()) {
            return; // Deleting twice is the same outcome as deleting once.
        }

        deletePair(leg, userId);
    }

    /**
     * Soft-deletes a transfer leg and its partner.
     *
     * <p>Package-private because {@code TransactionService} needs it too: a user
     * deleting a transfer from the ordinary transaction list is doing the same
     * thing and must get the same result.
     */
    void deletePair(Transaction leg, UUID userId) {
        var now = clock.instant();

        leg.setDeletedAt(now);
        transactions.save(leg);

        if (leg.getTransferPairId() == null) {
            return;
        }

        transactions
                .findByIdAndUserId(leg.getTransferPairId(), userId)
                .filter(partner -> !partner.isDeleted())
                .ifPresent(
                        partner -> {
                            partner.setDeletedAt(now);
                            transactions.save(partner);
                        });
    }

    private Transaction leg(
            UUID userId,
            Account account,
            TransactionType type,
            TransferRequest request,
            String description) {

        Transaction transaction = new Transaction();
        transaction.setUserId(userId);
        transaction.setAccountId(account.getId());
        // No category, deliberately — see V5.
        transaction.setCategory(null);
        transaction.setType(type);
        transaction.setAmount(request.amount());
        transaction.setCurrency(account.getCurrency());
        transaction.setOccurredOn(request.occurredOn());
        transaction.setDescription(description);
        transaction.setTransfer(true);
        return transaction;
    }

    private Account usableAccount(UUID id, UUID userId) {
        Account account =
                accounts.findByIdAndUserId(id, userId)
                        .orElseThrow(() -> ApiException.notFound("Account", id));

        if (account.isArchived()) {
            throw ApiException.businessRule(
                    "'%s' is archived and cannot take new transactions"
                            .formatted(account.getName()));
        }
        return account;
    }

    /** The same rule the transaction endpoint applies (the server half of D-09). */
    private void requireSaneDate(LocalDate occurredOn) {
        if (occurredOn.isAfter(LocalDate.now(clock).plusDays(1))) {
            throw ApiException.businessRule("occurredOn must not be in the future");
        }
    }
}
