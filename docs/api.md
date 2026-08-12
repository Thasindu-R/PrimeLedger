# API reference

> **Status: Phase 3.** Transactions and categories are live and every endpoint
> requires a Supabase bearer token. springdoc serves the interactive Swagger UI
> at `/swagger-ui.html` and the spec at `/v3/api-docs`; this file carries the
> hand-written context a generated spec cannot: conventions, error semantics,
> and the rules a caller has to know.

## Authentication

Send the Supabase access token as a bearer token on every request except the
health probes and the docs:

```
Authorization: Bearer <supabase-access-token>
```

The API validates the RS256 signature against the project's cached JWKS and
checks issuer, audience and expiry. It never calls Supabase per request and
never sees a password. The `sub` claim becomes the user id.

| Response | Meaning |
|---|---|
| 401 | absent, malformed, expired, wrongly signed, or wrong issuer/audience |
| 403 | authenticated but not permitted (unused so far) |
| 404 | the row does not exist **or** belongs to someone else |

Isolation does not rest on this layer. Every user-owned table carries a
row-level security policy comparing the row's owner against `app.user_id`, which
the backend sets from the validated token at the start of each transaction. A
query that forgets its owner filter returns nothing rather than everything.

## Conventions

| | |
|---|---|
| Base path | `/api/v1` |
| Local | `http://localhost:8080/api/v1` |
| Swagger UI | `/swagger-ui.html` *(from Phase 2)* |
| Health | `/actuator/health` |
| Auth | `Authorization: Bearer <supabase-jwt>` on every endpoint except health and docs |

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

Documented as they land. Phase 2 delivered transactions and categories; Phase 4
added the analytics summary and the read half of accounts.

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
by `occurredOn`, `amount`, `createdAt`, `description`, `type` and
`category.name` only — anything else is rejected with 400 rather than silently
ignored. Default order is `occurredOn` descending.

> Enum values are **upper case** on the wire, in both directions:
> `"type": "EXPENSE"` in a body, and `?type=EXPENSE` in a query. `?type=expense`
> is a 400.

Two rules the schema cannot express, both enforced by the service:

- the category's kind must match the transaction's type — an expense cannot be
  filed under an income category;
- `occurredOn` may not be later than tomorrow (the server half of D-09;
  tomorrow is allowed so a client in a timezone ahead of the server is not
  rejected for dating something "today").

### Accounts

| Method | Path | Notes |
|---|---|---|
| GET | `/accounts` | The caller's accounts, ordered by name |
| POST | `/accounts/default` | Idempotent: returns the caller's first account, creating `Everyday` if they have none |

Phase 5 owns accounts (F-01) — creating, renaming, archiving, balances and
transfers all arrive there. These two exist because Phase 4 could not do without
them: `transactions.account_id` is `NOT NULL`, so a user who owns no account
cannot record anything, and a freshly signed-up user owns none.

`POST /accounts/default` is a POST rather than folded into the `GET` because it
genuinely inserts, and a `GET` that writes is one that cannot be cached or
retried safely. Calling it repeatedly converges on one account rather than
accumulating them.

### Analytics

| Method | Path | Notes |
|---|---|---|
| GET | `/analytics/summary` | Totals, category breakdown and monthly series |

Takes the **same filter as `GET /transactions`** and applies it identically, so
the summary always describes exactly the rows that endpoint would return.
Unfiltered, it describes the whole ledger.

```json
{
  "totals":  { "income": "4200.00", "expense": "1875.50", "balance": "2324.50",
               "count": 384, "highestExpense": "899.00" },
  "byCategory": [
    { "categoryId": "…", "categoryName": "Groceries", "type": "EXPENSE",
      "total": "312.75", "count": 9 }
  ],
  "monthly": [
    { "month": "2026-08", "income": "4200.00", "expense": "1875.50" }
  ]
}
```

`monthly` is bucketed by `to_char(occurred_on, 'YYYY-MM')`, so the same month in
two different years is two buckets — the server-side form of D-02. Only months
with activity appear; a month with no rows produces no row, and the client fills
the window it wants to draw.

`count` and `highestExpense` are here for the same reason as the sums: derived
from a page they would be the page size and the largest row that happened to be
on screen.

This endpoint exists because the browser stopped being able to compute these.
Before Phase 4 the whole ledger was in memory and the dashboard reduced it
directly; once the list is paginated the client holds one page, and summing that
would report the current page's totals as the ledger's.

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

The twelve system categories are seeded by `V3__seed_system_categories.sql` and
are shared reference data: a row-level security policy makes them readable by
every user and writable by none, so the 422 above is a courtesy on top of a
constraint the database enforces regardless.
