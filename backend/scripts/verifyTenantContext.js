/*
|--------------------------------------------------------------------------
| Tenant context verification
|--------------------------------------------------------------------------
|
|   node scripts/verifyTenantContext.js
|
| Proves that the request-scoped tenant context in database/tenantContext.js
| actually satisfies the row-level security policies from migration 003.
|
| WHY THIS IS A SCRIPT AND NOT A TEST
|   npm test runs against a database where 003 has never been applied and
|   where the connection is a superuser, so PostgreSQL bypasses every policy.
|   The whole suite passes whether or not the context wiring is correct — it
|   cannot see this class of failure. That blind spot is how the API came to
|   run as construction_app with no context at all, which took the
|   application down: reads silently returned nothing, writes raised 42501.
|
| WHAT IT DOES
|   Creates an isolated scratch database, mirrors 003's policy shape onto a
|   toy tenders table, then drives the real pool.query and withTransaction
|   code paths as construction_app — a role that cannot bypass RLS. The
|   scratch database is dropped on the way out, including on failure.
|
|   Your own database is only used to CREATE and DROP that scratch database
|   and to reset the construction_app password. No application table is read
|   or written.
|
| REQUIRES
|   DATABASE_URL pointing at a role that may create a database and a role,
|   i.e. the ordinary local postgres connection.
|
| Exit code is 0 when every check passes, 1 otherwise, so it can gate a
| deploy that is about to repoint DATABASE_URL at construction_app.
*/
require("dotenv").config({ quiet: true });

const { Pool } = require("pg");

const ADMIN_URL = process.env.DATABASE_URL;
const SCRATCH = "cp_rls_proof_scratch";
const APP_PW = "proof-only-password";

const adminUrlFor = (db) =>
  ADMIN_URL.replace(/\/[^/?]+(\?|$)/, `/${db}$1`);

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "  PASS" : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

(async () => {
  const admin = new Pool({ connectionString: ADMIN_URL, ssl: false });

  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH}`);
  await admin.query(`CREATE DATABASE ${SCRATCH}`);
  await admin.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='construction_app') THEN
        EXECUTE format('CREATE ROLE construction_app LOGIN PASSWORD %L', '${APP_PW}');
      ELSE
        EXECUTE format('ALTER ROLE construction_app WITH LOGIN PASSWORD %L', '${APP_PW}');
      END IF;
    END $$;`);
  await admin.end();

  // Build the schema, mirroring 003's policy shape exactly.
  const setup = new Pool({ connectionString: adminUrlFor(SCRATCH), ssl: false });
  await setup.query(`
    CREATE OR REPLACE FUNCTION public.current_company_id()
    RETURNS INTEGER LANGUAGE plpgsql STABLE AS $$
    DECLARE raw TEXT;
    BEGIN
      raw := current_setting('app.company_id', true);
      IF raw IS NULL OR raw = '' THEN RETURN NULL; END IF;
      RETURN raw::INTEGER;
    EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
    END $$;

    CREATE TABLE public.tenders (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      title TEXT NOT NULL
    );

    ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.tenders FORCE  ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON public.tenders
      FOR ALL
      USING      (company_id = public.current_company_id())
      WITH CHECK (company_id = public.current_company_id());

    GRANT USAGE ON SCHEMA public TO construction_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO construction_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO construction_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO construction_app;
  `);
  // Seed two tenants as the owner (bypasses RLS).
  await setup.query(`INSERT INTO tenders (company_id, title) VALUES (1,'A-one'),(1,'A-two'),(2,'B-one')`);
  await setup.end();

  // Now drive the REAL application code paths as construction_app.
  const appUrl = adminUrlFor(SCRATCH)
    .replace(/\/\/[^@]+@/, `//construction_app:${encodeURIComponent(APP_PW)}@`);
  process.env.DATABASE_URL = appUrl;
  process.env.DB_SSL = "false";

  delete require.cache[require.resolve("../config/env")];
  delete require.cache[require.resolve("../database/pool")];
  delete require.cache[require.resolve("../database/tenantContext")];
  delete require.cache[require.resolve("../utils/requestContext")];

  const pool = require("../database/pool");
  const { runWithTenant } = require("../database/tenantContext");
  const { withTransaction } = require("../utils/requestContext");

  const boot = await pool.checkDatabaseConnection();
  check("role is subject to RLS", boot.rls_enforced === true, `user=${boot.database_user}`);

  const run = (companyId, fn) =>
    new Promise((resolve, reject) =>
      runWithTenant(companyId, () => fn().then(resolve, reject))
    );

  // 1. pool.query reads only the caller's tenant.
  const a = await run(1, () => pool.query("SELECT id FROM tenders"));
  check("pool.query: company 1 sees only its own rows", a.rowCount === 2, `${a.rowCount} rows`);

  const b = await run(2, () => pool.query("SELECT id FROM tenders"));
  check("pool.query: company 2 sees only its own rows", b.rowCount === 1, `${b.rowCount} rows`);

  // 2. No context = no rows (fails closed) — the pre-fix behaviour.
  const none = await pool.query("SELECT id FROM tenders");
  check("pool.query: no tenant context returns nothing", none.rowCount === 0, `${none.rowCount} rows`);

  // 3. withTransaction INSERT — this is the exact path Add Tender uses.
  let insertOk = false;
  let insertErr = "";
  try {
    await run(1, () =>
      withTransaction(async (client) => {
        await client.query("INSERT INTO tenders (company_id, title) VALUES ($1,$2)", [1, "created-via-withTransaction"]);
      })
    );
    insertOk = true;
  } catch (e) {
    insertErr = `${e.code}: ${e.message}`;
  }
  check("withTransaction: INSERT succeeds (was 42501)", insertOk, insertErr);

  // 4. Cross-tenant write is still refused.
  let crossRefused = false;
  let crossCode = "";
  try {
    await run(1, () =>
      withTransaction((client) =>
        client.query("INSERT INTO tenders (company_id, title) VALUES ($1,$2)", [2, "into-another-tenant"])
      )
    );
  } catch (e) {
    crossRefused = true;
    crossCode = e.code;
  }
  check("withTransaction: cross-tenant INSERT refused", crossRefused, `SQLSTATE ${crossCode}`);

  // 5. Context does not leak between pooled connections.
  const after = await pool.query("SELECT id FROM tenders");
  check("context does not leak to an unscoped query", after.rowCount === 0, `${after.rowCount} rows`);

  // 6. Concurrent requests do not cross over.
  const [c1, c2] = await Promise.all([
    run(1, async () => {
      await new Promise((r) => setTimeout(r, 25));
      return pool.query("SELECT id FROM tenders");
    }),
    run(2, () => pool.query("SELECT id FROM tenders")),
  ]);
  check("concurrent requests stay isolated", c1.rowCount === 3 && c2.rowCount === 1, `c1=${c1.rowCount} c2=${c2.rowCount}`);

  await pool.closeDatabasePool();

  const cleanup = new Pool({ connectionString: ADMIN_URL, ssl: false });
  await cleanup.query(`DROP DATABASE IF EXISTS ${SCRATCH}`);
  await cleanup.end();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Scratch database dropped.`);
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error("\nPROOF HARNESS ERROR:", e);
  try {
    const cleanup = new Pool({ connectionString: ADMIN_URL, ssl: false });
    await cleanup.query(`DROP DATABASE IF EXISTS ${SCRATCH}`);
    await cleanup.end();
  } catch {}
  process.exit(1);
});
