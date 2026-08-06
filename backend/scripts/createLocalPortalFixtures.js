/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Creates LOCAL-ONLY test accounts for the Worker Portal and the
| Subcontractor Portal, so those two screens can be opened by a browser and
| by the Playwright suite.
|
| Why this exists:
| Both portals are gated by RoleRoute on the frontend and by a linked-record
| lookup on the backend. An admin account cannot reach either. Without a
| worker and a subcontractor whose `user_id` links back to a real row, the
| two most mobile-critical screens in the product cannot be verified at all.
|
| scripts/createBreakGlassAdmin.js cannot be used for this: it hard-codes
| `role = 'admin'` on both the users and the company_users upsert.
|
| What each portal actually requires — verified against the controllers,
| not assumed:
|
|   Worker  (modules/workerPortal/workerPortal.controller.js)
|     SELECT ... FROM workers w LEFT JOIN users u ON u.id = w.user_id
|     WHERE w.user_id = $1
|       AND COALESCE(w.is_deleted, FALSE) = FALSE
|       AND COALESCE(w.status, 'active') != 'inactive'
|
|   Subcontractor (modules/subcontractorPortal/subcontractorPortal.controller.js)
|     SELECT ... FROM subcontractors s INNER JOIN users u ON u.id = s.user_id
|     WHERE s.user_id = $1
|       AND COALESCE(s.is_deleted, FALSE) = FALSE
|       AND COALESCE(s.status, 'active') != 'inactive'
|
| So each fixture needs three rows: `users`, `company_users`, and the linked
| `workers` / `subcontractors` record.
|
|==========================================================================
| SAFETY
|==========================================================================
|
| This script writes user accounts, so it guards itself rather than trusting
| the operator:
|
|   - Refuses to run when NODE_ENV is 'production'.
|   - Refuses to run unless DATABASE_URL points at localhost / 127.0.0.1.
|   - Refuses to touch an email that is not one of its own fixtures, so it
|     can never overwrite a real user the way createBreakGlassAdmin can.
|   - Never prints a password it was given; prints only what it generated.
|   - Contains no committed credentials. Passwords come from the environment,
|     or are generated locally with crypto.randomBytes.
|
|==========================================================================
| USAGE
|==========================================================================
|
|   cd backend
|
|   # create (passwords generated and printed once)
|   node scripts/createLocalPortalFixtures.js
|
|   # create with chosen passwords
|   LOCAL_WORKER_FIXTURE_PASSWORD='…' \
|   LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD='…' \
|   node scripts/createLocalPortalFixtures.js
|
|   # remove every fixture this script created
|   node scripts/createLocalPortalFixtures.js --cleanup
|
| Environment variables (all optional):
|   LOCAL_WORKER_FIXTURE_EMAIL            default worker-fixture@local.test
|   LOCAL_WORKER_FIXTURE_PASSWORD         default: generated
|   LOCAL_SUBCONTRACTOR_FIXTURE_EMAIL     default subcontractor-fixture@local.test
|   LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD  default: generated
|   LOCAL_FIXTURE_COMPANY_ID              default 1
|
|==========================================================================
| CLEANUP
|==========================================================================
|
| `--cleanup` deletes, in FK-safe order: the linked workers/subcontractors
| row, the company_users membership, then the user — and only for the two
| fixture addresses. Anything else in the database is left alone.
|
| Depends on: bcryptjs, dotenv, database/pool.js
| Tables touched: companies (read), users, company_users, workers,
|                 subcontractors
|
*/

require("dotenv").config();

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../database/pool");

/*
 * Fixture addresses.
 *
 * `.local.test` is a reserved, non-routable TLD — these can never collide
 * with a real company address, and they make the rows obvious in a user
 * list. The cleanup path will refuse to delete anything not in this set.
 */
const DEFAULT_WORKER_EMAIL = "worker-fixture@local.test";
const DEFAULT_SUBCONTRACTOR_EMAIL = "subcontractor-fixture@local.test";

const workerEmail = (
  process.env.LOCAL_WORKER_FIXTURE_EMAIL || DEFAULT_WORKER_EMAIL
)
  .trim()
  .toLowerCase();

const subcontractorEmail = (
  process.env.LOCAL_SUBCONTRACTOR_FIXTURE_EMAIL || DEFAULT_SUBCONTRACTOR_EMAIL
)
  .trim()
  .toLowerCase();

const companyId = Number(process.env.LOCAL_FIXTURE_COMPANY_ID || 1);

const FIXTURE_EMAILS = [workerEmail, subcontractorEmail];

/**
 * Aborts unless this is unmistakably a local development database.
 *
 * Both checks matter. NODE_ENV alone is easy to leave unset; the host check
 * alone would still allow a production build pointed at a tunnel. Neither is
 * clever — that is the point.p
 */
function assertLocalOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run: NODE_ENV is 'production'.");
  }

  const url = process.env.DATABASE_URL || "";

  let host;

  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("Refusing to run: DATABASE_URL is missing or unparseable.");
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(
      `Refusing to run: DATABASE_URL host is '${host}', not a local address. ` +
        "These fixtures are for local development only."
    );
  }
}

/** A local throwaway password. Never derived from anything committed. */
function generatePassword() {
  return `local-${crypto.randomBytes(12).toString("base64url")}`;
}

/**
 * Upserts one portal user and returns its id.
 *
 * Deliberately narrower than createBreakGlassAdmin's upsert: the WHERE on the
 * update path pins it to the fixture address, so if a real user somehow held
 * this email the script fails rather than silently seizing the account.
 */
async function upsertUser(client, { email, password, fullName, role }) {
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await client.query(
    `SELECT id, role FROM public.users WHERE LOWER(email) = $1 LIMIT 1`,
    [email]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];

    // Only ever update a row this script owns.
    if (!FIXTURE_EMAILS.includes(email)) {
      throw new Error(`Refusing to modify non-fixture user ${email}.`);
    }

    await client.query(
      `
      UPDATE public.users
      SET full_name = $2,
          password_hash = $3,
          role = $4,
          status = 'active',
          reset_token = NULL,
          reset_token_expires = NULL,
          updated_at = NOW()
      WHERE id = $1
      `,
      [row.id, fullName, passwordHash, role]
    );

    return row.id;
  }

  const inserted = await client.query(
    `
    INSERT INTO public.users
      (full_name, email, password_hash, role, status, created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, 'active', NOW(), NOW())
    RETURNING id
    `,
    [fullName, email, passwordHash, role]
  );

  return inserted.rows[0].id;
}

/** Attaches the user to the company. Portal requests need a company context. */
async function upsertMembership(client, userId, role) {
  await client.query(
    `
    INSERT INTO public.company_users (company_id, user_id, role, created_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `,
    [companyId, userId, role]
  );
}

/**
 * The linked worker record.
 *
 * `status` must not be 'inactive' and `is_deleted` must be false, or
 * getWorkerForUser returns nothing and the portal renders as "not linked".
 */
async function upsertWorkerRecord(client, userId, fullName, email) {
  const existing = await client.query(
    `SELECT id FROM public.workers WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  if (existing.rows.length > 0) {
    await client.query(
      `
      UPDATE public.workers
      SET full_name = $2, email = $3, status = 'active',
          is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL,
          updated_at = NOW()
      WHERE id = $1
      `,
      [existing.rows[0].id, fullName, email]
    );

    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `
    INSERT INTO public.workers
      (company_id, full_name, email, phone, role, status,
       is_deleted, user_id, created_at, updated_at)
    VALUES
      ($1, $2, $3, '0000000000', 'Site Worker', 'active',
       FALSE, $4, NOW(), NOW())
    RETURNING id
    `,
    [companyId, fullName, email, userId]
  );

  return inserted.rows[0].id;
}

/** The linked subcontractor record. Same active/not-deleted requirements. */
async function upsertSubcontractorRecord(client, userId, fullName, email) {
  const existing = await client.query(
    `SELECT id FROM public.subcontractors WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  if (existing.rows.length > 0) {
    await client.query(
      `
      UPDATE public.subcontractors
      SET full_name = $2, email = $3, status = 'active',
          is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL,
          updated_at = NOW()
      WHERE id = $1
      `,
      [existing.rows[0].id, fullName, email]
    );

    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `
    INSERT INTO public.subcontractors
      (company_id, full_name, email, phone, business_name, status,
       is_deleted, user_id, created_at, updated_at)
    VALUES
      ($1, $2, $3, '0000000000', 'Local Fixture Contracting', 'active',
       FALSE, $4, NOW(), NOW())
    RETURNING id
    `,
    [companyId, fullName, email, userId]
  );

  return inserted.rows[0].id;
}

/**
 * Removes both fixtures.
 *
 * Order matters: the linked records reference the user, so they go first.
 * Every statement is scoped to the fixture addresses.
 */
async function cleanup(client) {
  const users = await client.query(
    `SELECT id, email FROM public.users WHERE LOWER(email) = ANY($1)`,
    [FIXTURE_EMAILS]
  );

  if (users.rows.length === 0) {
    console.log("No fixtures found. Nothing to remove.");
    return;
  }

  const ids = users.rows.map((row) => row.id);

  await client.query(`DELETE FROM public.workers WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM public.subcontractors WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM public.company_users WHERE user_id = ANY($1)`, [ids]);
  await client.query(`DELETE FROM public.users WHERE id = ANY($1)`, [ids]);

  users.rows.forEach((row) => {
    console.log(`Removed fixture: ${row.email} (user ${row.id})`);
  });
}

const main = async () => {
  assertLocalOnly();

  const isCleanup = process.argv.includes("--cleanup");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (isCleanup) {
      await cleanup(client);
      await client.query("COMMIT");
      return;
    }

    const company = await client.query(
      `SELECT id, company_name FROM public.companies WHERE id = $1 LIMIT 1`,
      [companyId]
    );

    if (company.rows.length === 0) {
      throw new Error(`Company ${companyId} does not exist.`);
    }

    /*
     * Generated only when not supplied, so a chosen password is never echoed
     * back to the terminal or into a CI log.
     *
     * A generated value is printed once and never stored — if you intend to
     * run the browser suites, supply the variables instead, because those
     * suites read the same names and have no defaults of their own.
     */
    const workerPassword =
      process.env.LOCAL_WORKER_FIXTURE_PASSWORD || generatePassword();
    const workerGenerated = !process.env.LOCAL_WORKER_FIXTURE_PASSWORD;

    const subcontractorPassword =
      process.env.LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD || generatePassword();
    const subcontractorGenerated =
      !process.env.LOCAL_SUBCONTRACTOR_FIXTURE_PASSWORD;

    const workerUserId = await upsertUser(client, {
      email: workerEmail,
      password: workerPassword,
      fullName: "Local Fixture Worker",
      role: "worker",
    });

    await upsertMembership(client, workerUserId, "worker");

    const workerRecordId = await upsertWorkerRecord(
      client,
      workerUserId,
      "Local Fixture Worker",
      workerEmail
    );

    const subUserId = await upsertUser(client, {
      email: subcontractorEmail,
      password: subcontractorPassword,
      fullName: "Local Fixture Subcontractor",
      role: "subcontractor",
    });

    await upsertMembership(client, subUserId, "subcontractor");

    const subRecordId = await upsertSubcontractorRecord(
      client,
      subUserId,
      "Local Fixture Subcontractor",
      subcontractorEmail
    );

    await client.query("COMMIT");

    console.log(`\nLocal portal fixtures ready — company ${companyId} (${company.rows[0].company_name}):\n`);

    console.log("  WORKER PORTAL");
    console.log(`    email        ${workerEmail}`);
    console.log(`    password     ${workerGenerated ? workerPassword : "(from environment — not echoed)"}`);
    console.log(`    user id      ${workerUserId}`);
    console.log(`    worker id    ${workerRecordId}`);

    console.log("\n  SUBCONTRACTOR PORTAL");
    console.log(`    email        ${subcontractorEmail}`);
    console.log(`    password     ${subcontractorGenerated ? subcontractorPassword : "(from environment — not echoed)"}`);
    console.log(`    user id      ${subUserId}`);
    console.log(`    subcontractor id ${subRecordId}`);

    console.log("\n  Remove with: node scripts/createLocalPortalFixtures.js --cleanup\n");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

main();
