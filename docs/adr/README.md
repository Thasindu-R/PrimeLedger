# Architecture Decision Records

One file per significant decision, numbered in the order taken. An ADR records
*why* a choice was made and what it cost, so a later reader can tell a
deliberate trade-off from an accident.

Naming: `NNNN-short-kebab-title.md`.

## Planned

Proposal §12 (Phase 9) calls for ADRs covering four choices. They are listed
here now so the reasoning gets captured while it is still fresh, rather than
reconstructed at the end.

| # | Decision | Recorded in proposal |
|---|----------|----------------------|
| 0001 | Hosting split — SPA on Vercel, API on Railway | §5, §8 |
| 0002 | Delegated authentication via Supabase Auth rather than a hand-rolled implementation | §9.1 |
| 0003 | Row-level security as the authorisation boundary | §9.2 |
| 0004 | REST over GraphQL | §6 |

## Template

```markdown
# NNNN. Title

**Status:** proposed | accepted | superseded by [NNNN](NNNN-....md)
**Date:** YYYY-MM-DD

## Context

The forces at play. What makes this a decision rather than an obvious call.

## Decision

What was chosen, stated plainly.

## Consequences

What this makes easy, what it makes hard, and what it rules out. Include the
costs — an ADR that only lists benefits is marketing.
```
