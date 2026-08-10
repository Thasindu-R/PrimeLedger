-- V1 — initial schema (proposal §7).
--
-- Written before any Java, because the schema is the contract everything else
-- derives from (§A.5). Money is NUMERIC(15,2) everywhere and never a float.
--
-- Row-level security is deliberately NOT in this migration. It arrives in
-- V2__row_level_security.sql in Phase 3, together with the JWT converter that
-- sets app.user_id — a policy with nothing to populate the setting would lock
-- the local development database out of its own data.

-------------------------------------------------------------------------------
-- Ownership root
-------------------------------------------------------------------------------
-- Every user-owned table points at auth.users, which on Supabase is created and
-- managed by GoTrue. Against a plain local PostgreSQL (docker compose up -d db)
-- that schema does not exist, so this block stands in a minimal equivalent. On
-- Supabase the table is already there and the block is a no-op — it never
-- touches a real auth.users.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE auth.users (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            email      TEXT        UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        COMMENT ON TABLE auth.users IS
            'Local stand-in for the Supabase GoTrue user table. Never created on Supabase.';
    END IF;
END $$;

-------------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest even for updates that bypass JPA
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-------------------------------------------------------------------------------
-- profiles
-------------------------------------------------------------------------------
CREATE TABLE profiles (
    id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name  TEXT        NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
    avatar_url    TEXT,
    base_currency CHAR(3)     NOT NULL DEFAULT 'USD',
    locale        TEXT        NOT NULL DEFAULT 'en-US',
    theme         TEXT        NOT NULL DEFAULT 'system'
                              CHECK (theme IN ('light', 'dark', 'system')),
    date_format   TEXT        NOT NULL DEFAULT 'yyyy-MM-dd',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-------------------------------------------------------------------------------
-- accounts
-------------------------------------------------------------------------------
CREATE TABLE accounts (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT          NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    type            TEXT          NOT NULL
                                  CHECK (type IN ('checking', 'savings', 'cash', 'credit_card', 'investment')),
    currency        CHAR(3)       NOT NULL,
    opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    colour          TEXT          CHECK (colour ~ '^#[0-9A-Fa-f]{6}$'),
    is_archived     BOOLEAN       NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT accounts_name_unique_per_user UNIQUE (user_id, name)
);

CREATE INDEX idx_accounts_user ON accounts (user_id) WHERE is_archived = false;

CREATE TRIGGER accounts_set_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-------------------------------------------------------------------------------
-- categories
-------------------------------------------------------------------------------
-- user_id is nullable: a NULL owner marks a system category, seeded in V3 and
-- visible to everyone. This is what closes D-01 — the compile-time TypeScript
-- union becomes a row, so the form and the type can no longer drift (§7.3).
CREATE TABLE categories (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    kind       TEXT        NOT NULL CHECK (kind IN ('income', 'expense')),
    icon       TEXT,
    colour     TEXT        CHECK (colour ~ '^#[0-9A-Fa-f]{6}$'),
    is_system  BOOLEAN     NOT NULL DEFAULT false,
    sort_order INTEGER     NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A system category is owned by nobody; a user category must have an owner.
    CONSTRAINT categories_system_has_no_owner
        CHECK ((is_system AND user_id IS NULL) OR (NOT is_system AND user_id IS NOT NULL))
);

-- Two partial indexes rather than one constraint: NULLs are distinct in a
-- UNIQUE constraint, so system categories would otherwise not be deduplicated.
CREATE UNIQUE INDEX idx_categories_user_name
    ON categories (user_id, kind, lower(name)) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_categories_system_name
    ON categories (kind, lower(name)) WHERE user_id IS NULL;

CREATE TRIGGER categories_set_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-------------------------------------------------------------------------------
-- recurring_rules  (F-03, materialised in Phase 6)
-------------------------------------------------------------------------------
-- Created here because transactions carries an FK to it. The columns are those
-- named in §7.1; the transaction template the materialiser needs is added by
-- the Phase 6 migration rather than guessed at now.
CREATE TABLE recurring_rules (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    frequency    TEXT        NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval     INTEGER     NOT NULL DEFAULT 1 CHECK (interval > 0),
    next_run_on  DATE        NOT NULL,
    ends_on      DATE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recurring_ends_after_start CHECK (ends_on IS NULL OR ends_on >= next_run_on)
);

CREATE INDEX idx_recurring_due ON recurring_rules (next_run_on);

CREATE TRIGGER recurring_rules_set_updated_at
    BEFORE UPDATE ON recurring_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-------------------------------------------------------------------------------
-- transactions  (§7.2, verbatim)
-------------------------------------------------------------------------------
CREATE TABLE transactions (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id        UUID          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    category_id       UUID          NOT NULL REFERENCES categories(id),
    recurring_rule_id UUID          REFERENCES recurring_rules(id) ON DELETE SET NULL,
    type              TEXT          NOT NULL CHECK (type IN ('income','expense')),
    amount            NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency          CHAR(3)       NOT NULL,
    occurred_on       DATE          NOT NULL CHECK (occurred_on <= CURRENT_DATE + 1),
    description       TEXT          CHECK (char_length(description) <= 500),
    is_transfer       BOOLEAN       NOT NULL DEFAULT false,
    transfer_pair_id  UUID          REFERENCES transactions(id) ON DELETE SET NULL,
    deleted_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Access is almost always "this user, this date window, newest first"
CREATE INDEX idx_txn_user_date ON transactions (user_id, occurred_on DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_txn_user_cat  ON transactions (user_id, category_id);
CREATE INDEX idx_txn_search    ON transactions
USING GIN (to_tsvector('english', coalesce(description,'')));

CREATE TRIGGER transactions_set_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-------------------------------------------------------------------------------
-- budgets  (F-02, Phase 5)
-------------------------------------------------------------------------------
CREATE TABLE budgets (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id  UUID          NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    period       TEXT          NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
    limit_amount NUMERIC(15,2) NOT NULL CHECK (limit_amount > 0),
    starts_on    DATE          NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT budgets_one_per_category_period UNIQUE (user_id, category_id, period, starts_on)
);

CREATE INDEX idx_budgets_user ON budgets (user_id);

CREATE TRIGGER budgets_set_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-------------------------------------------------------------------------------
-- savings_goals  (F-04, Phase 6)
-------------------------------------------------------------------------------
CREATE TABLE savings_goals (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id    UUID          NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    name          TEXT          NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    target_amount NUMERIC(15,2) NOT NULL CHECK (target_amount > 0),
    target_date   DATE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_user ON savings_goals (user_id);

CREATE TRIGGER savings_goals_set_updated_at
    BEFORE UPDATE ON savings_goals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-------------------------------------------------------------------------------
-- fx_rates  (F-05, Phase 6)
-------------------------------------------------------------------------------
-- Public reference data: shared by every user, owned by none. It is the one
-- table deliberately excluded from row-level security (§7.4).
CREATE TABLE fx_rates (
    base       CHAR(3)        NOT NULL,
    quote      CHAR(3)        NOT NULL,
    rate_date  DATE           NOT NULL,
    rate       NUMERIC(18,8)  NOT NULL CHECK (rate > 0),
    created_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
    PRIMARY KEY (base, quote, rate_date)
);
