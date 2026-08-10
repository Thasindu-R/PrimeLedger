package com.primeledger.config;

import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountType;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryRepository;
import com.primeledger.security.CurrentUserProvider;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gives the local database enough rows that the API can actually be exercised.
 *
 * <p>Phase 2's deliverable is "a running API with Swagger UI", and a reviewer
 * cannot POST a transaction without an account and a category to file it under.
 * This seeds one of each for the fixed development user.
 *
 * <p>Everything here is temporary scaffolding: Phase 3 replaces the user with a
 * real Supabase account and moves the categories into
 * {@code V3__seed_system_categories.sql}; Phase 5 brings the accounts API. It
 * is off unless {@code primeledger.seed-demo-data} is true, which only the dev
 * profile sets.
 */
@Configuration
@ConditionalOnProperty(name = "primeledger.seed-demo-data", havingValue = "true")
public class DevDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

    private record SeedCategory(String name, CategoryKind kind, String colour, int sortOrder) {}

    private static final List<SeedCategory> CATEGORIES =
            List.of(
                    new SeedCategory("Salary", CategoryKind.INCOME, "#16A34A", 0),
                    new SeedCategory("Freelance", CategoryKind.INCOME, "#22C55E", 1),
                    // Present from the first commit, unlike in the frontend the
                    // audit found — this is D-01 not being reintroduced.
                    new SeedCategory("Investment", CategoryKind.INCOME, "#0EA5E9", 2),
                    new SeedCategory("Groceries", CategoryKind.EXPENSE, "#F97316", 0),
                    new SeedCategory("Rent", CategoryKind.EXPENSE, "#EF4444", 1),
                    new SeedCategory("Transport", CategoryKind.EXPENSE, "#8B5CF6", 2),
                    new SeedCategory("Utilities", CategoryKind.EXPENSE, "#EAB308", 3),
                    new SeedCategory("Entertainment", CategoryKind.EXPENSE, "#EC4899", 4));

    @Bean
    public ApplicationRunner seedDevData(
            JdbcTemplate jdbc,
            AccountRepository accounts,
            CategoryRepository categories,
            CurrentUserProvider currentUser) {

        return args -> seed(jdbc, accounts, categories, currentUser.currentUserId());
    }

    @Transactional
    void seed(
            JdbcTemplate jdbc,
            AccountRepository accounts,
            CategoryRepository categories,
            UUID userId) {

        // The FK target. On Supabase this row is created by GoTrue at sign-up;
        // locally V1 stood in a minimal auth.users for exactly this.
        jdbc.update(
                """
                insert into auth.users (id, email) values (?, ?)
                on conflict (id) do nothing
                """,
                userId,
                "dev@primeledger.local");

        if (accounts.findByUserIdOrderByNameAsc(userId).isEmpty()) {
            Account account = new Account();
            account.setUserId(userId);
            account.setName("Everyday");
            account.setType(AccountType.CHECKING);
            account.setCurrency("USD");
            account.setOpeningBalance(BigDecimal.ZERO);
            account.setColour("#4F46E5");
            accounts.save(account);
            log.info("Seeded development account 'Everyday' for user {}", userId);
        }

        int created = 0;
        for (SeedCategory seed : CATEGORIES) {
            if (categories.existsByUserIdAndKindAndNameIgnoreCase(userId, seed.kind(), seed.name())) {
                continue;
            }
            Category category = new Category();
            category.setUserId(userId);
            category.setName(seed.name());
            category.setKind(seed.kind());
            category.setColour(seed.colour());
            category.setSortOrder(seed.sortOrder());
            category.setSystem(false);
            categories.save(category);
            created++;
        }
        if (created > 0) {
            log.info("Seeded {} development categories for user {}", created, userId);
        }
    }
}
