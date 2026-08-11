-- V2 — Row-level security (proposal §7.4, NFR-06)
--
-- RLS is the load-bearing control, not a supplement to one. Every user-owned
-- table gets the same treatment: a policy comparing the row's owner against
-- app.user_id, which the backend sets from the validated JWT's `sub` claim at
-- the start of every transaction.
--
-- The consequence is worth stating plainly: if a developer forgets a
-- `WHERE user_id = ?` clause, the query returns nothing rather than everything.
-- The failure mode of a mistake is an empty result, not a data breach.
--
-- Two things this migration does that the proposal's snippet leaves implicit,
-- both of which decide whether any of it actually binds:
--
--   1. FORCE ROW LEVEL SECURITY. Plain ENABLE exempts the table's *owner*, and
--      the owner is exactly who the application would connect as by default.
--      Without FORCE, every policy below is decorative.
--
--   2. A dedicated, unprivileged runtime role. A superuser ignores RLS even
--      with FORCE, so migrations and runtime cannot share a role. Flyway keeps
--      the privileged one; the connection pool gets primeledger_app.
--
-- fx_rates is deliberately excluded — exchange rates are public reference data
-- shared across all users, with no owner and therefore no policy.

-------------------------------------------------------------------------------
-- The runtime role
-------------------------------------------------------------------------------
-- Created with PostgreSQL's defaults, which are already NOSUPERUSER and
-- NOBYPASSRLS. We deliberately do not ALTER those attributes: doing so requires
-- superuser, which Supabase's `postgres` role does not have, and the defaults
-- are what we want anyway. RlsGuard verifies the outcome at start-up rather
-- than trusting it.
--
-- Note what this does NOT do: give the role a password, or the ability to log
-- in. Credentials do not belong in a migration — this file is in version
-- control, runs identically in every environment, and would hand every
-- deployment the same publicly known password. The role is created here so the
-- grants and policies below have a subject; the ability to authenticate as it
-- is provisioned per environment:
--
--   local     docker/postgres-init/00-create-app-role.sql (compose mounts it)
--   tests     the same script, run by Testcontainers via withInitScript
--   Supabase  once, by hand:
--             ALTER ROLE primeledger_app LOGIN PASSWORD '<from your secret store>';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'primeledger_app') THEN
        CREATE ROLE primeledger_app NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO primeledger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO primeledger_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO primeledger_app;

-- Flyway's own bookkeeping is not the application's business.
REVOKE ALL ON flyway_schema_history FROM primeledger_app;

-- The local stand-in for Supabase GoTrue (V1). On Supabase the auth schema
-- belongs to the platform and these grants are neither possible nor needed, so
-- a privilege failure here is expected and ignored.
DO $$
BEGIN
    GRANT USAGE ON SCHEMA auth TO primeledger_app;
    GRANT SELECT, INSERT, DELETE ON auth.users TO primeledger_app;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'auth schema is platform-managed; skipping grants (%)', SQLERRM;
END
$$;

-------------------------------------------------------------------------------
-- The identity function
-------------------------------------------------------------------------------
-- current_setting(..., true) returns NULL when the GUC was never set, but a
-- plain '' (which is what an unauthenticated connection sets it to) would raise
-- on the ::uuid cast and turn a missing identity into a 500 instead of an empty
-- result. NULLIF collapses both cases to NULL, and `user_id = NULL` is NULL —
-- never true — so a request with no identity sees nothing.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS UUID
    LANGUAGE sql
    STABLE
    -- Pinned search_path: this function is referenced by every policy, so a
    -- caller-controlled search_path must not be able to influence it.
    SET search_path = pg_catalog
AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

GRANT EXECUTE ON FUNCTION app_current_user_id() TO primeledger_app;

-------------------------------------------------------------------------------
-- Policies: the plain case
-------------------------------------------------------------------------------
-- profiles keys ownership off its primary key; every other table uses user_id.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY profiles_owner ON profiles
    FOR ALL
    USING      (id = app_current_user_id())
    WITH CHECK (id = app_current_user_id());

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY accounts_owner ON accounts
    FOR ALL
    USING      (user_id = app_current_user_id())
    WITH CHECK (user_id = app_current_user_id());

ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY recurring_rules_owner ON recurring_rules
    FOR ALL
    USING      (user_id = app_current_user_id())
    WITH CHECK (user_id = app_current_user_id());

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY transactions_owner ON transactions
    FOR ALL
    USING      (user_id = app_current_user_id())
    WITH CHECK (user_id = app_current_user_id());

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets FORCE ROW LEVEL SECURITY;
CREATE POLICY budgets_owner ON budgets
    FOR ALL
    USING      (user_id = app_current_user_id())
    WITH CHECK (user_id = app_current_user_id());

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals FORCE ROW LEVEL SECURITY;
CREATE POLICY savings_goals_owner ON savings_goals
    FOR ALL
    USING      (user_id = app_current_user_id())
    WITH CHECK (user_id = app_current_user_id());

-------------------------------------------------------------------------------
-- Policies: categories, which are not a plain case
-------------------------------------------------------------------------------
-- Categories come in two kinds and need two rules. System categories (user_id
-- IS NULL, seeded in V3) are shared reference data: readable by everyone,
-- writable by no one. A single FOR ALL policy cannot express that, because the
-- read rule and the write rule differ — so they are split.
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;

CREATE POLICY categories_read ON categories
    FOR SELECT
    USING (user_id = app_current_user_id() OR user_id IS NULL);

-- No user_id IS NULL escape hatch here: a client cannot mint a system category,
-- and cannot edit or delete one either. The service layer returns 422 for that
-- attempt; this is the backstop if it ever stops doing so.
CREATE POLICY categories_write ON categories
    FOR INSERT
    WITH CHECK (user_id = app_current_user_id());

CREATE POLICY categories_modify ON categories
    FOR UPDATE
    USING      (user_id = app_current_user_id())
    WITH CHECK (user_id = app_current_user_id());

CREATE POLICY categories_remove ON categories
    FOR DELETE
    USING (user_id = app_current_user_id());

-------------------------------------------------------------------------------
-- fx_rates — public reference data, no owner, no policy
-------------------------------------------------------------------------------
-- No ENABLE ROW LEVEL SECURITY and no policy: rates belong to nobody, so there
-- is no owner column to compare against. The blanket grant above already covers
-- it, including the writes the Phase 6 refresh job will need.
