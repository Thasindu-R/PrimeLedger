# API reference

> **Status: Phase 2.** Transactions and categories are live. springdoc serves
> the interactive Swagger UI at `/swagger-ui.html` and the spec at
> `/v3/api-docs`; this file carries the hand-written context a generated spec
> cannot: conventions, error semantics, and the rules a caller has to know.
>
> **No authentication yet.** Until Phase 3 every request is attributed to one
> configured development user (`primeledger.dev.user-id`). Services already
> filter by owner, so the wiring does not change — only where the id comes from.

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

| Status | Code | Used when |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Bean Validation rejected a field, or a query parameter would not bind |
| 404 | `NOT_FOUND` | Absent, **or owned by another user** — deliberately indistinguishable |
| 409 | `CONFLICT` | Uniqueness violation |
| 422 | `BUSINESS_RULE` | Structurally valid, domain-invalid |
| 500 | `INTERNAL_ERROR` | Unhandled; logged with the request id, never a stack trace |

Every response carries an `X-Request-Id` header, echoed in `requestId` on errors
and present on the matching log line.

## Endpoints

Documented as they land. Phase 2 delivers transactions and categories.

### Transactions

| Method | Path | Notes |
|---|---|---|
| GET | `/transactions` | Paginated, filtered, sorted |
| GET | `/transactions/{id}` | |
| POST | `/transactions` | 201 with `Location` |
| PUT | `/transactions/{id}` | |
| DELETE | `/transactions/{id}` | Soft delete, 204 |
| POST | `/transactions/{id}/restore` | Undo a soft delete |
| POST | `/transactions/bulk-delete` | Returns `{requested, deleted}` |

**Filters** (all optional): `from`, `to` (inclusive `occurredOn` bounds),
`type`, `categoryId`, `accountId`, `minAmount`, `maxAmount`, `search`
(case-insensitive substring of the description), `includeDeleted`.

**Paging and sorting**: `page`, `size` (max 200, default 50), `sort`. Sortable
by `occurredOn`, `amount`, `createdAt`, `description` only — anything else is
rejected with 400 rather than silently ignored. Default order is `occurredOn`
descending.

Two rules the schema cannot express, both enforced by the service:

- the category's kind must match the transaction's type — an expense cannot be
  filed under an income category;
- `occurredOn` may not be later than tomorrow (the server half of D-09;
  tomorrow is allowed so a client in a timezone ahead of the server is not
  rejected for dating something "today").

### Categories

| Method | Path | Notes |
|---|---|---|
| GET | `/categories` | The caller's own plus the shared system ones |
| POST | `/categories` | 201; 409 if the name already exists for that kind |
| PUT | `/categories/{id}` | User-owned only |
| DELETE | `/categories/{id}` | `?reassignTo={id}` |

A category still used by transactions cannot be deleted outright: pass
`reassignTo` naming another category **of the same kind**, or the request is
refused with 422 and a count of the rows in the way. System categories
(`system: true`) are visible to everyone and editable by no one — modifying one
is a 422, not a 404, because the caller can plainly see it exists.
