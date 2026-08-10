package com.primeledger.category;

import com.primeledger.common.ApiException;
import com.primeledger.category.dto.CategoryRequest;
import com.primeledger.category.dto.CategoryResponse;
import com.primeledger.security.CurrentUserProvider;
import com.primeledger.transaction.TransactionRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoryService {

    private final CategoryRepository categories;
    private final TransactionRepository transactions;
    private final CategoryMapper mapper;
    private final CurrentUserProvider currentUser;

    public CategoryService(
            CategoryRepository categories,
            TransactionRepository transactions,
            CategoryMapper mapper,
            CurrentUserProvider currentUser) {
        this.categories = categories;
        this.transactions = transactions;
        this.mapper = mapper;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> list() {
        return categories.findVisibleTo(currentUser.currentUserId()).stream()
                .map(mapper::toResponse)
                .toList();
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        UUID userId = currentUser.currentUserId();

        if (categories.existsByUserIdAndKindAndNameIgnoreCase(userId, request.kind(), request.name())) {
            throw ApiException.conflict(
                    "A %s category named '%s' already exists"
                            .formatted(request.kind().name().toLowerCase(), request.name()));
        }

        Category category = new Category();
        category.setUserId(userId);
        category.setSystem(false);
        apply(request, category);
        return mapper.toResponse(categories.saveAndFlush(category));
    }

    @Transactional
    public CategoryResponse update(UUID id, CategoryRequest request) {
        Category category = ownedOrThrow(id);

        boolean renamed = !category.getName().equalsIgnoreCase(request.name());
        boolean rekinded = category.getKind() != request.kind();
        if ((renamed || rekinded)
                && categories.existsByUserIdAndKindAndNameIgnoreCase(
                        category.getUserId(), request.kind(), request.name())) {
            throw ApiException.conflict(
                    "A %s category named '%s' already exists"
                            .formatted(request.kind().name().toLowerCase(), request.name()));
        }

        apply(request, category);
        return mapper.toResponse(categories.saveAndFlush(category));
    }

    /**
     * Delete with reassignment (proposal §8.1).
     *
     * <p>{@code transactions.category_id} is NOT NULL with no cascade, so a
     * category in use cannot simply disappear. The caller either names a
     * replacement or gets a 422 telling them how many rows are in the way.
     *
     * @param reassignTo category to move affected transactions to, or
     *     {@code null} to refuse the delete when any exist
     */
    @Transactional
    public void delete(UUID id, UUID reassignTo) {
        UUID userId = currentUser.currentUserId();
        Category category = ownedOrThrow(id);

        long inUse = transactions.countByUserIdAndCategoryId(userId, id);
        if (inUse > 0) {
            if (reassignTo == null) {
                throw ApiException.businessRule(
                        ("%d transaction(s) still use this category. "
                                        + "Pass reassignTo with a replacement category id.")
                                .formatted(inUse));
            }
            if (reassignTo.equals(id)) {
                throw ApiException.businessRule("reassignTo must be a different category");
            }
            Category replacement =
                    categories
                            .findVisibleById(reassignTo, userId)
                            .orElseThrow(() -> ApiException.notFound("Category", reassignTo));
            if (replacement.getKind() != category.getKind()) {
                throw ApiException.businessRule(
                        "reassignTo must be a %s category"
                                .formatted(category.getKind().name().toLowerCase()));
            }
            transactions.reassignCategory(userId, id, reassignTo);
        }

        categories.delete(category);
    }

    /**
     * Resolves a category the caller is allowed to file a transaction under —
     * their own or a system one.
     */
    @Transactional(readOnly = true)
    public Category requireUsable(UUID id, UUID userId) {
        return categories
                .findVisibleById(id, userId)
                .orElseThrow(() -> ApiException.notFound("Category", id));
    }

    /**
     * Resolves a category the caller may write to.
     *
     * <p>Looked up as "visible" rather than "owned" so a system category — which
     * the caller can plainly see in {@code GET /categories} — comes back as a
     * 422 explaining why it is read-only, instead of a 404 denying it exists.
     */
    private Category ownedOrThrow(UUID id) {
        Category category =
                categories
                        .findVisibleById(id, currentUser.currentUserId())
                        .orElseThrow(() -> ApiException.notFound("Category", id));
        if (!category.isEditable()) {
            throw ApiException.businessRule("System categories cannot be modified");
        }
        return category;
    }

    private static void apply(CategoryRequest request, Category category) {
        category.setName(request.name().trim());
        category.setKind(request.kind());
        category.setIcon(request.icon());
        category.setColour(request.colour());
        category.setSortOrder(request.sortOrderOrDefault());
    }
}
