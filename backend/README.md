# PrimeLedger backend

Spring Boot 4.1 REST API on Java 21, backed by Supabase PostgreSQL 16.

**Status: Phase 3 complete.** Supabase Auth as an OAuth2 resource server,
row-level security on every user-owned table, and integration tests proving two
users cannot see each other's data — on top of the Phase 2 CRUD, migrations,
error handling, springdoc, Actuator and request-correlated JSON logging.

## Quick start

```bash
docker compose up -d db          # from the repo root
./gradlew bootRun                # http://localhost:8080
```

Then open <http://localhost:8080/swagger-ui.html>. Under the `dev` profile the
API seeds an account for the development user, so the endpoints can be exercised
immediately, and the twelve system categories arrive from `V3`.

## Two database roles, and why it matters

This is the part to understand before changing anything about the datasource.

| Role | Used by | Privileges |
|------|---------|------------|
| `primeledger` | Flyway | owns the schema, runs DDL |
| `primeledger_app` | the connection pool | `SELECT/INSERT/UPDATE/DELETE` only |

PostgreSQL lets a **superuser** ignore row-level security entirely, and lets a
table's **owner** ignore it unless the table is marked `FORCE ROW LEVEL
SECURITY`. So if the API connected as the migration role, every policy in
`V2` would be inert — and nothing would look wrong. The application would work,
the tests would pass, and users would be able to read each other's rows.

Two things stop that. `V2` marks every user-owned table `FORCE`, and
`RlsGuard` checks at start-up that the connected role is neither a superuser
nor `BYPASSRLS`, refusing to boot if it is:

```
The API is connecting as 'primeledger', which bypasses row-level security
(superuser=true, bypassrls=true). Every policy in V2 is inert...
```

`primeledger_app` is created by `V2` **without a password** — credentials do not
belong in a migration that runs in every environment. Login is provisioned
separately: `docker/postgres-init/` locally and in tests, and one manual
`ALTER ROLE ... LOGIN PASSWORD` on Supabase.

## Who is the current user?

`CurrentUserProvider` is the single seam. In production it reads the `sub` claim
of the validated Supabase JWT. `RlsTenantResolver` asks *that same provider* for
the identity it stamps onto each connection as `app.user_id` — deliberately, so
the row filter and the application's own `WHERE user_id = ?` clauses can never
disagree about who the user is. (They did once, and the result was an API that
silently saw an empty database.)

Background work has no request to take an identity from, so it names one
explicitly with `RunAs` — the development seeder today, the recurring-transaction
materialiser in Phase 6. It is not a way to escape RLS: a caller names one user
and gets exactly that user's view.

### Running locally without Supabase

`FIXED_USER=true` (the default under the `dev` profile) skips authentication and
attributes every request to `primeledger.dev.user-id`. It logs a warning on every
boot, and `SecurityConfig` refuses to start with it set under the `prod` profile.
Row-level security still applies — this weakens authentication, not isolation.

> **`JdbcTemplate` bypasses the RLS context.** The identity is set on connections
> Hibernate hands out, so a raw `JdbcTemplate` query runs with no `app.user_id`
> and sees nothing. That fails closed, which is the right direction, but it is
> surprising — prefer a repository, or `EntityManager.createNativeQuery`.

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
| `V2__row_level_security.sql` | 3 | ✅ applied |
| `V3__seed_system_categories.sql` | 3 | ✅ applied |
| `V4__fulltext_search_index.sql` | 7 | |

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

Two more worth knowing about, both found the hard way:

- **`@AutoConfigureMockMvc` moved** to
  `org.springframework.boot.webmvc.test.autoconfigure`.
- **`HibernatePropertiesCustomizer` moved** to
  `org.springframework.boot.hibernate.autoconfigure`.

## Testing row-level security

Integration tests come in two flavours, and the split is intentional:

| Base class | Connects as | Subject |
|---|---|---|
| `AbstractIntegrationTest` | `primeledger` (bypasses RLS) | SQL semantics — specifications, native updates, constraints |
| `AbstractRlsIntegrationTest` | `primeledger_app` | the policies themselves |

Tests of the second kind are the ones that mean anything about security.
`RlsIsolationIntegrationTest` issues queries with **no owner filter at all** and
asserts they still come back empty — that is PostgreSQL enforcing isolation, not
the repository being careful, which is the promise NFR-06 actually makes.
`AuthIntegrationTest` does the same at the HTTP boundary with real RS256 tokens
signed by a keypair generated for the run.

## Next: Phase 4

TanStack Query and the typed API client on the frontend, replacing
`useTransactions`' internals, deleting the localStorage persistence, and wiring
server-side pagination, filtering and sorting through the UI.
