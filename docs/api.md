# API reference

> **Status: stub.** Phase 2 adds springdoc-openapi, which serves an interactive
> Swagger UI and a machine-readable spec. This file carries the hand-written
> context that a generated spec cannot: conventions, error semantics, and the
> rules a caller has to know.

## Conventions

| | |
|---|---|
| Base path | `/api/v1` |
| Local | `http://localhost:8080/api/v1` |
| Swagger UI | `/swagger-ui.html` *(from Phase 2)* |
| Health | `/actuator/health` |
| Auth | `Authorization: Bearer <supabase-jwt>` on every endpoint except health |

- Amounts are **decimal strings** (`"1250.00"`), never JSON numbers — floats
  lose cents.
- Dates are `YYYY-MM-DD` calendar dates. Timestamps are ISO-8601 UTC.
- List endpoints are paginated and return a `PageResponse` envelope.
- Filtering and sorting are **server-side** from Phase 4 — the client sends
  query parameters and does not sort locally.

## Errors

Every failure returns the `ApiError` shape from `common/`, with an appropriate
status. Validation failures list the offending fields rather than returning a
single opaque message.

## Endpoints

Documented as they land. Phase 2 delivers transactions and categories.
