-------------------------------------------------------------------------------
-- V5 — transfers (F-01, Phase 5)
--
-- A transfer is stored as a linked pair of ordinary transactions: an expense on
-- the source account and an income on the destination, both flagged
-- is_transfer, each pointing at the other through transfer_pair_id. The columns
-- for that have existed since V1. What was missing is the category.
--
-- Every transaction so far has had to have one, because category_id was NOT
-- NULL. A transfer has no honest category: moving your own money from a current
-- account to savings is not Groceries, not Salary, and not "Other" either. The
-- alternatives were both worse than this migration:
--
--   * Seed a system "Transfer" category. It would then appear in the add-
--     transaction picker, invite users to file real spending under it, show up
--     as a slice in the category breakdown, and be selectable as a budget — four
--     new wrong states to defend against, to model something that is really the
--     absence of a category.
--
--   * Reuse "Other". That silently mixes transfers into a real spending
--     category, which is the exact confusion F-01 exists to remove.
--
-- So category_id becomes nullable, and a check constraint ties it to the flag:
-- a transfer has no category, and anything that is not a transfer must have
-- one. The rule is enforced by the database rather than remembered by the
-- service, because "which rows may have a null category" is precisely the kind
-- of invariant that decays once a second write path appears.
-------------------------------------------------------------------------------

ALTER TABLE transactions ALTER COLUMN category_id DROP NOT NULL;

ALTER TABLE transactions
    ADD CONSTRAINT transactions_category_unless_transfer CHECK (
        (is_transfer AND category_id IS NULL)
        OR (NOT is_transfer AND category_id IS NOT NULL)
    );

-- A transfer leg must name the account it moves money to or from, and that must
-- not be the account it already sits on. Guarded here because a self-transfer is
-- a no-op that still writes two rows and two notifications' worth of noise.
ALTER TABLE transactions
    ADD CONSTRAINT transactions_transfer_pair_is_not_self CHECK (
        transfer_pair_id IS NULL OR transfer_pair_id <> id
    );

-- The pair lookup: deleting one leg has to find the other, and it happens on
-- every transfer delete.
CREATE INDEX idx_txn_transfer_pair ON transactions (transfer_pair_id)
WHERE transfer_pair_id IS NOT NULL;

-- Reporting reads "this user's real income and expense", which now means
-- "excluding transfer legs" — the exclusion F-01 calls the part that separates
-- a real ledger from a spreadsheet.
CREATE INDEX idx_txn_user_reporting ON transactions (user_id, occurred_on)
WHERE deleted_at IS NULL AND is_transfer = false;
