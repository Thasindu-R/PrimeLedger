package com.primeledger.category;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.primeledger.category.dto.CategoryRequest;
import com.primeledger.common.ApiException;
import com.primeledger.common.ErrorCode;
import com.primeledger.security.CurrentUserProvider;
import com.primeledger.transaction.TransactionRepository;
import java.util.Optional;
import java.util.UUID;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CategoryServiceTest {

    private static final UUID USER = UUID.fromString("00000000-0000-4000-8000-000000000001");

    @Mock private CategoryRepository categories;
    @Mock private TransactionRepository transactions;

    private CategoryService service;

    @BeforeEach
    void setUp() {
        CurrentUserProvider currentUser = () -> java.util.Optional.of(USER);
        service =
                new CategoryService(
                        categories, transactions, new CategoryMapperImpl(), currentUser);
        when(categories.saveAndFlush(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("creating a duplicate name within a kind is a conflict")
    void rejectsDuplicateName() {
        when(categories.existsByUserIdAndKindAndNameIgnoreCase(USER, CategoryKind.EXPENSE, "Rent"))
                .thenReturn(true);

        assertFails(
                () -> service.create(new CategoryRequest("Rent", CategoryKind.EXPENSE, null, null, 0)),
                ErrorCode.CONFLICT);
    }

    @Test
    @DisplayName("the same name is allowed under the other kind")
    void allowsSameNameAcrossKinds() {
        when(categories.existsByUserIdAndKindAndNameIgnoreCase(USER, CategoryKind.INCOME, "Bonus"))
                .thenReturn(false);

        var created = service.create(new CategoryRequest("Bonus", CategoryKind.INCOME, null, null, 0));

        assertThat(created.name()).isEqualTo("Bonus");
        assertThat(created.system()).isFalse();
    }

    @Test
    @DisplayName("a system category is refused as read-only, not hidden behind a 404")
    void refusesToEditSystemCategory() {
        UUID id = UUID.randomUUID();
        Category system = category(id, "Groceries", CategoryKind.EXPENSE);
        system.setUserId(null);
        system.setSystem(true);
        when(categories.findVisibleById(id, USER)).thenReturn(Optional.of(system));

        assertFails(
                () ->
                        service.update(
                                id, new CategoryRequest("Food", CategoryKind.EXPENSE, null, null, 0)),
                ErrorCode.BUSINESS_RULE);
    }

    @Test
    @DisplayName("deleting a category still in use, with no replacement, is refused")
    void refusesDeleteWhileInUse() {
        UUID id = UUID.randomUUID();
        when(categories.findVisibleById(id, USER))
                .thenReturn(Optional.of(category(id, "Rent", CategoryKind.EXPENSE)));
        when(transactions.countByUserIdAndCategoryId(USER, id)).thenReturn(3L);

        assertThatThrownBy(() -> service.delete(id, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("3 transaction(s)");
        verify(categories, never()).delete(any());
    }

    @Test
    @DisplayName("an unused category is deleted without a replacement")
    void deletesUnusedCategory() {
        UUID id = UUID.randomUUID();
        Category category = category(id, "Rent", CategoryKind.EXPENSE);
        when(categories.findVisibleById(id, USER)).thenReturn(Optional.of(category));
        when(transactions.countByUserIdAndCategoryId(USER, id)).thenReturn(0L);

        service.delete(id, null);

        verify(categories).delete(category);
        verify(transactions, never()).reassignCategory(any(), any(), any());
    }

    @Test
    @DisplayName("reassignment moves the transactions before the category goes")
    void reassignsThenDeletes() {
        UUID id = UUID.randomUUID();
        UUID replacementId = UUID.randomUUID();
        Category category = category(id, "Rent", CategoryKind.EXPENSE);
        when(categories.findVisibleById(id, USER)).thenReturn(Optional.of(category));
        when(categories.findVisibleById(replacementId, USER))
                .thenReturn(Optional.of(category(replacementId, "Housing", CategoryKind.EXPENSE)));
        when(transactions.countByUserIdAndCategoryId(USER, id)).thenReturn(3L);

        service.delete(id, replacementId);

        verify(transactions).reassignCategory(USER, id, replacementId);
        verify(categories).delete(category);
    }

    @Test
    @DisplayName("the replacement has to be the same kind, or the ledger silently flips sign")
    void refusesReassignmentAcrossKinds() {
        UUID id = UUID.randomUUID();
        UUID replacementId = UUID.randomUUID();
        when(categories.findVisibleById(id, USER))
                .thenReturn(Optional.of(category(id, "Rent", CategoryKind.EXPENSE)));
        when(categories.findVisibleById(replacementId, USER))
                .thenReturn(Optional.of(category(replacementId, "Salary", CategoryKind.INCOME)));
        when(transactions.countByUserIdAndCategoryId(USER, id)).thenReturn(1L);

        assertFails(() -> service.delete(id, replacementId), ErrorCode.BUSINESS_RULE);
        verify(transactions, never()).reassignCategory(any(), any(), any());
    }

    @Test
    @DisplayName("another user's category is reported as absent")
    void foreignCategoryIsNotFound() {
        UUID id = UUID.randomUUID();
        when(categories.findVisibleById(id, USER)).thenReturn(Optional.empty());

        assertFails(() -> service.delete(id, null), ErrorCode.NOT_FOUND);
    }

    // ---------------------------------------------------------------- helpers

    private static void assertFails(ThrowingCallable callable, ErrorCode expected) {
        assertThatThrownBy(callable)
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).getCode()).isEqualTo(expected));
    }

    private static Category category(UUID id, String name, CategoryKind kind) {
        Category category = new Category();
        category.setId(id);
        category.setUserId(USER);
        category.setName(name);
        category.setKind(kind);
        category.setSystem(false);
        return category;
    }
}
