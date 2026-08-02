-- ===========================================================================
-- Construction Portal — Migration 005: drop the duplicate assignment table
-- ===========================================================================
--
-- There were two tables for one concept.
--
--   worker_assignments   what the office writes. The tender module reads,
--                        inserts, updates and soft-deletes it through
--                        /api/tenders/:id/workers.
--
--   tender_workers       added by migration 001 because the worker portal
--                        queried a table that did not exist. Creating it
--                        stopped the 42P01, but nothing has ever written a
--                        row to it — so the portal read an empty table and
--                        told every worker they were not assigned to the
--                        site they were standing on.
--
-- The portal now reads worker_assignments, which leaves tender_workers with
-- no reader and no writer.
--
-- THIS FILE IS OPTIONAL AND DESTRUCTIVE.
--
-- It only drops the table when it is empty. If your database has rows in
-- tender_workers, the migration leaves it alone and tells you — move those
-- rows into worker_assignments first, then re-run.
--
-- HOW TO RUN
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 005_drop_duplicate_assignment_table.sql
--   Supabase: SQL Editor → paste → Run
-- ===========================================================================

BEGIN;

DO $$
DECLARE
    row_count BIGINT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
         WHERE schemaname = 'public' AND tablename = 'tender_workers'
    ) THEN
        RAISE NOTICE 'tender_workers is already gone — nothing to do.';
        RETURN;
    END IF;

    EXECUTE 'SELECT count(*) FROM public.tender_workers' INTO row_count;

    IF row_count > 0 THEN
        RAISE WARNING
            'tender_workers still holds % row(s); leaving it in place. Move them into worker_assignments, then re-run this file.',
            row_count;
        RETURN;
    END IF;

    DROP TABLE public.tender_workers;

    RAISE NOTICE 'Dropped tender_workers (it was empty and had no reader or writer).';
END
$$;

COMMIT;

-- ===========================================================================
-- Verify
--   SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public' AND tablename IN
--          ('tender_workers', 'worker_assignments');
--
--   -- worker_assignments should be the only one left.
-- ===========================================================================
