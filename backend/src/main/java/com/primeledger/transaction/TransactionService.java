package com.primeledger.transaction;

import com.primeledger.account.AccountRepository;
import com.primeledger.budget.BudgetEvaluator;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryService;
import com.primeledger.common.ApiException;
import com.primeledger.common.PageResponse;
import com.primeledger.security.CurrentUserProvider;
import com.primeledger.transaction.dto.BulkDeleteRequest;
import com.primeledger.transaction.dto.BulkDeleteResponse;
import com.primeledger.transaction.dto.TransactionFilter;
import com.primeledger.transaction.dto.TransactionRequest;
import com.primeledger.transaction.dto.TransactionResponse;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransactionService {

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(TransactionService.class);

    private final TransactionRepository transactions;
    private final AccountRepository accounts;
    private final CategoryService categories;
    private final TransactionMapper mapper;
    private final CurrentUserProvider currentUser;
    private final TransferService transfers;
    private final BudgetEvaluator budgets;
    private final Clock clock;

    public TransactionService(
            TransactionRepository transactions,
            AccountRepository accounts,
            CategoryService categories,
            TransactionMapper mapper,
            CurrentUserProvider currentUser,
            TransferService transfers,
            BudgetEvaluator budgets,
            Clock clock) {
        this.transactions = transactions;
        this.accounts = accounts;
        this.categories = categories;
        this.mapper = mapper;
        this.currentUser = currentUser;
        this.transfers = transfers;
        this.budgets = budgets;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<TransactionResponse> list(TransactionFilter filter, Pageable pageable) {
        if (filter.isImpossibleRange()) {
            throw ApiException.businessRule("The requested range is empty: from is after to");
        }
        Page<Transaction> page =
                transactions.findAll(
                        TransactionSpecifications.matching(currentUser.currentUserId(), filter),
                        pageable);
        return PageResponse.from(page, mapper::toResponse);
    }

    @Transactional(readOnly = true)
    public TransactionResponse get(UUID id) {
        return mapper.toResponse(ownedOrThrow(id));
    }

    @Transactional
    public TransactionResponse create(TransactionRequest request) {
        UUID userId = currentUser.currentUserId();

        Transaction transaction = new Transaction();
        transaction.setUserId(userId);
        apply(request, transaction, userId);
        TransactionResponse created = mapper.toResponse(transactions.saveAndFlush(transaction));

        evaluateBudgets(userId);
        return created;
    }

    @Transactional
    public TransactionResponse update(UUID id, TransactionRequest request) {
        Transaction transaction = ownedOrThrow(id);
        if (transaction.isDeleted()) {
            throw ApiException.businessRule("Restore the transaction before editing it");
        }
        if (transaction.isTransfer()) {
            // Editing one leg would silently unbalance the pair; transfers get
            // their own endpoint in Phase 5.
            throw ApiException.businessRule("Transfers cannot be edited through this endpoint");
        }
        apply(request, transaction, transaction.getUserId());
        TransactionResponse updated = mapper.toResponse(transactions.saveAndFlush(transaction));

        evaluateBudgets(transaction.getUserId());
        return updated;
    }

    /** Soft delete (proposal §8.1). The row stays; every read stops seeing it. */
    @Transactional
    public void delete(UUID id) {
        Transaction transaction = ownedOrThrow(id);
        if (transaction.isDeleted()) {
            return; // Deleting twice is the same outcome as deleting once.
        }

        if (transaction.isTransfer()) {
            // Deleting one leg of a transfer from the ordinary transaction list
            // is the same act as deleting the transfer, and must have the same
            // result: money that left an account and arrived nowhere is the one
            // state a ledger must never be able to reach.
            transfers.deletePair(transaction, transaction.getUserId());
            return;
        }

        transaction.setDeletedAt(clock.instant());
        transactions.save(transaction);
    }

    @Transactional
    public TransactionResponse restore(UUID id) {
        Transaction transaction = ownedOrThrow(id);
        if (!transaction.isDeleted()) {
            throw ApiException.businessRule("Transaction is not deleted");
        }
        transaction.setDeletedAt(null);
        return mapper.toResponse(transactions.saveAndFlush(transaction));
    }

    @Transactional
    public BulkDeleteResponse bulkDelete(BulkDeleteRequest request) {
        var ids = request.ids().stream().distinct().toList();
        int deleted =
                transactions.softDeleteAll(currentUser.currentUserId(), ids, clock.instant());
        return new BulkDeleteResponse(ids.size(), deleted);
    }

    /**
     * Re-checks the caller's budgets after a write that could have moved one
     * (F-02: "runs after each write").
     *
     * <p>Failures are logged and swallowed. A budget alert is a courtesy; the
     * transaction the user asked to save is not, and letting a notification
     * problem roll back their write would be the wrong trade by a wide margin.
     */
    private void evaluateBudgets(UUID userId) {
        try {
            budgets.evaluate(userId);
        } catch (RuntimeException e) {
            log.warn("Budget evaluation failed for user {} after a write", userId, e);
        }
    }

    /**
     * Ownership is part of the query, so a transaction belonging to another user
     * is reported as absent rather than forbidden (proposal §8.2).
     */
    private Transaction ownedOrThrow(UUID id) {
        return transactions
                .findByIdAndUserId(id, currentUser.currentUserId())
                .orElseThrow(() -> ApiException.notFound("Transaction", id));
    }

    private void apply(TransactionRequest request, Transaction transaction, UUID userId) {
        var account =
                accounts.findByIdAndUserId(request.accountId(), userId)
                        .orElseThrow(() -> ApiException.notFound("Account", request.accountId()));

        // Archiving an account means "I have closed this"; still accepting new
        // transactions into it would make the archive purely cosmetic.
        if (account.isArchived()) {
            throw ApiException.businessRule(
                    "'%s' is archived and cannot take new transactions"
                            .formatted(account.getName()));
        }

        Category category = categories.requireUsable(request.categoryId(), userId);
        CategoryKindRule.requireMatches(category, request.type(), "transaction");
        requireSaneDate(request.occurredOn());

        transaction.setAccountId(request.accountId());
        transaction.setCategory(category);
        transaction.setType(request.type());
        transaction.setAmount(request.amount());
        transaction.setCurrency(request.currency());
        transaction.setOccurredOn(request.occurredOn());
        transaction.setDescription(
                request.description() == null || request.description().isBlank()
                        ? null
                        : request.description().trim());
    }

    /**
     * The server-side half of D-09. Tomorrow is allowed — the check constraint
     * in V1 says {@code CURRENT_DATE + 1} — so a client in a timezone ahead of
     * the server is not rejected for dating something "today".
     */
    private void requireSaneDate(LocalDate occurredOn) {
        LocalDate latest = LocalDate.now(clock).plusDays(1);
        if (occurredOn.isAfter(latest)) {
            throw ApiException.businessRule("occurredOn must not be in the future");
        }
    }
}
