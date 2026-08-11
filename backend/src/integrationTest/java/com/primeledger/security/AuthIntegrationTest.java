package com.primeledger.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.primeledger.PostgresContainer;
import com.primeledger.account.Account;
import com.primeledger.account.AccountRepository;
import com.primeledger.account.AccountType;
import com.primeledger.category.Category;
import com.primeledger.category.CategoryKind;
import com.primeledger.category.CategoryRepository;
import com.primeledger.transaction.Transaction;
import com.primeledger.transaction.TransactionRepository;
import com.primeledger.transaction.TransactionType;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import com.primeledger.config.SecurityConfig;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.DockerClientFactory;

/**
 * Authentication end to end: a real HTTP request, a real Supabase-shaped token,
 * the real filter chain, and a database that enforces isolation underneath it.
 *
 * <p>Together with {@link RlsIsolationIntegrationTest} this is the Phase 3
 * deliverable — "two accounts can be created and provably cannot see each
 * other's data" — checked at the boundary a client actually talks to. The
 * rejection cases matter as much as the happy path: a resource server that
 * accepts an expired token, or one signed by the wrong key, is not a resource
 * server.
 *
 * <p>Only the JWKS lookup is substituted, by a decoder holding a keypair
 * generated for this run. Signature verification, issuer and audience checks,
 * claim conversion and the RLS identity are all production code.
 */
@SpringBootTest(
        properties = {
            "primeledger.dev.fixed-user=false",
            "primeledger.security.require-rls=true",
            "supabase.jwks-uri=https://project.supabase.co/auth/v1/jwks",
            "supabase.issuer=https://project.supabase.co/auth/v1",
        })
@AutoConfigureMockMvc
@EnabledIf("dockerAvailable")
class AuthIntegrationTest {

    private static final JwtTestTokens TOKENS = new JwtTestTokens();

    @TestConfiguration
    static class LocalKeyDecoder {

        /**
         * Stands in for the JWKS fetch. {@code @Primary} rather than a bean
         * definition override so the production decoder is still constructed —
         * if that bean stopped being creatable, this test would notice.
         */
        @Bean
        @Primary
        JwtDecoder testJwtDecoder() {
            NimbusJwtDecoder decoder =
                    NimbusJwtDecoder.withPublicKey(TOKENS.publicKey()).build();
            // The production validator chain, not a lookalike — otherwise the
            // test could pass while the real issuer or audience check was broken.
            decoder.setJwtValidator(
                    SecurityConfig.validators(JwtTestTokens.ISSUER, JwtTestTokens.AUDIENCE));
            return decoder;
        }
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", PostgresContainer.INSTANCE::getJdbcUrl);
        registry.add("spring.datasource.username", () -> PostgresContainer.APP_USER);
        registry.add("spring.datasource.password", () -> PostgresContainer.APP_PASSWORD);
        registry.add("spring.flyway.user", () -> PostgresContainer.ADMIN_USER);
        registry.add("spring.flyway.password", () -> PostgresContainer.ADMIN_PASSWORD);
    }

    static boolean dockerAvailable() {
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (RuntimeException e) {
            return false;
        }
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private TransactionRepository transactions;
    @Autowired private AccountRepository accounts;
    @Autowired private CategoryRepository categories;
    @Autowired private TransactionTemplate tx;
    @Autowired private EntityManager entityManager;

    private UUID alice;
    private UUID bob;
    private UUID bobTransaction;

    @BeforeEach
    void setUp() {
        alice = createUser();
        bob = createUser();
        asUser(alice, () -> seedTransaction(alice, "Alice coffee"));
        bobTransaction = asUser(bob, () -> seedTransaction(bob, "Bob rent"));
    }

    @Test
    @DisplayName("a request with no token is rejected")
    void rejectsAnonymous() throws Exception {
        mockMvc.perform(get("/api/v1/transactions")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a token signed by the wrong key is rejected")
    void rejectsForgedSignature() throws Exception {
        mockMvc.perform(bearer(TOKENS.forgedFor(alice))).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("an expired token is rejected")
    void rejectsExpired() throws Exception {
        mockMvc.perform(bearer(TOKENS.expiredFor(alice))).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a token from another issuer is rejected")
    void rejectsWrongIssuer() throws Exception {
        mockMvc.perform(bearer(TOKENS.wrongIssuerFor(alice))).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a token minted for another audience is rejected")
    void rejectsWrongAudience() throws Exception {
        mockMvc.perform(bearer(TOKENS.wrongAudienceFor(alice))).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a malformed token is rejected")
    void rejectsGarbage() throws Exception {
        mockMvc.perform(bearer("not-a-jwt")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a valid token returns only that user's transactions")
    void returnsOwnDataOnly() throws Exception {
        mockMvc.perform(bearer(TOKENS.validFor(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].description").value("Alice coffee"));

        mockMvc.perform(bearer(TOKENS.validFor(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].description").value("Bob rent"));
    }

    @Test
    @DisplayName("one user cannot fetch another's transaction by id")
    void cannotReadAnotherUsersTransaction() throws Exception {
        // 404 rather than 403: whether the row exists is itself information Alice
        // is not entitled to.
        mockMvc.perform(
                        get("/api/v1/transactions/{id}", bobTransaction)
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + TOKENS.validFor(alice)))
                .andExpect(status().isNotFound());

        mockMvc.perform(
                        get("/api/v1/transactions/{id}", bobTransaction)
                                .header(HttpHeaders.AUTHORIZATION, "Bearer " + TOKENS.validFor(bob)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("the health probe stays reachable without a token")
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    // ---------------------------------------------------------------------
    // Fixtures
    // ---------------------------------------------------------------------

    private org.springframework.test.web.servlet.RequestBuilder bearer(String token) {
        return get("/api/v1/transactions").header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private <T> T asUser(UUID userId, Supplier<T> work) {
        return RunAs.callUnchecked(userId, () -> tx.execute(status -> work.get()));
    }

    private UUID createUser() {
        UUID id = UUID.randomUUID();
        tx.executeWithoutResult(
                status ->
                        entityManager
                                .createNativeQuery("insert into auth.users (id, email) values (?1, ?2)")
                                .setParameter(1, id)
                                .setParameter(2, id + "@primeledger.test")
                                .executeUpdate());
        return id;
    }

    private UUID seedTransaction(UUID userId, String description) {
        Account account = new Account();
        account.setUserId(userId);
        account.setName("Everyday");
        account.setType(AccountType.CHECKING);
        account.setCurrency("USD");
        account.setOpeningBalance(BigDecimal.ZERO);
        accounts.saveAndFlush(account);

        Category category = new Category();
        category.setUserId(userId);
        category.setName("Groceries");
        category.setKind(CategoryKind.EXPENSE);
        category.setSystem(false);
        categories.saveAndFlush(category);

        Transaction transaction = new Transaction();
        transaction.setUserId(userId);
        transaction.setAccountId(account.getId());
        transaction.setCategory(category);
        transaction.setType(TransactionType.EXPENSE);
        transaction.setAmount(new BigDecimal("9.50"));
        transaction.setCurrency("USD");
        transaction.setOccurredOn(LocalDate.of(2025, 6, 1));
        transaction.setDescription(description);
        return transactions.saveAndFlush(transaction).getId();
    }
}
