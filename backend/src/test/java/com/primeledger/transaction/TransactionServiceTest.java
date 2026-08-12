package com.primeledger.transaction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.primeledger.account.AccountRepository;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryService;
import com.primeledger.common.ApiException;
import com.primeledger.common.ErrorCode;
import com.primeledger.security.CurrentUserProvider;
import com.primeledger.transaction.dto.BulkDeleteRequest;
import com.primeledger.transaction.dto.TransactionFilter;
import com.primeledger.transaction.dto.TransactionRequest;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageRequest;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TransactionServiceTest {

    private static final UUID USER = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private static final UUID ACCOUNT = UUID.randomUUID();
    private static final UUID CATEGORY = UUID.randomUUID();

    /** Fixed, so the future-date rule has a definite "today" to be tested against. */
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-08-09T12:00:00Z"), ZoneOffset.UTC);

    @Mock private TransactionRepository transactions;
    @Mock private AccountRepository accounts;
    @Mock private CategoryService categories;
    @Mock private TransferService transfers;
    @Mock private com.primeledger.budget.BudgetEvaluator budgets;

    private TransactionService service;

    @BeforeEach
    void setUp() {
        CurrentUserProvider currentUser = () -> java.util.Optional.of(USER);
        service =
                new TransactionService(
                        transactions,
                        accounts,
                        categories,
                        new TransactionMapperImpl(),
                        currentUser,
                        transfers,
                        budgets,
                        CLOCK);

        when(accounts.findByIdAndUserId(ACCOUNT, USER)).thenReturn(Optional.of(openAccount()));
        when(categories.requireUsable(eq(CATEGORY), eq(USER)))
                .thenReturn(category(CategoryKind.EXPENSE, "Groceries"));
        when(transactions.saveAndFlush(any(Transaction.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @Nested
    @DisplayName("create")
    class Create {

        @Test
        @DisplayName("stamps the transaction with the current user, never a client-supplied one")
        void stampsCurrentUser() {
            service.create(request(LocalDate.of(2026, 8, 1), new BigDecimal("42.50")));

            assertThat(saved().getUserId()).isEqualTo(USER);
        }

        @Test
        @DisplayName("keeps the amount as an exact decimal")
        void keepsExactDecimal() {
            service.create(request(LocalDate.of(2026, 8, 1), new BigDecimal("0.10")));

            assertThat(saved().getAmount()).isEqualByComparingTo("0.10");
        }

        @Test
        @DisplayName("returns the amount as a string, not a number (§7.3)")
        void returnsAmountAsString() {
            var response =
                    service.create(request(LocalDate.of(2026, 8, 1), new BigDecimal("42.50")));

            assertThat(response.amount()).isEqualTo("42.50");
        }

        @Test
        @DisplayName("reports an account belonging to somebody else as absent")
        void rejectsForeignAccount() {
            when(accounts.findByIdAndUserId(ACCOUNT, USER)).thenReturn(Optional.empty());

            assertFails(
                    () -> service.create(request(LocalDate.of(2026, 8, 1), BigDecimal.ONE)),
                    ErrorCode.NOT_FOUND);
        }

        @Test
        @DisplayName("refuses to file a transaction into an archived account")
        void rejectsArchivedAccount() {
            var archived = openAccount();
            archived.setArchived(true);
            when(accounts.findByIdAndUserId(ACCOUNT, USER)).thenReturn(Optional.of(archived));

            // Archiving means "I have closed this account". Still accepting new
            // transactions into it would make the archive purely decorative.
            assertFails(
                    () -> service.create(request(LocalDate.of(2026, 8, 1), BigDecimal.ONE)),
                    ErrorCode.BUSINESS_RULE);
        }

        @Test
        @DisplayName("re-checks budgets after a write, so an alert follows the spending")
        void evaluatesBudgetsAfterWriting() {
            service.create(request(LocalDate.of(2026, 8, 1), BigDecimal.ONE));

            verify(budgets).evaluate(USER);
        }

        @Test
        @DisplayName("a failing budget evaluation does not lose the transaction")
        void survivesBudgetEvaluationFailure() {
            // The alert is a courtesy; the row the user asked to save is not.
            org.mockito.Mockito.doThrow(new IllegalStateException("evaluator down"))
                    .when(budgets)
                    .evaluate(USER);

            var response = service.create(request(LocalDate.of(2026, 8, 1), BigDecimal.ONE));

            assertThat(response).isNotNull();
            verify(transactions).saveAndFlush(any(Transaction.class));
        }

        @Test
        @DisplayName("refuses an expense filed under an income category")
        void rejectsKindMismatch() {
            when(categories.requireUsable(CATEGORY, USER))
                    .thenReturn(category(CategoryKind.INCOME, "Salary"));

            assertFails(
                    () -> service.create(request(LocalDate.of(2026, 8, 1), BigDecimal.ONE)),
                    ErrorCode.BUSINESS_RULE);
        }

        @Test
        @DisplayName("reads as English — the message is shown to the user")
        void mismatchMessageIsGrammatical() {
            when(categories.requireUsable(CATEGORY, USER))
                    .thenReturn(category(CategoryKind.INCOME, "Salary"));

            assertThatThrownBy(
                            () -> service.create(request(LocalDate.of(2026, 8, 1), BigDecimal.ONE)))
                    .hasMessageContaining("is an income category")
                    .hasMessageContaining("for an expense transaction");
        }

        @Test
        @DisplayName("refuses a date past tomorrow — the server half of D-09")
        void rejectsFutureDate() {
            assertFails(
                    () -> service.create(request(LocalDate.of(3000, 1, 1), BigDecimal.ONE)),
                    ErrorCode.BUSINESS_RULE);
        }

        @Test
        @DisplayName("allows tomorrow, so a client ahead of the server is not rejected")
        void allowsTomorrow() {
            service.create(request(LocalDate.of(2026, 8, 10), BigDecimal.ONE));

            assertThat(saved().getOccurredOn()).isEqualTo(LocalDate.of(2026, 8, 10));
        }

        @Test
        @DisplayName("normalises a blank description to null rather than storing whitespace")
        void normalisesBlankDescription() {
            service.create(
                    new TransactionRequest(
                            ACCOUNT,
                            CATEGORY,
                            TransactionType.EXPENSE,
                            BigDecimal.ONE,
                            "USD",
                            LocalDate.of(2026, 8, 1),
                            "   "));

            assertThat(saved().getDescription()).isNull();
        }
    }

    @Nested
    @DisplayName("delete and restore")
    class DeleteAndRestore {

        @Test
        @DisplayName("soft deletes rather than removing the row")
        void softDeletes() {
            Transaction existing = existing();
            when(transactions.findByIdAndUserId(existing.getId(), USER))
                    .thenReturn(Optional.of(existing));

            service.delete(existing.getId());

            assertThat(existing.getDeletedAt()).isEqualTo(CLOCK.instant());
            verify(transactions, never()).delete(any(Transaction.class));
        }

        @Test
        @DisplayName("deleting twice is not an error — the outcome is the same")
        void deleteIsIdempotent() {
            Instant alreadyDeleted = Instant.parse("2026-08-01T00:00:00Z");
            Transaction existing = existing();
            existing.setDeletedAt(alreadyDeleted);
            when(transactions.findByIdAndUserId(existing.getId(), USER))
                    .thenReturn(Optional.of(existing));

            service.delete(existing.getId());

            assertThat(existing.getDeletedAt()).isEqualTo(alreadyDeleted);
        }

        @Test
        @DisplayName("reports another user's transaction as absent, not forbidden")
        void foreignTransactionIsNotFound() {
            UUID id = UUID.randomUUID();
            when(transactions.findByIdAndUserId(id, USER)).thenReturn(Optional.empty());

            assertFails(() -> service.get(id), ErrorCode.NOT_FOUND);
        }

        @Test
        @DisplayName("restore clears the deletion")
        void restores() {
            Transaction existing = existing();
            existing.setDeletedAt(CLOCK.instant());
            when(transactions.findByIdAndUserId(existing.getId(), USER))
                    .thenReturn(Optional.of(existing));

            service.restore(existing.getId());

            assertThat(existing.getDeletedAt()).isNull();
        }

        @Test
        @DisplayName("restoring a live transaction is a business-rule error")
        void restoringLiveTransactionFails() {
            Transaction existing = existing();
            when(transactions.findByIdAndUserId(existing.getId(), USER))
                    .thenReturn(Optional.of(existing));

            assertFails(() -> service.restore(existing.getId()), ErrorCode.BUSINESS_RULE);
        }

        @Test
        @DisplayName("editing a soft-deleted transaction is refused")
        void editingDeletedFails() {
            Transaction existing = existing();
            existing.setDeletedAt(CLOCK.instant());
            when(transactions.findByIdAndUserId(existing.getId(), USER))
                    .thenReturn(Optional.of(existing));

            assertFails(
                    () ->
                            service.update(
                                    existing.getId(),
                                    request(LocalDate.of(2026, 8, 1), BigDecimal.ONE)),
                    ErrorCode.BUSINESS_RULE);
        }

        @Test
        @DisplayName("de-duplicates ids and reports how many rows actually went")
        void bulkDeleteReportsRealCount() {
            UUID id = UUID.randomUUID();
            when(transactions.softDeleteAll(eq(USER), anyList(), any())).thenReturn(1);

            var result = service.bulkDelete(new BulkDeleteRequest(List.of(id, id)));

            assertThat(result.requested()).isEqualTo(1);
            assertThat(result.deleted()).isEqualTo(1);
        }
    }

    @Test
    @DisplayName("refuses a range that can never match instead of querying for it")
    void rejectsImpossibleRange() {
        var filter =
                new TransactionFilter(
                        LocalDate.of(2026, 12, 31),
                        LocalDate.of(2026, 1, 1),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        false);

        assertFails(() -> service.list(filter, PageRequest.of(0, 20)), ErrorCode.BUSINESS_RULE);
    }

    // ---------------------------------------------------------------- helpers

    private Transaction saved() {
        var captor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactions).saveAndFlush(captor.capture());
        return captor.getValue();
    }

    private static void assertFails(ThrowingCallable callable, ErrorCode expected) {
        assertThatThrownBy(callable)
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo(expected));
    }

    private static TransactionRequest request(LocalDate occurredOn, BigDecimal amount) {
        return new TransactionRequest(
                ACCOUNT,
                CATEGORY,
                TransactionType.EXPENSE,
                amount,
                "USD",
                occurredOn,
                "Weekly shop");
    }

    /** An account that is open for business — the ordinary case. */
    private static com.primeledger.account.Account openAccount() {
        com.primeledger.account.Account account = new com.primeledger.account.Account();
        account.setId(ACCOUNT);
        account.setUserId(USER);
        account.setName("Everyday");
        account.setType(com.primeledger.account.AccountType.CHECKING);
        account.setCurrency("USD");
        account.setOpeningBalance(BigDecimal.ZERO);
        return account;
    }

    private static Category category(CategoryKind kind, String name) {
        Category category = new Category();
        category.setId(CATEGORY);
        category.setUserId(USER);
        category.setName(name);
        category.setKind(kind);
        return category;
    }

    private static Transaction existing() {
        Transaction transaction = new Transaction();
        transaction.setId(UUID.randomUUID());
        transaction.setUserId(USER);
        transaction.setAccountId(ACCOUNT);
        transaction.setCategory(category(CategoryKind.EXPENSE, "Groceries"));
        transaction.setType(TransactionType.EXPENSE);
        transaction.setAmount(new BigDecimal("10.00"));
        transaction.setCurrency("USD");
        transaction.setOccurredOn(LocalDate.of(2026, 8, 1));
        return transaction;
    }
}
