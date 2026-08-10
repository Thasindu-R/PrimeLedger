# PrimeLedger backend

Spring Boot 4.1 REST API on Java 21, backed by Supabase PostgreSQL 16.

**Status: Phase 2 complete.** Gradle build, `V1__initial_schema.sql`,
transaction and category CRUD, the global exception handler, springdoc, Actuator
and request-correlated JSON logging are in. No authentication yet — that is
Phase 3.

## Quick start

```bash
docker compose up -d db          # from the repo root
./gradlew bootRun                # http://localhost:8080
```

Then open <http://localhost:8080/swagger-ui.html>. Under the `dev` profile the
API seeds one account and eight categories for the development user, so the
endpoints can be exercised immediately.

### Who is the current user?

Phase 2 ships without authentication, but ownership exists in the schema from
V1 and every service filters on it. `CurrentUserProvider` is the single seam:
until Phase 3 it returns the fixed `primeledger.dev.user-id`; then a JWT-backed
implementation displaces it via `@ConditionalOnMissingBean` and nothing else
changes.

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

> **They need Docker.** The suite is annotated `disabledWithoutDocker`, so on a
> machine with no Docker daemon it *skips* rather than fails — which means a
> green `integrationTest` proves nothing on its own. Check the skipped count, and
> keep Docker available in CI.

## Migrations

`src/main/resources/db/migration/`, applied by Flyway in version order:

| File | Phase | Status |
|------|-------|--------|
| `V1__initial_schema.sql` | 2 | ✅ applied |
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

```bash
./gradlew bootRun          # run locally on :8080
./gradlew test             # unit tests
./gradlew integrationTest  # Testcontainers suite
./gradlew flywayMigrate    # apply migrations
./gradlew jacocoTestCoverageVerification
```

For a local database without Supabase: `docker compose up -d db` from the repo
root.

## Notes on the build

Java 21 is set as a Gradle **toolchain**, not taken from the developer's `PATH`;
the foojay resolver in `settings.gradle.kts` provisions it when missing. The
wrapper is committed, so `./gradlew` needs no local Gradle install.

Three Spring Boot 4 specifics that are easy to trip over, all deliberate:

- **`spring-boot-starter-flyway`, not bare `flyway-core`.** Boot 4 moved
  Flyway's auto-configuration into its own module. With only the library on the
  classpath the migrations never run and Hibernate fails validation against an
  empty database.
- **`spring-boot-starter-webmvc-test`** carries the `@WebMvcTest` slice, which
  is no longer part of `spring-boot-starter-test`.
- **Testcontainers 2.x** prefixes its module artifacts
  (`org.testcontainers:testcontainers-postgresql`).

Security and the OAuth2 resource server are intentionally absent from the
dependency set until Phase 3: adding the starter now would lock every endpoint
before there is anything to authenticate with.

## Next: Phase 3

Supabase project and Auth, the Spring Security resource server with the JWT
converter, `V2__row_level_security.sql`, `V3__seed_system_categories.sql`, and
the RLS connection customiser that sets `app.user_id` per transaction.
