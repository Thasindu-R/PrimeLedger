# API reference

> **Status: Phase 5.** Transactions, categories, accounts, transfers, budgets
> and notifications are live, and every endpoint requires a Supabase bearer
> token. springdoc serves the interactive Swagger UI at `/swagger-ui.html` and
> the spec at `/v3/api-docs`; this file carries the hand-written context a
> generated spec cannot: conventions, error semantics, and the rules a caller
> has to know.

> **Two field names to get right.** `@Schema(name = …)` renames a field in the
> generated spec and nowhere else, so three booleans go over the wire under
> their Java names, not their documented ones: a transaction sends `transfer`
> (not `isTransfer`), an account sends `archived` (not `isArchived`), and a
> notification sends `read` (not `isRead`). The client parses the names above.

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
added the analytics summary and the read half of accounts; Phase 5 added the
rest of accounts, transfers, budgets and notifications; Phase 6 added recurring
rules, savings goals, currencies and the profile.

**A transaction has no category when it is a transfer leg.** `categoryId` and
`categoryName` are nullable from V5, and a client that declares them required
will reject a whole page over one transfer.

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
| GET | `/accounts` | With balances, ordered by name. `?includeArchived=true` for the lot |
| GET | `/accounts/{id}` | |
| POST | `/accounts` | 201; 409 if the name is already taken |
| PUT | `/accounts/{id}` | Currency is immutable once the account holds transactions (422) |
| POST | `/accounts/{id}/archive` | Hides it from pickers, keeps its history |
| POST | `/accounts/{id}/unarchive` | |
| DELETE | `/accounts/{id}` | Only while empty; archive instead to keep history (422) |
| POST | `/accounts/default` | Idempotent: the caller's first active account, creating `Everyday` if they have none |

`balance` is the opening balance plus every movement since. Transfer legs are
included — moving money does change what an account holds — while being excluded
from the income and expense totals in the analytics summary.

Archiving, not deleting, is the operation that matches closing a real account:
`transactions.account_id` is `ON DELETE RESTRICT`, and losing a year of history
to close one card is not a reasonable trade. Archiving the caller's last active
account is refused, because it would leave nothing to record against, and an
archived account will not accept new transactions.

`POST /accounts/default` is a POST rather than folded into the `GET` because it
genuinely inserts, and a `GET` that writes is one that cannot be cached or
retried safely. Calling it repeatedly converges on one account rather than
accumulating them.

### Transfers

| Method | Path | Notes |
|---|---|---|
| POST | `/transfers` | 201, returns both legs |
| DELETE | `/transfers/{legId}` | Soft-deletes both legs, given either |

A transfer is a linked pair of ordinary transactions — an expense on the source,
an income on the destination — written atomically, both flagged `isTransfer` and
each carrying the other's id in `transferPairId`.

**Transfer legs have no category.** V5 made `category_id` nullable with a check
constraint tying it to the flag: a transfer has no category and everything else
must have one. Moving your own money is not Groceries, not Salary, and not
"Other"; inventing a system "Transfer" category would put a fake row in every
picker, breakdown and budget.

Refused with 422: the same account twice, two accounts in different currencies
(conversion is F-05), an archived account, or a date beyond tomorrow.

Deleting one leg through `DELETE /transactions/{id}` deletes both, exactly as
the transfer endpoint does — money that left an account and arrived nowhere is
the one state a ledger must not reach.

### Budgets

| Method | Path | Notes |
|---|---|---|
| GET | `/budgets` | Budgets in force, with spend for the current period |
| POST | `/budgets` | 201; 409 if one already starts on that date |
| PUT | `/budgets/{id}` | Only for a period that has not ended (422) |
| DELETE | `/budgets/{id}` | 204 |

**A budget carries its own `currency`** (V8), optional on create and defaulting
to the caller's base. Spending recorded in other currencies is converted *into*
it at the rate on each transaction's own date; the limit itself is never
converted. That asymmetry is the point — a limit is a statement the user made in
one currency, and re-denominating it would keep the number while changing what
it means, so `PUT` refuses a currency that differs from the stored one (422).

`unconverted` counts matching transactions that had no exchange rate. They are
**missing from `spent`**, so a non-zero value means the position is understated
and the budget may be over without appearing so. This is the only way a budget
can be over while the progress bar says otherwise, and a client that ignores the
field will show a comfortable bar over incomplete data.

Before V8 the limit had no currency and `spendByCategory` summed a category
across every account raw, so a rupee expense was compared against a dollar limit
as though the two numbers were commensurable.

A budget row says "from `startsOn`, the limit for this category is this much".
The limit in force on any day is the latest row that had started by then, so
raising August's grocery budget leaves July reporting against the limit that
actually applied — budgets are period-scoped, not absolute.

Each entry carries `spent`, `remaining` (negative once over), `percentUsed`
(uncapped — "340% of your dining budget" is the fact the user needs) and
`status` of `OK` / `WARNING` (≥80%) / `EXCEEDED` (≥100%), plus the
`periodStart`/`periodEnd` it all refers to.

Income categories cannot be budgeted (422), and `startsOn` must be the first day
of a period of the given length.

### Notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications` | Newest first, capped at 50 |
| GET | `/notifications/unread-count` | `{"unread": n}` — the dot on the bell |
| POST | `/notifications/{id}/read` | |
| POST | `/notifications/read-all` | `{"marked": n}` |

Budget threshold crossings, **at most once per threshold per period**. The
evaluator runs after every transaction write, when a budget is created or
changed, and on a nightly sweep, so the same crossing is re-detected many times;
a unique index in V4 over (user, budget, period, threshold) is what makes the
second and subsequent detections write nothing. Jumping straight past both
thresholds reports being over rather than queueing a warning that was already
obsolete.

### Analytics

| Method | Path | Notes |
|---|---|---|
| GET | `/analytics/summary` | Totals, category breakdown and monthly series |
| GET | `/analytics/insights` | Rule-based observations about this month (F-07) |

Takes the **same filter as `GET /transactions`** and applies it identically, so
the summary always describes exactly the rows that endpoint would return.
Unfiltered, it describes the whole ledger.

Transfer legs are excluded from every figure here while still counting towards
account balances. Both are correct: moving your own money changes what an
account holds without being earning or spending. The web client sends only
`accountId`, from the header's account selector — the transactions page's own
filters deliberately do not redraw the dashboard.

```json
{
  "totals":  { "income": "4200.00", "expense": "1875.50", "balance": "2324.50",
               "count": 384, "highestExpense": "899.00",
               "currency": "USD", "unconverted": 0 },
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

**Currency, from Phase 6.** Every amount above is expressed in `currency` — the
profile's `baseCurrency` — and each transaction is converted at the rate
published on **its own date**, not today's. That is what stops last year's
totals moving every time this year's rate does. A single-currency ledger is
unaffected: the conversion is an identity when the two currencies match and
consults no rate at all.

`unconverted` is the one field worth handling rather than displaying. It counts
rows whose currency had no published rate on or before their date, and those
rows are **missing from the sums** — `SUM` skips nulls, so the totals look
entirely ordinary while being understated. Anything other than zero means the
figures are incomplete and the client must say so. The web client renders a
banner above the dashboard; a client that ignores this field will silently
present short totals as complete ones.

#### `GET /analytics/insights`

Plain-language observations, warnings first. Takes **no filter**: an insight is a
statement about the user's month, and one computed over whatever slice the
transactions page happens to be showing would be a statement about nothing in
particular.

```json
[
  { "kind": "MONTH_END_PROJECTION", "tone": "WARNING",
    "title": "Heading over budget this month",
    "detail": "At your current rate you will spend about USD 99 by the end of the month, USD 49 over your limits.",
    "amount": "98.89", "percent": 97.8 },
  { "kind": "CATEGORY_SHIFT", "tone": "NEUTRAL",
    "title": "New spending on Groceries",
    "detail": "You have spent USD 61 on Groceries this month, with nothing on it by this point last month.",
    "subjectId": "…", "subjectName": "Groceries", "amount": "60.61" }
]
```

**An empty array is a normal answer.** A quiet month has nothing worth saying
about it, and a panel that always found something would train the user to stop
reading it. The web client renders nothing at all rather than a placeholder.

`kind` and `tone` are enums because the client styles and links on them; matching
on the prose would break the first time a rule's wording improved. `tone` is also
the sort order — someone scanning four observations should meet the one costing
them money first. The structured fields (`subjectId`, `amount`, `percent`) carry
the numbers the sentence turns on, so the client never has to parse `detail`.

Four rules, all deliberately rule-based rather than learned: at this scale a
model would be less explainable, less testable and no more useful.

| `kind` | Says | Measured against |
|---|---|---|
| `CATEGORY_SHIFT` | A category moved sharply | The **same span** of last month — on the 9th, nine days against nine days |
| `UNUSUAL_TRANSACTION` | One expense is far above normal | The mean single expense in that category over the trailing three months |
| `MONTH_END_PROJECTION` | Where this month is heading | Straight-line extrapolation, compared to the monthly budget limits |
| `SAVINGS_RATE_TREND` | Savings rate is moving | Complete months only; the current one is excluded |

Two window choices are load-bearing and easy to get wrong. Comparing a partial
month to a whole one would report every category as collapsing until the 28th,
so the comparison window is the same number of days into each month. And a month
with no income has **no** savings rate rather than a rate of zero, so it is
skipped — counting it as zero would invent a collapse the user did not have.

### Recurring rules

| Method | Path | Notes |
|---|---|---|
| GET | `/recurring` | Soonest occurrence first; paused and finished rules included and flagged |
| GET | `/recurring/{id}` | |
| POST | `/recurring` | 201; 409 if the name is taken |
| PUT | `/recurring/{id}` | Update or pause — `paused` is a field, not an endpoint |
| DELETE | `/recurring/{id}` | 204. Generated transactions are **retained** and severed from the rule |
| POST | `/recurring/run` | Materialise the caller's due rules now; `{"created": n}` |

A rule is a template plus a schedule, and what it generates is an ordinary
transaction — editable, deletable, and severable from the rule. A one-off rent
increase is an edit to one row, not a change to the rule.

`currency` is not accepted on write: a rule takes the currency of the account it
pays into. `startsOn` may be up to two years in the past, which is how a
standing order that began months ago is recorded; the next run materialises
every occurrence since.

Occurrences are anchored on `startsOn` rather than stepped forward from the
previous one. A monthly rule beginning on the 31st fires on the 31st, the 28th
in February, and the 31st again in March. Stepping would clamp to the 28th and
stay there for ever.

`POST /recurring/run` is the nightly job's work, on demand and for one caller.
It exists so the scheduled behaviour can be seen working rather than taken on
trust, and it is safe to call repeatedly — the same idempotent path, so a second
call creates nothing.

### Goals

| Method | Path | Notes |
|---|---|---|
| GET | `/goals` | With progress and projection; dated goals first, undated after |
| GET | `/goals/{id}` | |
| POST | `/goals` | 201; 409 if the name is taken; 400 if `targetDate` is in the past |
| PUT | `/goals/{id}` | |
| DELETE | `/goals/{id}` | 204. The account and its transactions are untouched |

```json
{
  "id": "…", "name": "Emergency fund", "accountId": "…", "currency": "LKR",
  "targetAmount": "500000.00", "targetDate": "2027-12-31",
  "currentAmount": "182400.00", "remaining": "317600.00",
  "progressPercent": 36.5, "achieved": false,
  "requiredMonthly": "19850.00", "monthlyRate": "14200.00",
  "projectedCompletion": "2028-04-19", "onTrack": false,
  "contributionFrom": "2026-05-19", "contributionTo": "2026-08-19"
}
```

A goal owns no money — it is a way of reading an account, which is why
`currentAmount` is that account's balance and why deleting a goal touches
nothing else. Saving towards one is an ordinary transfer.

The two rates are different questions and both are needed. `requiredMonthly` is
arithmetic on the deadline; `monthlyRate` is what the user has actually put
aside over the trailing three months, and `projectedCompletion` is built on the
second. Three fields are three-valued rather than defaulted:

| Field | Null when |
|---|---|
| `requiredMonthly` | The goal is met, or has no `targetDate` to require anything by |
| `projectedCompletion` | The goal is met, or the observed rate never gets there |
| `onTrack` | There is no `targetDate`, so nothing to be on track for |

`onTrack: false` is a real answer and must not be collapsed into "unknown".

### Currencies

| Method | Path | Notes |
|---|---|---|
| GET | `/currencies` | Supported currencies and the day's rates, quoted against the caller's base |

`rate` is how many units of that currency one unit of `baseCurrency` buys, and
`asOf` is the date it was published — shown beside any converted figure, because
"converted" and "converted at last Tuesday's rate" are different claims and only
the second is honest.

A currency with a null `rate` is still selectable. The provider (Frankfurter,
republishing the ECB's reference rates) quotes about thirty currencies; holding
an account in one it does not quote works normally, since amounts are stored
exactly as spent, but such rows cannot be folded into a converted total and are
counted in the analytics summary's `unconverted`.

### Profile

| Method | Path | Notes |
|---|---|---|
| GET | `/profile` | Created with defaults on first call, so it never 404s |
| PUT | `/profile` | Full replacement, not a patch — send every field |

`baseCurrency` is the currency all reporting totals are expressed in. Changing
it re-expresses them at the rates that applied on each transaction's own date;
it converts what is displayed and never what is stored.

The profile is provisioned lazily rather than by a sign-up hook: Supabase owns
registration, so there is no server-side moment this application hears about a
new user. The alternative would be a trigger on `auth.users`, which is a schema
Supabase manages and upgrades.

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
