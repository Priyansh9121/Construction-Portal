/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Fixtures for the integration suite. Every test file builds its world
| through these helpers rather than inserting rows directly.
|
| The suite runs against a real PostgreSQL database, not a mock. That is a
| deliberate choice: the bugs these tests exist to catch — a missing
| company_id filter, a role gate that does not hold, a column that does not
| exist — are precisely the ones a mocked database cannot see.
|
| Responsibilities:
|   - Namespace every fixture with a per-run marker
|   - Create companies through the real registration endpoint
|   - Create members through the real user-creation and login endpoints
|   - Delete everything the run created
|   - Provide timezone-correct date helpers matching the API's own rules
|
| Exports:
|   RUN_ID          the unique marker for this process
|   marker()        namespaces a name with RUN_ID
|   createCompany() a company plus its admin, with a bearer token
|   createMember()  a non-admin user inside an existing company
|   cleanup()       removes everything this run created
|   today()         today in the company timezone, as YYYY-MM-DD
|   daysAgo()       a date N days back, same format
|   pool            re-exported so a test can assert directly against the
|                   database without importing the pool separately
|
| Used by:
|   all eight files in backend/tests/ — activityLog, masters, notifications,
|   paymentCalculations, portals, roleSeparation, tenantIsolation and
|   tenderChildResources.
|
| Depends on:
|   database/pool.js. Requiring it loads config/env.js, which is what puts
|   the process into the test environment.
|
| Database tables touched:
|   companies and users directly, on cleanup. Everything else is created
|   indirectly through the API endpoints the fixtures call.
|
| Note:
|   The fixtures deliberately go through HTTP rather than raw SQL. A company
|   created by direct insert could be missing whatever registration also
|   does — the company_users row, the default timezone — and the test would
|   then pass against a state the application can never actually produce.
|
*/

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
/*
 * A marker unique to this process.
 *
 * Vitest runs test files in parallel workers, each its own process, all
 * against the same database. Without a per-process prefix two workers would
 * collide on the unique email index, and worse, one worker's cleanup would
 * delete another's fixtures mid-test.
 *
 * The pid separates concurrent workers; the high-resolution clock separates
 * successive runs that happen to reuse a pid after a crash left rows
 * behind.
 */
const RUN_ID = `test_${process.pid}_${String(
  process.hrtime.bigint() % 1000000n
)}`;

/**
 * Namespaces a fixture name with this run's marker.
 *
 * Parameters:
 * name - a readable label, e.g. "alpha"
 *
 * Returns:
 * The prefixed name. Every company name and email address in the suite
 * goes through here, which is what makes the LIKE-based cleanup safe: it
 * can only ever match this run's rows.
 */
const marker = (name) => `${RUN_ID}_${name}`;

/**
 * Creates a company with an admin, via the real registration path.
 *
 * Using the API's own flow rather than raw inserts means the fixtures
 * exercise the same code the application does.
 *
 * Parameters:
 * request - the supertest agent bound to the app
 * label   - a short name, namespaced internally; use different labels for
 *           the two tenants in an isolation test
 *
 * Returns:
 * {
 *   label, email,
 *   token,      the admin's bearer token
 *   user,       the user record from the registration response
 *   companyId,  needed when a test asserts scoping directly in SQL
 *   auth(req)   attaches the bearer header; chain it as
 *               `await owner.auth(request.get("/api/tenders"))`
 * }
 *
 * Throws:
 * When registration returns no token — which means the endpoint failed.
 * Failing here rather than returning an undefined token is what keeps the
 * eventual error message about the real cause instead of a downstream 401.
 *
 * Side effects:
 * Creates a company, a user and a company_users row through
 * POST /api/auth/register.
 *
 * Notes:
 * The password is a fixed literal shared by every fixture. It only ever
 * exists in a test database, and keeping it constant means createMember can
 * log a user in without threading the password around.
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
 *
 * Purpose:
 * Role-separation tests need a worker, a manager or a subcontractor holding
 * a real token. This creates one as the company admin would, then logs in
 * as them to obtain it.
 *
 * Parameters:
 * request - the supertest agent
 * owner   - the result of createCompany; its admin token authorises the
 *           creation and determines which company the member joins
 * options - { label, role }. role defaults to "worker"; see USER_ROLES in
 *           config/constants.js for the valid set.
 *
 * Returns:
 * The same shape as createCompany minus companyId — label, email, token,
 * user and auth().
 *
 * Throws:
 * Separately for each of the two steps, so the message identifies which
 * failed. See the comment below.
 *
 * Side effects:
 * POST /api/auth/users then POST /api/auth/login.
 *
 * Business rule:
 * The new member inherits the owner's company, because the endpoint takes
 * company_id from the authenticated session rather than the body. That is
 * the behaviour under test in tenantIsolation.test.js, and it is why this
 * helper cannot create a user in an arbitrary company.
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
 *
 * Purpose:
 * Called from afterAll in each test file. Without it the shared database
 * accumulates fixtures until a later run trips a unique constraint or a
 * count assertion silently includes another run's rows.
 *
 * Parameters:
 * none
 *
 * Returns:
 * A promise resolving when both deletes have run.
 *
 * Side effects:
 * DELETEs from companies and users.
 *
 * Notes:
 * Order matters. Companies go first so their ON DELETE CASCADE removes the
 * tenant-owned rows — tenders, payments, company_users and the rest — while
 * the users still exist to be cascaded from. Users are then removed by
 * their email prefix, which catches any left without a company.
 *
 * The LIKE patterns are anchored to RUN_ID, so this can never touch another
 * worker's data or anything not created by a test.
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
 *
 * Purpose:
 * The supervisor entry-window rules turn on what "today" is, and the answer
 * depends on the company's timezone rather than the test machine's. A
 * developer in Melbourne and CI in UTC would otherwise disagree about
 * whether a date is one day old or two, and the entry-window tests would
 * fail depending on the hour.
 *
 * Parameters:
 * none
 *
 * Returns:
 * YYYY-MM-DD.
 *
 * Notes:
 * The "en-CA" locale is chosen for its format, not its language — it is the
 * one common locale whose short date is already ISO-ordered, which avoids
 * hand-assembling the string from parts.
 *
 * Asia/Kolkata is hard-coded to match DEFAULT_TIMEZONE in the environment,
 * which is what registration assigns a new company. Note that
 * DEFAULTS.COMPANY_TIMEZONE in config/constants.js says Australia/Melbourne
 * instead — the disagreement is recorded as F-04 in
 * docs/repository-reference/findings.md.
 */
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

/**
 * A date N days before today, as YYYY-MM-DD.
 *
 * Purpose:
 * Builds the backdated dates the entry-window tests need — one day inside
 * the window, one day outside it — relative to the company's today rather
 * than the machine's.
 *
 * Parameters:
 * n - how many days back
 *
 * Returns:
 * YYYY-MM-DD.
 *
 * Notes:
 * Date.parse on a bare YYYY-MM-DD is interpreted as UTC midnight, and the
 * result is then formatted back through toISOString, also UTC. Because both
 * ends use the same reference the day arithmetic is exact, and subtracting
 * whole 86400000ms steps from a midnight cannot drift across a boundary.
 *
 * Deriving the base from today() rather than Date.now() is what keeps this
 * consistent with the timezone the API is comparing against.
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
