-------------------------------------------------------------------------------
-- V6 — support for the nightly budget sweep (F-02, Phase 5)
--
-- F-02 asks for the budget evaluator to run "after each write and on a nightly
-- sweep". The after-each-write path is easy: the request already knows whose
-- data it is. The sweep is not, and the reason is the security model working as
-- designed.
--
-- The API connects as primeledger_app, which is subject to FORCE ROW LEVEL
-- SECURITY on every user-owned table. A background job has no request and
-- therefore no identity, so it sees nothing at all — deliberately. RunAs lets a
-- job name one user and act as them, which is exactly right for doing the work,
-- but it cannot answer the prior question: *which* users are there to sweep?
--
-- Granting BYPASSRLS to the runtime role would answer it and would also undo
-- every policy in V2 — the guard in RlsGuard exists to stop precisely that.
--
-- So this is the narrow alternative: one SECURITY DEFINER function that
-- executes with the privileges of its owner (the migration role) and returns
-- one column of one type — the ids of users who own at least one budget. It
-- exposes no amounts, no categories, no names, nothing that is not already a
-- foreign key. Having learned an id, the job still has to RunAs that user and
-- is still subject to every policy while it does the work.
--
-- The two hardening details matter as much as the function body:
--
--   * search_path is pinned. A SECURITY DEFINER function without it can be
--     hijacked by a caller who puts their own `budgets` table earlier on their
--     own search_path, and the function would happily read it as the owner.
--   * EXECUTE is revoked from PUBLIC before being granted to the one role that
--     needs it. CREATE FUNCTION grants EXECUTE to PUBLIC by default.
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_users_with_budgets()
    RETURNS SETOF UUID
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
    SELECT DISTINCT user_id FROM budgets;
$$;

REVOKE ALL ON FUNCTION app_users_with_budgets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_users_with_budgets() TO primeledger_app;

COMMENT ON FUNCTION app_users_with_budgets() IS
    'Ids of users owning at least one budget, for the nightly evaluator. '
    'SECURITY DEFINER so a job with no request identity can enumerate work; '
    'returns identifiers only, never budget data.';
