-------------------------------------------------------------------------------
-- V7 — Phase 6: recurrence, goals and currency (F-03, F-04, F-05)
--
-- V1 created recurring_rules, savings_goals and fx_rates because transactions
-- carries a foreign key to the first of them and the data model named all
-- three. It deliberately stopped short of the columns each feature needs, on
-- the grounds that guessing them a phase early is how a schema acquires columns
-- nothing reads. This migration fills them in.
-------------------------------------------------------------------------------


-------------------------------------------------------------------------------
-- 1. recurring_rules gains the transaction template (F-03)
-------------------------------------------------------------------------------
-- A rule is a template plus a schedule. V1 shipped the schedule half
-- (frequency, interval, next_run_on, ends_on); what it could not describe is
-- *what* to create when a rule comes due, which is the half added here.
--
-- The new columns are NOT NULL without a default, which is only safe on an
-- empty table. This one is necessarily empty: no entity, repository, endpoint
-- or seeder has ever written to recurring_rules — Phase 6 is the first code
-- that can create a rule. If this migration fails on a NOT NULL violation, the
-- assumption has been broken and the right response is to look at what wrote
-- those rows, not to relax the constraint.
ALTER TABLE recurring_rules
    ADD COLUMN name        TEXT          NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    ADD COLUMN account_id  UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    ADD COLUMN category_id UUID          NOT NULL REFERENCES categories(id),
    ADD COLUMN type        TEXT          NOT NULL CHECK (type IN ('income', 'expense')),
    ADD COLUMN amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    ADD COLUMN currency    CHAR(3)       NOT NULL,
    ADD COLUMN description TEXT          CHECK (char_length(description) <= 500),
    ADD COLUMN starts_on   DATE          NOT NULL,
    ADD COLUMN is_paused   BOOLEAN       NOT NULL DEFAULT false,
    ADD COLUMN last_run_on DATE;

-- ON DELETE CASCADE on account_id, where transactions.account_id is RESTRICT.
-- The asymmetry is deliberate: a transaction is a record of something that
-- happened and deleting its account must not erase history, whereas a rule is
-- an instruction about the future and an instruction to pay into an account
-- that no longer exists is not worth keeping. Transactions the rule already
-- generated are untouched — they carry their own account_id.

-- next_run_on is where the schedule has got to; starts_on is where it began and
-- never moves. Keeping both is what lets the UI say "every month since March"
-- after the ninth run, and what makes a rule's history legible after a pause.
COMMENT ON COLUMN recurring_rules.starts_on IS
    'First occurrence. Fixed at creation; next_run_on advances, this does not.';
COMMENT ON COLUMN recurring_rules.last_run_on IS
    'Occurrence date of the most recent transaction this rule generated. '
    'Null until the materialiser has run for it once.';

-- V1's check compared ends_on against next_run_on, which was the only start
-- date it had. Now that starts_on exists, the constraint belongs against it:
-- the old form failed the moment next_run_on advanced past a valid end date.
ALTER TABLE recurring_rules DROP CONSTRAINT recurring_ends_after_start;
ALTER TABLE recurring_rules
    ADD CONSTRAINT recurring_ends_after_start CHECK (ends_on IS NULL OR ends_on >= starts_on);

-- The materialiser asks one question — "which rules are due?" — and asks it of
-- every user's rules at once. Paused rules are excluded from the index rather
-- than filtered after it, because a paused rule is never due and there is no
-- reason to keep it in the structure the nightly job scans.
DROP INDEX IF EXISTS idx_recurring_due;
CREATE INDEX idx_recurring_due ON recurring_rules (next_run_on)
    WHERE is_paused = false;

CREATE INDEX idx_recurring_user ON recurring_rules (user_id);


-------------------------------------------------------------------------------
-- 2. Idempotency for the materialiser (F-03)
-------------------------------------------------------------------------------
-- "The job is idempotent: a missed night catches up on the next run without
-- producing duplicates, which matters because free-tier containers do
-- occasionally restart."
--
-- The job advances next_run_on in the same transaction that writes the
-- transaction, so an interrupted run rolls back both and retries cleanly. That
-- is the mechanism. This index is the guarantee — the thing that holds when the
-- mechanism is wrong, when two containers run the job at the same moment, or
-- when a future change to the service forgets the ordering.
--
-- Deleted rows are *not* excluded. A user who deletes a generated instance has
-- said they do not want it; regenerating it on the next catch-up run would be
-- the application arguing with them. Severing an instance from its rule (which
-- sets recurring_rule_id to null) is the supported way to free the slot.
CREATE UNIQUE INDEX idx_txn_rule_occurrence
    ON transactions (recurring_rule_id, occurred_on)
    WHERE recurring_rule_id IS NOT NULL;


-------------------------------------------------------------------------------
-- 3. Enumerating work for the nightly jobs (F-03)
-------------------------------------------------------------------------------
-- The same problem V6 solved for the budget sweep, with the same solution and
-- for the same reason: a scheduled job has no request and therefore no
-- identity, so FORCE ROW LEVEL SECURITY shows it nothing. It cannot find out
-- which users have work waiting without help.
--
-- See V6 for the full argument. The two hardening details carry over unchanged:
-- search_path is pinned so the function cannot be pointed at a caller-supplied
-- table, and EXECUTE is revoked from PUBLIC before being granted to the one
-- role that needs it.
--
-- What this returns is narrower than it looks: user ids, and only for users who
-- have a rule that is due. No amounts, no descriptions, no schedule — nothing
-- that is not already a foreign key. Having learned an id the job must still
-- RunAs that user, and is still subject to every policy while it does the work.
CREATE OR REPLACE FUNCTION app_users_with_due_rules(as_of DATE)
    RETURNS SETOF UUID
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
    SELECT DISTINCT user_id
      FROM recurring_rules
     WHERE is_paused = false
       AND next_run_on <= as_of
       AND (ends_on IS NULL OR next_run_on <= ends_on);
$$;

REVOKE ALL ON FUNCTION app_users_with_due_rules(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_users_with_due_rules(DATE) TO primeledger_app;

COMMENT ON FUNCTION app_users_with_due_rules(DATE) IS
    'Ids of users owning at least one recurring rule due on or before as_of, '
    'for the nightly materialiser. SECURITY DEFINER so a job with no request '
    'identity can enumerate work; returns identifiers only, never rule data.';


-------------------------------------------------------------------------------
-- 4. Savings goals: what the projection needs (F-04)
-------------------------------------------------------------------------------
-- V1 already gave savings_goals every column a goal has. This migration adds no
-- more, and the absence is the design: progress, the required monthly
-- contribution, the observed contribution rate and the projected completion
-- date are all derived from transactions at read time. Persisting any of them
-- would mean a column that is correct on the day it is written and wrong every
-- day after, with nothing to say which day that was.
--
-- Goals are addressed by name in every sentence the UI writes about them
-- ("Emergency fund is on track"), so two goals called the same thing make the
-- interface ambiguous rather than merely untidy.
ALTER TABLE savings_goals
    ADD CONSTRAINT goals_name_unique_per_user UNIQUE (user_id, name);


-------------------------------------------------------------------------------
-- 5. FX rates: bookkeeping for the daily fetch (F-05)
-------------------------------------------------------------------------------
-- The table itself is V1 and unchanged: PRIMARY KEY (base, quote, rate_date),
-- no user_id, no RLS. Rates are public reference data (§7.4).
--
-- Conversion is always "the rate on or before this transaction's own date", so
-- the query is a descending scan bounded by a date. The primary key already
-- orders by (base, quote, rate_date) and serves that exactly; what it does not
-- serve is the daily job's own question, "what is the newest date I hold?",
-- which has no base or quote to anchor on.
CREATE INDEX idx_fx_rates_date ON fx_rates (rate_date DESC);

-- Frankfurter (and every other free provider) quotes against a single base per
-- response, and storing one base is what keeps a triangulated conversion
-- consistent: EUR->LKR divided by EUR->USD is one number however it is asked
-- for, whereas separately fetched USD->LKR and LKR->USD pairs drift apart by
-- the provider's own rounding and stop round-tripping.
COMMENT ON TABLE fx_rates IS
    'Daily reference rates, one base per row-set (EUR, as published). '
    'Cross rates are triangulated through the base rather than stored, so '
    'A->B and B->A cannot disagree. Public: no owner, no RLS (§7.4).';


-------------------------------------------------------------------------------
-- 6. Converting at the transaction's own date (F-05)
-------------------------------------------------------------------------------
-- "Historical transactions convert at the rate on their own date, not today's,
-- so last year's totals do not silently shift when the rupee moves."
--
-- That requirement is the reason this is a database function rather than a loop
-- in Java. The reporting totals are grouped aggregates — income by month,
-- spending by category — and once rows are grouped, their individual dates are
-- gone. Converting after the group is converting at some single date chosen for
-- a set of transactions that do not share one, which is precisely the error the
-- requirement names. Converting inside the aggregate is the only place the
-- correct rate is still known, and that means the conversion has to be an
-- expression the database can evaluate per row.
--
-- The rate used is the most recent one published on or before the date. Rates
-- are not published at weekends or on holidays, so "the rate on 26 December" is
-- necessarily the rate from a few days earlier — asking for an exact-date match
-- would leave a fifth of the year unconvertible.
--
-- NULL, not a fallback, when there is no rate at all. A silent substitution
-- here would produce a total that is wrong by a factor of a few hundred and
-- looks entirely ordinary; callers are expected to count the NULLs and say so.
-- See AnalyticsRepository, which does exactly that.
--
-- Not SECURITY DEFINER: fx_rates is public reference data that the runtime role
-- can already read. It needs no privilege it does not have.
CREATE OR REPLACE FUNCTION fx_convert(
        amount   NUMERIC,
        from_ccy TEXT,
        to_ccy   TEXT,
        on_date  DATE)
    RETURNS NUMERIC
    LANGUAGE sql
    STABLE
    PARALLEL SAFE
    SET search_path = public, pg_catalog
AS $$
    SELECT CASE
        WHEN amount IS NULL OR from_ccy IS NULL OR to_ccy IS NULL THEN NULL
        WHEN from_ccy = to_ccy THEN amount
        ELSE amount
             * (SELECT r.rate FROM fx_rates r
                 WHERE r.quote = to_ccy AND r.rate_date <= on_date
                 ORDER BY r.rate_date DESC LIMIT 1)
             / (SELECT r.rate FROM fx_rates r
                 WHERE r.quote = from_ccy AND r.rate_date <= on_date
                 ORDER BY r.rate_date DESC LIMIT 1)
    END;
$$;

COMMENT ON FUNCTION fx_convert(NUMERIC, TEXT, TEXT, DATE) IS
    'Converts an amount between currencies at the rate published on or before '
    'on_date, triangulated through the stored base. NULL when either currency '
    'has no rate on or before that date — callers must not treat that as zero.';

-- The lookup fx_convert performs, once per row of an aggregate: newest rate for
-- one quote currency not later than a date.
CREATE INDEX idx_fx_rates_quote_date ON fx_rates (quote, rate_date DESC);
