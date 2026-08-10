package com.primeledger.transaction;

import com.primeledger.account.AccountRepository;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
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

    private final TransactionRepository transactions;
    private final AccountRepository accounts;
    private final CategoryService categories;
    private final TransactionMapper mapper;
    private final CurrentUserProvider currentUser;
    private final Clock clock;

    public TransactionService(
            TransactionRepository transactions,
            AccountRepository accounts,
            CategoryService categories,
            TransactionMapper mapper,
            CurrentUserProvider currentUser,
            Clock clock) {
        this.transactions = transactions;
        this.accounts = accounts;
        this.categories = categories;
        this.mapper = mapper;
        this.currentUser = currentUser;
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
        return mapper.toResponse(transactions.saveAndFlush(transaction));
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
        return mapper.toResponse(transactions.saveAndFlush(transaction));
    }

    /** Soft delete (proposal §8.1). The row stays; every read stops seeing it. */
    @Transactional
    public void delete(UUID id) {
        Transaction transaction = ownedOrThrow(id);
        if (transaction.isDeleted()) {
            return; // Deleting twice is the same outcome as deleting once.
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
     * Ownership is part of the query, so a transaction belonging to another user
     * is reported as absent rather than forbidden (proposal §8.2).
     */
    private Transaction ownedOrThrow(UUID id) {
        return transactions
                .findByIdAndUserId(id, currentUser.currentUserId())
                .orElseThrow(() -> ApiException.notFound("Transaction", id));
    }

    private void apply(TransactionRequest request, Transaction transaction, UUID userId) {
        if (!accounts.existsByIdAndUserId(request.accountId(), userId)) {
            throw ApiException.notFound("Account", request.accountId());
        }

        Category category = categories.requireUsable(request.categoryId(), userId);
        requireMatchingKind(request, category);
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
     * An expense filed under an income category is the drift D-01 was about,
     * one level up. The database cannot express this rule, so the service does.
     */
    private static void requireMatchingKind(TransactionRequest request, Category category) {
        CategoryKind expected =
                request.type() == TransactionType.INCOME
                        ? CategoryKind.INCOME
                        : CategoryKind.EXPENSE;
        if (category.getKind() != expected) {
            throw ApiException.businessRule(
                    "Category '%s' is a %s category and cannot be used for a %s transaction"
                            .formatted(
                                    category.getName(),
                                    category.getKind().name().toLowerCase(),
                                    request.type().name().toLowerCase()));
        }
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
