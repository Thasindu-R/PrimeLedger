-------------------------------------------------------------------------------
-- V4 — notifications (F-02, Phase 5)
--
-- The bell in TopNavBar has always existed and has only ever listed recent
-- transactions. This is what makes it carry something worth being notified
-- about: a budget crossing 80% or 100% of its limit.
--
-- The interesting column is not any of the text ones, it is the unique index at
-- the bottom. A budget is re-evaluated after every write that touches its
-- category and again on a nightly sweep, so the same threshold is re-detected
-- many times over a period. Emitting on each detection would put twenty
-- identical "Food is over budget" rows in the bell in one afternoon. The
-- proposal asks for once per threshold per period (§10, F-02), and the honest
-- way to guarantee that is a constraint the database enforces rather than a
-- check the application remembers to perform.
-------------------------------------------------------------------------------

CREATE TABLE notifications (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    kind         TEXT        NOT NULL CHECK (kind IN ('budget_threshold')),
    title        TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
    body         TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),

    -- The subject of a budget_threshold notification. Nullable because later
    -- phases add kinds that are about something else (F-07 insights), and a
    -- column that is mandatory for one kind and meaningless for another is
    -- better nullable than duplicated into a second table.
    budget_id    UUID        REFERENCES budgets(id) ON DELETE CASCADE,
    -- The first day of the budget period this refers to. Part of the identity
    -- of the event: crossing 80% in August is a different fact from crossing
    -- 80% in September, and the user should hear about both.
    period_start DATE,
    threshold    SMALLINT    CHECK (threshold IN (80, 100)),

    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Either all three identity columns are present or none are. Without this a
    -- half-populated row would slip past the unique index below, because NULLs
    -- do not collide, and the idempotency guarantee would quietly not hold.
    CONSTRAINT notifications_budget_identity_complete CHECK (
        (budget_id IS NULL AND period_start IS NULL AND threshold IS NULL)
        OR (budget_id IS NOT NULL AND period_start IS NOT NULL AND threshold IS NOT NULL)
    )
);

-- The bell reads "mine, newest first", and unread count is the badge.
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (user_id)
WHERE read_at IS NULL;

-- Idempotency, enforced here rather than trusted to the evaluator.
CREATE UNIQUE INDEX notifications_once_per_threshold
    ON notifications (user_id, budget_id, period_start, threshold)
    WHERE budget_id IS NOT NULL;

-------------------------------------------------------------------------------
-- Row-level security, on the same terms as every other user-owned table (V2).
-------------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_owner ON notifications
    FOR ALL
    USING      (user_id = app_current_user_id())
    WITH CHECK (user_id = app_current_user_id());
