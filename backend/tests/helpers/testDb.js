const pool = require("../../database/pool");

/*
|--------------------------------------------------------------------------
| Test helpers
|--------------------------------------------------------------------------
|
| Seeds two separate companies so cross-tenant isolation can be asserted
| rather than assumed. A single-company test suite cannot catch a missing
| company_id filter — the bug only shows when a second tenant exists, which
| is exactly why it survived to production in the first place.
|
| Everything is namespaced with a unique run marker and torn down
| afterwards, so a failed run cannot poison the next one.
|
*/

// process.hrtime.bigint() returns a BigInt, which Math.floor cannot take —
// convert with String() rather than Number().
const RUN_ID = `test_${process.pid}_${String(
  process.hrtime.bigint() % 1000000n
)}`;

const marker = (name) => `${RUN_ID}_${name}`;

/**
 * Creates a company with an admin, via the real registration path.
 *
 * Using the API's own flow rather than raw inserts means the fixtures
 * exercise the same code the application does.
 */
const createCompany = async (request, label) => {
  const email = `${marker(label)}@test.local`;

  const response = await request
    .post("/api/auth/register")
    .send({
      full_name: `${label} Owner`,
      email,
      password: "TestPass123!",
      company_name: marker(label),
    });

  if (!response.body?.token) {
    throw new Error(
      `Failed to create test company ${label}: ${JSON.stringify(
        response.body
      )}`
    );
  }

  return {
    label,
    email,
    token: response.body.token,
    user: response.body.user,
    companyId: response.body.user?.company_id,
    auth: (req) =>
      req.set(
        "Authorization",
        `Bearer ${response.body.token}`
      ),
  };
};

/**
 * Creates a non-admin user inside an existing company.
 */
const createMember = async (
  request,
  owner,
  { label, role = "worker" }
) => {
  const email = `${marker(label)}@test.local`;

  const created = await owner.auth(
    request.post("/api/auth/users")
  ).send({
    full_name: `${label} User`,
    email,
    password: "TestPass123!",
    role,
  });

  // Neither of these used to be checked, so a failure here surfaced much
  // later as an undefined token producing a 401, and the assertion that
  // finally failed had nothing to do with the cause.
  if (created.status >= 400) {
    throw new Error(
      `Failed to create member ${label}: ${created.status} ${JSON.stringify(
        created.body
      )}`
    );
  }

  const login = await request
    .post("/api/auth/login")
    .send({
      email,
      password: "TestPass123!",
    });

  if (!login.body?.token) {
    throw new Error(
      `Failed to sign in member ${label}: ${login.status} ${JSON.stringify(
        login.body
      )}`
    );
  }

  return {
    label,
    email,
    token: login.body.token,
    user: login.body.user,
    auth: (req) =>
      req.set(
        "Authorization",
        `Bearer ${login.body.token}`
      ),
  };
};

/**
 * Removes everything this run created.
 *
 * Companies cascade to their tenant-owned rows; users are removed by the
 * run marker in their email.
 */
const cleanup = async () => {
  await pool.query(
    `DELETE FROM companies WHERE company_name LIKE $1`,
    [`${RUN_ID}%`]
  );

  await pool.query(
    `DELETE FROM users WHERE email LIKE $1`,
    [`${RUN_ID}%`]
  );
};

/**
 * Today in the company's timezone, matching how the API compares dates.
 */
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

/**
 * A date N days before today, as YYYY-MM-DD.
 */
const daysAgo = (n) => {
  const base = Date.parse(today());

  return new Date(base - n * 86400000)
    .toISOString()
    .slice(0, 10);
};

module.exports = {
  RUN_ID,
  marker,
  createCompany,
  createMember,
  cleanup,
  today,
  daysAgo,
  pool,
};
