package com.primeledger.security;

import com.primeledger.PostgresContainer;
import com.primeledger.DockerRequired;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Base for tests whose subject is row-level security itself.
 *
 * <p>The one thing that distinguishes it from
 * {@link com.primeledger.AbstractIntegrationTest} is the credential: this
 * context connects as {@code primeledger_app}, the unprivileged role V2 creates,
 * exactly as production does. Migrations still run as the privileged role,
 * because they have to.
 *
 * <p>That distinction is the entire point. Connected as the owner, every policy
 * is bypassed and an isolation test passes whether or not the policies exist —
 * it would be testing the application's {@code WHERE user_id = ?} clauses and
 * calling the result database security. {@code require-rls=true} is left on so
 * the context refuses to start if the role ever regains the ability to bypass.
 */
@SpringBootTest(
        properties = {
            // The real JWT-backed provider, so "no identity" genuinely means
            // none. Under the fixed-user provider every connection would carry
            // the development user and the anonymous case could not be tested.
            // No token is ever presented here — these tests use RunAs — so the
            // Supabase settings only need to be non-blank.
            "primeledger.dev.fixed-user=false",
            "supabase.jwks-uri=https://project.supabase.co/auth/v1/jwks",
            "supabase.issuer=https://project.supabase.co/auth/v1",
            "primeledger.security.require-rls=true",
        })
@ExtendWith(DockerRequired.class)
public abstract class AbstractRlsIntegrationTest {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", PostgresContainer::jdbcUrl);
        // The runtime role: no superuser, no BYPASSRLS, subject to every policy.
        registry.add("spring.datasource.username", () -> PostgresContainer.APP_USER);
        registry.add("spring.datasource.password", () -> PostgresContainer.APP_PASSWORD);
        // Migrations need privileges the runtime role does not have.
        registry.add("spring.flyway.user", () -> PostgresContainer.ADMIN_USER);
        registry.add("spring.flyway.password", () -> PostgresContainer.ADMIN_PASSWORD);
    }
}
