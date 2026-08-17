-- ===========================================================================
-- Construction Portal — Migration 007: one login, one subcontractor
-- ===========================================================================
--
-- WHY THIS EXISTS
--
-- `workers` and `subcontractors` both carry a nullable `user_id` — the link
-- that turns a profile row into someone who can sign into their portal. The
-- two tables have never been protected equally:
--
--     workers         ux_workers_user_id — UNIQUE, partial:
--                     (user_id) WHERE user_id IS NOT NULL AND is_deleted = false
--     subcontractors  a foreign key, and nothing else
--
-- So two subcontractor rows may point at the same login. Both portals resolve
-- the caller's profile with LIMIT 1 —
-- `subcontractorPortal.controller.js:82` and `workerPortal.controller.js:85`
-- — which means a duplicate does not error. It silently serves one of the two,
-- and which one it serves is whatever the planner returned first. A
-- subcontractor could see another subcontractor's tenders, invoices and bank
-- details, with nothing in the logs to say it happened.
--
-- On the worker side that LIMIT 1 is harmless, because the unique index makes
-- a second row impossible. On the subcontractor side the index is the missing
-- half, and the LIMIT 1 is load-bearing by accident.
--
-- WHY NOW
--
-- Until now the only writer of either `user_id` column anywhere in the
-- repository was `backend/scripts/createLocalPortalFixtures.js`, a local dev
-- script. A monopoly held by one careful script is not a constraint, and
-- linking is about to become a product operation that admins perform — see
-- `modules/auth/profileLink.service.js`.
--
-- The application asserts `rowCount === 1` on the linking UPDATE. This index
-- is the database-level half of that guard: the half that still holds when a
-- future caller forgets to check, or when two admins race.
--
-- WHAT THIS DOES NOT DO
--
-- It does not require a subcontractor to have a login. `user_id` stays
-- nullable and the index stays partial, so any number of rows may have none —
-- that is the normal case, exactly as it is for workers. This constrains only
-- how many rows may claim the SAME login: at most one.
--
-- Soft-deleted rows are excluded, matching `ux_workers_user_id`. Deleting a
-- subcontractor therefore frees their login to be linked to a new row.
--
-- SAFETY
--
-- Creating a unique index on a table that already violates it fails with
-- Postgres's own message, which names the index and one conflicting key but
-- not the rows an operator has to go and fix. The DO block below checks first
-- and raises an exception naming every offending login and the subcontractor
-- ids that share it, so the failure is actionable rather than a puzzle.
--
-- There are no duplicates in the development database this was written
-- against. A production database may differ, which is the whole reason the
-- check exists.
--
-- RE-RUNNABLE. The check is a SELECT; the index is IF NOT EXISTS.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Refuse to proceed if the data would violate the index
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  offending_count integer;
  offending_detail text;
BEGIN
  SELECT
    count(*),
    string_agg(
      format('user_id %s is claimed by subcontractor ids %s', user_id, ids),
      E'\n  '
      ORDER BY user_id
    )
  INTO offending_count, offending_detail
  FROM (
    SELECT
      user_id,
      string_agg(id::text, ', ' ORDER BY id) AS ids
    FROM public.subcontractors
    WHERE user_id IS NOT NULL
      AND COALESCE(is_deleted, false) = false
    GROUP BY user_id
    HAVING count(*) > 1
  ) AS duplicates;

  IF COALESCE(offending_count, 0) > 0 THEN
    RAISE EXCEPTION
      E'Migration 007 cannot run: % login(s) are linked to more than one subcontractor.\n  %\n\nDecide which subcontractor row owns each login, then clear user_id on the others (or soft-delete them) and re-run. Until then a subcontractor portal session may resolve to the wrong company record.',
      offending_count,
      offending_detail;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. The index — deliberately identical in shape to ux_workers_user_id
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS ux_subcontractors_user_id
  ON public.subcontractors (user_id)
  WHERE user_id IS NOT NULL
    AND is_deleted = false;

COMMIT;
