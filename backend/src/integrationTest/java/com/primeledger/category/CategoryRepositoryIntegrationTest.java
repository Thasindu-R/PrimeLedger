package com.primeledger.category;

import static org.assertj.core.api.Assertions.assertThat;

import com.primeledger.AbstractIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * The visibility rules, which are half ownership and half the {@code NULL}
 * user_id convention that marks a system category.
 */
@Transactional
class CategoryRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired private CategoryRepository categories;
    @Autowired private JdbcTemplate jdbc;

    private UUID alice;
    private UUID bob;

    @BeforeEach
    void setUp() {
        alice = seedUser();
        bob = seedUser();
    }

    @Test
    @DisplayName("a user sees their own categories and the system ones, and nobody else's")
    void showsOwnedAndSystemOnly() {
        Category mine = save(alice, "Groceries", CategoryKind.EXPENSE);
        Category theirs = save(bob, "Bob's groceries", CategoryKind.EXPENSE);
        UUID systemId = seedSystemCategory("Rent", "expense");

        var visible = categories.findVisibleTo(alice);

        assertThat(visible).extracting(Category::getId).contains(mine.getId(), systemId);
        assertThat(visible).extracting(Category::getId).doesNotContain(theirs.getId());
    }

    @Test
    @DisplayName("a system category is visible but not owned")
    void systemCategoryIsVisibleNotOwned() {
        UUID systemId = seedSystemCategory("Utilities", "expense");

        assertThat(categories.findVisibleById(systemId, alice)).isPresent();
        assertThat(categories.findByIdAndUserId(systemId, alice)).isEmpty();
    }

    @Test
    @DisplayName("another user's category is invisible even by id")
    void foreignCategoryIsInvisible() {
        Category theirs = save(bob, "Bob's rent", CategoryKind.EXPENSE);

        assertThat(categories.findVisibleById(theirs.getId(), alice)).isEmpty();
    }

    @Test
    @DisplayName("the duplicate check ignores case, matching the unique index")
    void duplicateCheckIgnoresCase() {
        save(alice, "Groceries", CategoryKind.EXPENSE);

        assertThat(
                        categories.existsByUserIdAndKindAndNameIgnoreCase(
                                alice, CategoryKind.EXPENSE, "groceries"))
                .isTrue();
        assertThat(
                        categories.existsByUserIdAndKindAndNameIgnoreCase(
                                alice, CategoryKind.INCOME, "groceries"))
                .isFalse();
        assertThat(
                        categories.existsByUserIdAndKindAndNameIgnoreCase(
                                bob, CategoryKind.EXPENSE, "groceries"))
                .isFalse();
    }

    @Test
    @DisplayName("the kind is stored as the lower-case value the check constraint allows")
    void storesKindAsLowerCase() {
        Category saved = save(alice, "Salary", CategoryKind.INCOME);

        String stored =
                jdbc.queryForObject(
                        "select kind from categories where id = ?", String.class, saved.getId());

        assertThat(stored).isEqualTo("income");
    }

    @Test
    @DisplayName("listing is ordered by kind, then sort order, then name")
    void ordersDeterministically() {
        Category b = save(alice, "Beta", CategoryKind.EXPENSE, 1);
        Category a = save(alice, "Alpha", CategoryKind.EXPENSE, 0);

        var visible =
                categories.findVisibleTo(alice).stream()
                        .filter(c -> alice.equals(c.getUserId()))
                        .toList();

        assertThat(visible).extracting(Category::getId).containsExactly(a.getId(), b.getId());
    }

    // ---------------------------------------------------------------- helpers

    private UUID seedUser() {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into auth.users (id, email) values (?, ?)", id, id + "@test.local");
        return id;
    }

    private UUID seedSystemCategory(String name, String kind) {
        return jdbc.queryForObject(
                """
                insert into categories (user_id, name, kind, is_system)
                values (null, ?, ?, true) returning id
                """,
                UUID.class,
                name + " " + UUID.randomUUID(),
                kind);
    }

    private Category save(UUID userId, String name, CategoryKind kind) {
        return save(userId, name, kind, 0);
    }

    private Category save(UUID userId, String name, CategoryKind kind, int sortOrder) {
        Category category = new Category();
        category.setUserId(userId);
        category.setName(name);
        category.setKind(kind);
        category.setSortOrder(sortOrder);
        return categories.saveAndFlush(category);
    }
}
