/*
|--------------------------------------------------------------------------
| Idempotency
|--------------------------------------------------------------------------
|
| Makes an evidentiary write safe to retry.
|
| THE PROBLEM THIS SOLVES
|
| Site Operations records evidence, and every write there was retry-unsafe:
| nothing could tell a repeat of a request from a second, genuinely different
| one. A double-tap on a slow connection created two ledger entries. A request
| that timed out but actually landed could not be retried, because the client
| had no way to discover which had happened.
|
| The sharpest case is the backdating grant. Grants are SINGLE USE and are
| consumed server-side after the write succeeds, so retrying a request that
| already succeeded finds no grant left and is refused — and the supervisor has
| to ask the office for access a second time, for an entry that is already in
| the record.
|
| WHAT IT DOES NOT DO
|
| It changes no business rule. The entry window, the grant mechanism, who may
| record what, and what a record means are untouched. A repeated request
| returns the answer the first one got instead of doing the work twice.
|
| HOW IT WORKS
|
|   1. No `Idempotency-Key` header  → pass straight through. Opt-in, so no
|      existing client changes behaviour.
|   2. Claim the key with INSERT ... ON CONFLICT DO NOTHING. The unique index
|      from migration 006 is the entire concurrency mechanism: two simultaneous
|      requests race, exactly one wins.
|   3. Claim won   → run the handler, store the response, mark completed.
|   4. Claim lost, and the winner completed → replay its stored response.
|   5. Claim lost, and the winner is still running → 409. The client retries;
|      it does not get a second write.
|
| WHY A FAILED REQUEST RELEASES ITS CLAIM
|
| There is deliberately no 'failed' status. If the handler errors or answers
| 4xx/5xx, the row is deleted, so the client may legitimately retry with the
| same key. Keeping the claim would turn one transient failure into a
| permanently unusable key — the caller could never complete that operation.
|
| Only a SUCCESSFUL response is worth replaying, because only a successful
| response corresponds to a record that now exists.
|
| WHY THE BODY IS FINGERPRINTED
|
| A client that reuses one key for a different payload has a bug. Without the
| fingerprint the server would answer the second call with the first record's
| response — silently, and wrongly. With it, the mismatch is a 422 that names
| the problem.
|
| Connected to:
| - database/migrations/006_idempotency_keys.sql
| - modules/siteOperations/siteOperations.routes.js — the first consumer
*/

const crypto = require("crypto");

const pool = require("../database/pool");

/** Stable fingerprint of a request body. Key order must not matter. */
const fingerprint = (body) => {
  const stable = (value) => {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(stable);
    }

    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stable(value[key]);
        return acc;
      }, {});
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stable(body ?? {})))
    .digest("hex");
};

/**
 * Guards one route.
 *
 * @param {string} operation  a stable internal name for the endpoint. Not the
 *                            URL: a route may be renamed without orphaning
 *                            keys that are still in flight.
 */
const idempotent = (operation) => async (req, res, next) => {
  const key = req.get("Idempotency-Key");

  // Opt-in. A client that sends no key behaves exactly as it always did.
  if (!key) {
    return next();
  }

  const companyId = req.user?.company_id;
  const userId = req.user?.id;

  /*
   * Both come from the authenticated session. If either is missing the
   * request is not scoped to anyone, and storing a key against it would let
   * one caller's key collide with another's. Fall through rather than guess —
   * the route's own auth will reject it a moment later.
   */
  if (!companyId || !userId) {
    return next();
  }

  const print = fingerprint(req.body);

  let claimed;

  try {
    claimed = await pool.query(
      `
      INSERT INTO idempotency_keys
        (company_id, user_id, operation, idempotency_key,
         status, request_fingerprint)
      VALUES ($1, $2, $3, $4, 'in_progress', $5)
      ON CONFLICT (company_id, user_id, operation, idempotency_key)
        DO NOTHING
      RETURNING id
      `,
      [companyId, userId, operation, key, print]
    );
  } catch (error) {
    /*
     * The table is missing, or the database is unhappy. Idempotency is a
     * safety net, not a gate: failing the request because the net is down
     * would be worse than the duplicate it exists to prevent.
     */
    console.error(
      "[idempotency] could not claim key, proceeding unguarded:",
      error.message
    );

    return next();
  }

  const won = claimed.rows.length > 0;

  if (!won) {
    const existing = await pool.query(
      `
      SELECT status, response_status, response_body, request_fingerprint
      FROM idempotency_keys
      WHERE company_id = $1
        AND user_id = $2
        AND operation = $3
        AND idempotency_key = $4
      `,
      [companyId, userId, operation, key]
    );

    const row = existing.rows[0];

    // Raced with a delete from a failed attempt. Treat as a fresh request.
    if (!row) {
      return next();
    }

    if (
      row.request_fingerprint &&
      row.request_fingerprint !== print
    ) {
      return res.status(422).json({
        success: false,
        message:
          "This Idempotency-Key was already used for a different request. Use a new key.",
      });
    }

    if (row.status === "completed") {
      return res
        .status(row.response_status || 200)
        .json(row.response_body);
    }

    /*
     * The first request is still running. 409 rather than waiting: holding
     * the connection open on a weak field connection is how a retry storm
     * starts, and the client already knows how to try again.
     */
    return res.status(409).json({
      success: false,
      message:
        "That request is already being processed. Retry in a moment.",
    });
  }

  /*
   * We hold the claim. Capture the response so it can be replayed, then
   * release the claim if the request did not succeed.
   */
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    const status = res.statusCode || 200;
    const succeeded = status >= 200 && status < 300;

    const finalise = succeeded
      ? pool.query(
          `
          UPDATE idempotency_keys
          SET status = 'completed',
              response_status = $1,
              response_body = $2,
              completed_at = NOW()
          WHERE company_id = $3
            AND user_id = $4
            AND operation = $5
            AND idempotency_key = $6
          `,
          [status, body, companyId, userId, operation, key]
        )
      : pool.query(
          `
          DELETE FROM idempotency_keys
          WHERE company_id = $1
            AND user_id = $2
            AND operation = $3
            AND idempotency_key = $4
            AND status = 'in_progress'
          `,
          [companyId, userId, operation, key]
        );

    // Never let bookkeeping fail the response the caller is waiting on.
    finalise.catch((error) =>
      console.error(
        "[idempotency] could not finalise key:",
        error.message
      )
    );

    return originalJson(body);
  };

  return next();
};

module.exports = {
  idempotent,
  fingerprint,
};
