# PrimeLedger backend

Spring Boot 4.1 REST API on Java 21, backed by Supabase PostgreSQL 16.

**Status: scaffold only.** The package tree and source sets exist; no Java, no
Gradle build, no migrations yet. Phase 2 fills it in.

## Layout

Packages are organised by feature, not by technical layer — controller, service,
repository, entity and DTOs for one feature live together (proposal §6.3).

```
src/main/java/com/primeledger/
├── config/          SecurityConfig · CorsConfig · OpenApiConfig · SchedulerConfig
├── security/        JwtAuthConverter · CurrentUser resolver · RlsConnectionCustomizer
├── transaction/     Controller · Service · Repository · Entity · DTOs · Mapper
├── account/         F-01 accounts and transfers
├── category/        system-seeded and user-defined
├── budget/          F-02 limits and threshold evaluation
├── goal/            F-04 savings goals
├── recurring/       rule entity + @Scheduled materialiser (F-03)
├── analytics/       summary · timeseries · breakdown · insights
├── importexport/    CSV / XLSX parse and generate (F-06)
├── profile/         display name · currency · locale · theme
└── common/          GlobalExceptionHandler · ApiError · PageResponse · Auditable
```

`common/` may not depend on a feature package. The dependency runs one way.

Each package carries a `package-info.java` recording its contents and the phase
that populates it.

## Source sets

| Path | Purpose |
|------|---------|
| `src/main/java` | production code |
| `src/test/java` | JUnit 5 unit tests — domain logic in isolation |
| `src/integrationTest/java` | Testcontainers suite against real PostgreSQL |

Integration tests are a separate source set because `./gradlew integrationTest`
is a distinct task from `./gradlew test` (proposal §A.3). They run against a real
database specifically so row-level security policies are exercised rather than
assumed (§9.2).

## Migrations

`src/main/resources/db/migration/`, applied by Flyway in version order:

| File | Phase |
|------|-------|
| `V1__initial_schema.sql` | 2 |
| `V2__row_level_security.sql` | 3 |
| `V3__seed_system_categories.sql` | 3 |
| `V4__fulltext_search_index.sql` | 7 |

Write `V1__initial_schema.sql` from proposal §7 **before any Java** — the schema
is the contract everything else derives from (§A.5).

Money is `NUMERIC(15,2)` in the database and `BigDecimal` in Java, never a
float, and crosses the wire as a decimal string.

Applied migrations are immutable. To change one, add the next version.

## Configuration

Copy `.env.example` to `.env` and fill it in. The service-role key is
backend-only — see the warning in that file.

## Commands

Available once Phase 2 adds the Gradle build:

```bash
./gradlew bootRun          # run locally on :8080
./gradlew test             # unit tests
./gradlew integrationTest  # Testcontainers suite
./gradlew flywayMigrate    # apply migrations
./gradlew jacocoTestCoverageVerification
```

For a local database without Supabase: `docker compose up -d db` from the repo
root.

## Getting started on Phase 2

Generate the Gradle project at [start.spring.io](https://start.spring.io) with
the §A.4 dependency set — web, data-jpa, security, oauth2-resource-server,
validation, actuator, flyway-core, postgresql, mapstruct, lombok,
springdoc-openapi-starter-webmvc-ui, bucket4j-core, testcontainers-postgresql,
assertj — then move the generated sources into the tree above rather than
keeping the generator's flat package.
