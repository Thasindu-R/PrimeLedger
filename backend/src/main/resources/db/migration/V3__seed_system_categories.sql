-- V3 — System categories (proposal §7.3, closes D-01 at the data layer)
--
-- These are the categories every user starts with: owned by nobody
-- (user_id IS NULL), visible to all, editable by none. Making them rows rather
-- than a TypeScript union is what stops the form and the type drifting apart,
-- which is precisely how "Investment" went missing from the category list in
-- the audited frontend.
--
-- Note the interaction with V2: categories now has FORCE ROW LEVEL SECURITY, and
-- the write policy requires user_id = app_current_user_id(). A row with a NULL
-- owner satisfies no such check, so this INSERT would be rejected — including
-- for the migration role, which is the whole point of FORCE. The policy is
-- therefore lifted for the length of this one statement and restored
-- immediately. Doing it explicitly keeps the migration deterministic regardless
-- of whether the connecting role happens to be a superuser (which would bypass
-- RLS anyway, locally) or a plain owner (which would not, on Supabase).

ALTER TABLE categories NO FORCE ROW LEVEL SECURITY;

INSERT INTO categories (user_id, name, kind, colour, is_system, sort_order) VALUES
    (NULL, 'Salary',        'income',  '#16A34A', true, 0),
    (NULL, 'Freelance',     'income',  '#22C55E', true, 1),
    (NULL, 'Investment',    'income',  '#0EA5E9', true, 2),
    (NULL, 'Gifts',         'income',  '#14B8A6', true, 3),
    (NULL, 'Groceries',     'expense', '#F97316', true, 0),
    (NULL, 'Rent',          'expense', '#EF4444', true, 1),
    (NULL, 'Transport',     'expense', '#8B5CF6', true, 2),
    (NULL, 'Utilities',     'expense', '#EAB308', true, 3),
    (NULL, 'Entertainment', 'expense', '#EC4899', true, 4),
    (NULL, 'Healthcare',    'expense', '#06B6D4', true, 5),
    (NULL, 'Dining',        'expense', '#F43F5E', true, 6),
    (NULL, 'Other',         'expense', '#64748B', true, 7)
ON CONFLICT DO NOTHING;

ALTER TABLE categories FORCE ROW LEVEL SECURITY;
