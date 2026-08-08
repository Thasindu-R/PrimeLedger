# Architecture

> **Status: stub.** The authoritative architecture document is currently
> `PrimeLedger_Project_Proposal.pdf` (§5 system architecture, §6 backend design,
> §7 data model, §9 security). This file replaces it as the living reference and
> is written properly in Phase 9, once the system it describes actually exists.
>
> Drop the proposal PDF into this directory — proposal §13.4 puts it here.

## Shape

Three deployment targets, split by what each host can actually run:

| Concern | Where | Why |
|---------|-------|-----|
| React SPA | Vercel | static build, edge CDN |
| REST API | Railway (Docker) | **Vercel has no JVM runtime** — this is the reason for the split, not a preference |
| PostgreSQL 16, Auth, Storage | Supabase | managed Postgres with row-level security and GoTrue |

The browser talks to Supabase Auth directly for sign-in and holds an RS256 JWT.
Every API call carries that token; the backend verifies it against Supabase's
JWKS endpoint (cached) and sets a per-connection PostgreSQL session variable so
row-level security scopes every query to the calling user.

That last point is the load-bearing one: **authorisation is enforced in the
database, not only in Java.** A missing `WHERE user_id = ?` is a bug, not a
breach.

## Invariants

These hold across every phase. Breaking one is a defect regardless of what else
the change achieves.

- **Money is never a float.** `NUMERIC(15,2)` in Postgres, `BigDecimal` in Java,
  a decimal string on the wire.
- **The service-role key is backend-only.** It bypasses every RLS policy; if it
  reaches a client bundle, RLS is void for all users (§9.4).
- **Applied migrations are immutable.** Change means a new version, never an
  edit.
- **Dates are calendar dates**, not instants. `toISOString()` yields the UTC day
  and is off by one for much of the day in `Asia/Colombo`.

## Decisions

Architecture Decision Records live in [`adr/`](adr/).
