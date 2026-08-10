-- ===========================================================================
-- Construction Portal — Migration 006: idempotency keys
-- ===========================================================================
--
-- WHY THIS EXISTS
--
-- Site Operations records evidence: a material delivery, a day's labour, money
-- issued to a supervisor, an expense against it. Every one of those writes was
-- retry-unsafe, because nothing in the system could tell a repeat of a request
-- from a second, genuinely different one.
--
-- Three consequences, in increasing order of seriousness:
--
--   1. A double-tap on a phone with a slow connection creates two ledger
--      entries for one delivery.
--   2. A request that timed out but actually landed cannot be retried, because
--      the client has no way to find out which happened.
--   3. Backdated-entry grants are SINGLE USE and are consumed server-side
--      after the write succeeds. A retry of a request that already succeeded
--      would find no grant left and be refused — so the supervisor has to ask
--      the office for access a second time, for an entry that is already in
--      the record.
--
-- The third is the one that makes this a correctness problem rather than a
-- tidiness one. It is also what blocks any offline queue: replaying a queued
-- write without idempotency can duplicate evidence and burn a grant.
--
-- WHAT THIS DOES NOT DO
--
-- It changes no business rule. The entry window, the grant mechanism, who may
-- record what, and what a record means are all untouched. This only makes a
-- repeated request return the answer the first one got, instead of doing the
-- work twice.
--
-- SCOPE
--
-- A key is unique per (company, user, operation). Not global:
--
--   * company — the same tenant boundary as everything else. A key from one
--     company can never collide with, or reveal, another's.
--   * user    — two supervisors on the same site, whose clients happen to
--     generate the same key, must not shadow each other.
--   * operation — a key reused across different endpoints is a client bug,
--     and scoping by operation makes it a harmless one rather than a
--     cross-endpoint replay.
--
-- HOW TO RUN
--   psql "$DATABASE_URL" -f 006_idempotency_keys.sql
--
-- Safe to re-run: every statement is IF NOT EXISTS.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id            BIGSERIAL PRIMARY KEY,

  company_id    INTEGER      NOT NULL
                  REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id       INTEGER      NOT NULL
                  REFERENCES public.users (id) ON DELETE CASCADE,

  -- The endpoint, as a stable internal name rather than a URL: a route can be
  -- renamed without orphaning keys that are still in flight.
  operation     TEXT         NOT NULL,

  -- Client-generated. Opaque to the server; never parsed, only compared.
  idempotency_key TEXT       NOT NULL,

  -- 'in_progress' while the first request is still running, 'completed' once
  -- a response has been stored. There is deliberately no 'failed': a request
  -- that errored releases its claim (see the controller) so the client may
  -- legitimately retry.
  status        TEXT         NOT NULL DEFAULT 'in_progress',

  -- The response the first successful request produced, replayed verbatim to
  -- any later request carrying the same key.
  response_status INTEGER,
  response_body   JSONB,

  /*
   * A fingerprint of the request body.
   *
   * Guards against the client reusing a key for a DIFFERENT payload, which is
   * a bug that would otherwise silently return the wrong record's response.
   * Compared, never trusted to be secret — it is a hash of data the caller
   * already has.
   */
  request_fingerprint TEXT,

  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

/*
 * The claim.
 *
 * This unique index is the whole concurrency mechanism: two simultaneous
 * requests carrying one key race to INSERT, exactly one wins, and the loser
 * discovers the winner rather than doing the work again.
 */
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_scope_uq
  ON public.idempotency_keys (company_id, user_id, operation, idempotency_key);

-- Reaping old keys. Kept out of the unique index so it stays narrow.
CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx
  ON public.idempotency_keys (created_at);

COMMENT ON TABLE public.idempotency_keys IS
  'Makes evidentiary writes safe to retry. Scoped per company, user and operation; see migration 006.';
