-- Local development and test provisioning only.
--
-- Creates the login credentials for the unprivileged runtime role that
-- V2__row_level_security.sql grants against. This lives outside the migrations
-- on purpose: a password committed to a migration would be identical in every
-- environment that ever ran it, including production.
--
-- The password here is a local default in the same spirit as the primeledger
-- superuser password in docker-compose.yml — it protects a throwaway container
-- on a developer's laptop and nothing else. On Supabase, run the ALTER ROLE at
-- the bottom of this file by hand with a real secret instead.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'primeledger_app') THEN
        CREATE ROLE primeledger_app LOGIN PASSWORD 'primeledger_app_dev';
    ELSE
        ALTER ROLE primeledger_app LOGIN PASSWORD 'primeledger_app_dev';
    END IF;
END
$$;

-- For reference, the production equivalent:
--   ALTER ROLE primeledger_app LOGIN PASSWORD '<from your secret store>';
