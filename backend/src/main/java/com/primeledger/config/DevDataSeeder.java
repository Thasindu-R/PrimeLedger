package com.primeledger.config;

import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountType;
import com.primeledger.security.RunAs;
import java.math.BigDecimal;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Gives the local database enough rows that the API can actually be exercised.
 *
 * <p>A reviewer cannot POST a transaction without an account to file it under,
 * so this seeds one for the development user. Categories are no longer seeded
 * here — {@code V3__seed_system_categories.sql} makes them system rows visible
 * to every user, which is where they belong.
 *
 * <p>It runs inside {@link RunAs}, and has to. Row-level security does not
 * exempt start-up code: with no {@code app.user_id} on the connection the insert
 * below is rejected by the {@code accounts_owner} policy rather than silently
 * landing somewhere odd. Naming the user is the price of the policy applying to
 * everything, which is the property that makes it worth having.
 *
 * <p>Off unless {@code primeledger.seed-demo-data} is true, which only the dev
 * profile sets.
 */
@Configuration
@ConditionalOnProperty(name = "primeledger.seed-demo-data", havingValue = "true")
public class DevDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

    @Bean
    public ApplicationRunner seedDevData(
            JdbcTemplate jdbc,
            AccountRepository accounts,
            TransactionTemplate transactions,
            @Value("${primeledger.dev.user-id:00000000-0000-4000-8000-000000000001}") UUID userId) {

        return args ->
                RunAs.run(userId, () -> transactions.executeWithoutResult(
                        status -> seed(jdbc, accounts, userId)));
    }

    void seed(JdbcTemplate jdbc, AccountRepository accounts, UUID userId) {
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
    }
}
