package com.primeledger.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3.1 document metadata (proposal §5.1). Swagger UI is served in
 * non-production profiles only — see {@code springdoc.swagger-ui.enabled} in
 * application.yml.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI primeLedgerOpenApi(@Value("${primeledger.api.base-url:http://localhost:8080}") String baseUrl) {
        return new OpenAPI()
                .info(
                        new Info()
                                .title("PrimeLedger API")
                                .version("v1")
                                .description(
                                        """
                                        Personal finance ledger. REST over JSON, every route under /api/v1.

                                        Phase 2 exposes transactions and categories. Authentication arrives in \
                                        Phase 3, after which every endpoint except /actuator/health requires a \
                                        bearer token issued by Supabase Auth.""")
                                .license(new License().name("MIT"))
                                .contact(new Contact().name("PrimeLedger")))
                .servers(List.of(new Server().url(baseUrl).description("Current environment")));
    }
}
