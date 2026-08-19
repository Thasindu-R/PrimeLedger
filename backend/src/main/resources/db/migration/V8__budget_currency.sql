-------------------------------------------------------------------------------
-- V8 — a budget limit is an amount, and amounts carry their currency (F-02, F-05)
--
-- The defect this closes was introduced by Phase 5 and only became visible in
-- Phase 6. `budgets.limit_amount` was the one NUMERIC in the schema without a
-- currency beside it — transactions have one, accounts have one, recurring
-- rules have one. That was harmless while every account was in the same
-- currency, because there was only one possible answer to a question nobody was
-- asking.
--
-- Multi-currency made it wrong rather than merely incomplete.
-- `spendByCategory` sums a category's expenses across every account, so a user
-- with a rupee account and a dollar account was having 50,000 (rupees) compared
-- against a limit of 500 (dollars) as though the two numbers were commensurable.
-- The progress bar reads 10,000%, the notification says they are over budget by
-- two orders of magnitude, and nothing anywhere is aware that a mistake has
-- been made. That is the worst shape a bug can have in a finance app: confident,
-- specific, and wrong.
--
-- The alternative considered was to leave the column off and treat every budget
-- as being in the profile's base currency. Rejected, and worth recording why:
-- base currency is a display preference the user may change, and changing it
-- would silently reinterpret every existing limit — "500" would stop meaning
-- five hundred dollars and start meaning five hundred rupees, with no edit, no
-- audit trail and no way to tell from the row which one had been intended.
-- Storing the currency makes the limit mean one thing for ever, which is the
-- same reason `transactions.currency` exists.
-------------------------------------------------------------------------------

ALTER TABLE budgets ADD COLUMN currency CHAR(3);

-- Backfilled from the owner's profile, because that is what the limit must have
-- meant when it was typed: before this migration every figure the user saw was
-- unconverted, so they entered a number in whatever currency they think in, and
-- the profile is the only record of what that was.
--
-- COALESCE for users who have no profile row yet — it is created lazily on
-- first read, so a user who set a budget through the API without ever loading
-- the app has none. 'USD' is not an arbitrary pick: it is exactly the default
-- ProfileService would give them on that first read, so the backfill agrees
-- with what they are about to be shown rather than contradicting it.
UPDATE budgets b
   SET currency = COALESCE(
       (SELECT p.base_currency FROM profiles p WHERE p.id = b.user_id),
       'USD');

ALTER TABLE budgets ALTER COLUMN currency SET NOT NULL;

COMMENT ON COLUMN budgets.currency IS
    'The currency limit_amount is denominated in. Fixed at creation and never '
    'rewritten: spending is converted into it for comparison, rather than the '
    'limit being converted into anything. Changing the profile base currency '
    'must not change what an existing limit means.';

-- Two budgets for the same category and period starting on the same day are
-- already refused. That constraint is unchanged and deliberately does not gain
-- `currency`: a category has one limit at a time, and letting a user hold a
-- 500 USD limit and a 50,000 LKR limit on Groceries for August would be two
-- answers to one question, with nothing to say which the progress bar means.
