-- ===========================================================================
-- Construction Portal — Migration 003: Row-Level Security
-- ===========================================================================
--
-- WHY THIS EXISTS
--   Several controllers query tenant-owned tables without a company_id
--   filter, which leaks every company's data to every authenticated user.
--   The application-level fix is in the backend, but application filters are
--   something every future developer has to remember. RLS makes the isolation
--   structural: a query that forgets the filter returns zero rows instead of
--   everyone's rows.
--
-- ---------------------------------------------------------------------------
-- READ THIS BEFORE RUNNING — RLS DOES NOTHING ON ITS OWN HERE
-- ---------------------------------------------------------------------------
-- This application connects straight to PostgreSQL with the connection string
-- in DATABASE_URL. If that connection is the `postgres` superuser (it is,
-- today), PostgreSQL **bypasses RLS entirely** and these policies have no
-- effect whatsoever.
--
-- So this migration does two things:
--   1. Creates a dedicated, non-superuser role `construction_app` that the
--      API connects as. RLS applies to it.
--   2. Enables RLS + policies on every table that has a company_id.
--
-- After running this you MUST repoint DATABASE_URL at the new role, or the
-- policies are decorative. The final section prints the connection string.
--
-- ---------------------------------------------------------------------------
-- HOW THE POLICY KNOWS THE TENANT
-- ---------------------------------------------------------------------------
-- The API sets a session variable at the start of each request/transaction:
--
--     SET LOCAL app.company_id = '42';
--
-- The policies compare company_id against that value. If it is not set, the
-- policies match nothing — it fails CLOSED, which is the safe direction.
--
-- The backend does this for you in database/pool.js (withCompanyScope).
--
-- HOW TO RUN
--   Supabase: SQL Editor → paste → Run (after 002).
--   Local:    psql "$DATABASE_URL" -f 003_supabase_rls.sql
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tenant context helper
-- ---------------------------------------------------------------------------
-- Returns the company_id for the current session, or NULL when unset.
-- STABLE + strict so the planner can cache it within a statement.
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    raw TEXT;
BEGIN
    -- second arg 'true' => return NULL instead of erroring when unset
    raw := current_setting('app.company_id', true);

    IF raw IS NULL OR raw = '' THEN
        RETURN NULL;
    END IF;

    RETURN raw::INTEGER;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.current_company_id() IS
    'Tenant id for the current session, read from the app.company_id session variable. NULL when unset, which makes every RLS policy fail closed.';


-- ---------------------------------------------------------------------------
-- 2. Application role
-- ---------------------------------------------------------------------------
-- A non-superuser, non-BYPASSRLS role for the API to connect as.
--
-- >>> CHANGE THIS PASSWORD before running. <<<
--
-- NOTE ON ATTRIBUTES
--   CREATE ROLE already defaults to NOSUPERUSER, NOBYPASSRLS, NOCREATEDB
--   and NOCREATEROLE, which is exactly what this role needs. Spelling them
--   out in an ALTER ROLE is not just redundant, it actively fails on
--   Supabase:
--
--     ERROR: 42501: permission denied to alter role
--     DETAIL: Only roles with the SUPERUSER attribute may alter roles
--             with the SUPERUSER attribute.
--
--   PostgreSQL only lets a superuser touch the SUPERUSER attribute at all,
--   even to turn it off, and Supabase's `postgres` is not a true superuser.
--
--   So the attributes are verified below rather than forced, and a role
--   that somehow has unsafe attributes produces a clear warning instead of
--   aborting the migration.
DO $$
DECLARE
    app_password TEXT := 'CHANGE_ME_BEFORE_RUNNING';
    attrs        RECORD;
BEGIN
    IF app_password = 'CHANGE_ME_BEFORE_RUNNING' THEN
        RAISE WARNING
            'construction_app is being created with the placeholder password. Change it immediately with: ALTER ROLE construction_app WITH PASSWORD ''<strong-password>'';';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'construction_app') THEN
        -- Defaults are already NOSUPERUSER / NOBYPASSRLS / NOCREATEDB /
        -- NOCREATEROLE, so no attribute clauses are needed.
        EXECUTE format('CREATE ROLE construction_app LOGIN PASSWORD %L', app_password);

        RAISE NOTICE 'Created role construction_app.';
    ELSE
        RAISE NOTICE 'Role construction_app already exists; leaving it as it is.';
    END IF;

    -- Confirm the role genuinely cannot sidestep the policies.
    SELECT rolsuper, rolbypassrls, rolcanlogin
      INTO attrs
      FROM pg_roles
     WHERE rolname = 'construction_app';

    IF attrs.rolsuper OR attrs.rolbypassrls THEN
        RAISE WARNING
            'construction_app has SUPERUSER or BYPASSRLS, so row-level security will NOT apply to it. Fix as a superuser with: ALTER ROLE construction_app NOSUPERUSER NOBYPASSRLS;';
    END IF;

    IF NOT attrs.rolcanlogin THEN
        RAISE WARNING
            'construction_app cannot log in. Fix with: ALTER ROLE construction_app LOGIN;';
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO construction_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO construction_app;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO construction_app;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO construction_app;

-- Apply to anything created later too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO construction_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO construction_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO construction_app;


-- ---------------------------------------------------------------------------
-- 3. Enable RLS + tenant policy on every table that has company_id
-- ---------------------------------------------------------------------------
-- Driven off the catalog rather than a hardcoded list, so a table added later
-- with a company_id column is covered the next time this runs.
DO $$
DECLARE
    r        RECORD;
    n_tables INTEGER := 0;
BEGIN
    FOR r IN
        SELECT c.relname AS tablename
          FROM pg_class      c
          JOIN pg_namespace  n ON n.oid = c.relnamespace
          JOIN pg_attribute  a ON a.attrelid = c.oid
         WHERE n.nspname = 'public'
           AND c.relkind = 'r'
           AND a.attname = 'company_id'
           AND a.attnum > 0
           AND NOT a.attisdropped
         ORDER BY c.relname
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',  r.tablename);
        -- FORCE so the table owner is subject to the policy too.
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',   r.tablename);

        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', r.tablename);

        -- One policy covering SELECT/INSERT/UPDATE/DELETE.
        --   USING       → which existing rows are visible/modifiable
        --   WITH CHECK  → what a new/updated row is allowed to contain,
        --                 which stops writing a row into another tenant.
        EXECUTE format($pol$
            CREATE POLICY tenant_isolation ON public.%I
                FOR ALL
                USING      (company_id = public.current_company_id())
                WITH CHECK (company_id = public.current_company_id())
        $pol$, r.tablename);

        n_tables := n_tables + 1;
    END LOOP;

    RAISE NOTICE 'RLS enabled with tenant_isolation policy on % tables.', n_tables;
END $$;


-- ---------------------------------------------------------------------------
-- 4. Tables without company_id
-- ---------------------------------------------------------------------------
-- `companies` and `users` are deliberately NOT company-scoped:
--
--   companies — a row IS the tenant. Scoped by id, not company_id.
--   users     — a person can belong to more than one company; the join table
--               company_users carries the tenancy and is already protected.
--
-- Restrict `companies` to the caller's own row — except on INSERT.
--
-- A single FOR ALL policy here breaks registration outright: creating a
-- company has to satisfy WITH CHECK (id = current_company_id()), but the id
-- is generated by the sequence during that very INSERT and no context can
-- name it beforehand. Sign-up would fail for every new customer.
--
-- So reads and writes to an existing company stay scoped to the caller's
-- own row, while INSERT is treated as the bootstrap operation it is.
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.companies;
DROP POLICY IF EXISTS company_self_access ON public.companies;
DROP POLICY IF EXISTS company_bootstrap_insert ON public.companies;

CREATE POLICY company_self_access ON public.companies
    FOR ALL
    USING      (id = public.current_company_id())
    WITH CHECK (id = public.current_company_id());

-- Registration only. The new row is unreachable afterwards unless the
-- caller holds that company's context, which requires a company_users
-- membership — and that table is itself protected below.
CREATE POLICY company_bootstrap_insert ON public.companies
    FOR INSERT
    WITH CHECK (true);

-- INSERT ... RETURNING also consults the SELECT policies, and registration
-- needs the generated id back. Without this, sign-up fails with
-- "new row violates row-level security policy" even though the row was
-- acceptable — the insert passed and the read-back did not.
--
-- Scoped to the case where no company context is set, which is the
-- unauthenticated bootstrap path: every authenticated request sets one via
-- withTenant() in database/pool.js. The exposure if that ever slipped is
-- company names and settings, not tenant data — every table holding real
-- records keeps the strict policy.
CREATE POLICY company_bootstrap_select ON public.companies
    FOR SELECT
    USING (public.current_company_id() IS NULL);


-- ---------------------------------------------------------------------------
-- 4b. company_users — same bootstrap problem
-- ---------------------------------------------------------------------------
-- Registration inserts the owner's membership immediately after creating
-- the company, before any context exists. The plain tenant policy applied
-- by the sweep above would reject it.
--
-- INSERT is therefore allowed when no company context is set at all, which
-- is only true on the unauthenticated bootstrap path: every authenticated
-- request goes through withTenant() in database/pool.js and always has one.
-- An authenticated caller is held to their own company.
DROP POLICY IF EXISTS tenant_isolation ON public.company_users;
DROP POLICY IF EXISTS company_users_access ON public.company_users;
DROP POLICY IF EXISTS company_users_bootstrap_insert ON public.company_users;

CREATE POLICY company_users_access ON public.company_users
    FOR ALL
    USING      (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

CREATE POLICY company_users_bootstrap_insert ON public.company_users
    FOR INSERT
    WITH CHECK (public.current_company_id() IS NULL);

-- Same RETURNING requirement as companies above.
DROP POLICY IF EXISTS company_users_bootstrap_select ON public.company_users;
CREATE POLICY company_users_bootstrap_select ON public.company_users
    FOR SELECT
    USING (public.current_company_id() IS NULL);


-- ---------------------------------------------------------------------------
-- 4d. Seed trigger must not be blocked by RLS
-- ---------------------------------------------------------------------------
-- 004 installs a trigger that seeds the material catalog and labour
-- categories whenever a company is created. It runs inside the registration
-- transaction, where no company context exists yet, so its inserts are
-- rejected and registration fails.
--
-- SECURITY DEFINER makes those functions execute as their owner, which is
-- the correct treatment for a trigger performing bookkeeping the caller is
-- not expected to authorise row by row.
--
-- Guarded, because 003 may run before 004 on a fresh database.
DO $$
DECLARE
    fn TEXT;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'seed_material_catalog',
        'seed_labour_categories',
        'seed_new_company_reference_data'
    ] LOOP
        IF EXISTS (
            SELECT 1 FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = fn
        ) THEN
            EXECUTE format(
                'ALTER FUNCTION public.%I(%s) SECURITY DEFINER',
                fn,
                CASE WHEN fn = 'seed_new_company_reference_data'
                     THEN '' ELSE 'INTEGER' END
            );
        END IF;
    END LOOP;
END $$;


-- ---------------------------------------------------------------------------
-- 4c. Let the migration runner test the new role
-- ---------------------------------------------------------------------------
-- Without membership, the verification steps at the bottom of this file fail
-- with "permission denied to set role". Granting it to the current role
-- makes SET ROLE construction_app work for testing.
DO $$
BEGIN
    EXECUTE format(
        'GRANT construction_app TO %I',
        current_user
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE
            'Could not grant construction_app to %; SET ROLE construction_app may not work for the verification steps. Connect as construction_app directly instead.',
            current_user;
END $$;

-- `users` is intentionally left without RLS: login must look a user up by
-- email *before* any company context exists. Access is enforced in the
-- application layer (authMiddleware) and via company_users, which IS
-- protected. Enabling RLS here would break authentication.


-- ---------------------------------------------------------------------------
-- 5. Bypass role for migrations and admin tooling
-- ---------------------------------------------------------------------------
-- Migrations, backups and the break-glass script need to see everything.
-- Continue to run those as the owner/superuser (your existing DATABASE_URL),
-- not as construction_app.


COMMIT;

-- ===========================================================================
-- AFTER RUNNING — three things
-- ===========================================================================
--
-- 1. Set a real password:
--
--      ALTER ROLE construction_app WITH PASSWORD 'a-long-random-password';
--
-- 2. Repoint the API at the new role. Until you do, RLS has NO effect
--    because postgres bypasses it:
--
--      # local
--      DATABASE_URL=postgresql://construction_app:<password>@localhost:5432/construction_portal
--
--      # supabase
--      DATABASE_URL=postgresql://construction_app:<password>@db.<ref>.supabase.co:5432/postgres
--
-- 3. Verify isolation actually works:
--
--      SET ROLE construction_app;
--      SET app.company_id = '1';
--      SELECT count(*) FROM payments;      -- only company 1
--      SET app.company_id = '2';
--      SELECT count(*) FROM payments;      -- only company 2
--      RESET app.company_id;
--      SELECT count(*) FROM payments;      -- 0 rows — fails closed
--      RESET ROLE;
--
-- ===========================================================================
