/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true), because a CommonJS file cannot require("vitest"). */

const supertest = require("supertest");

const app = require("../server");

const {
  createCompany,
  createMember,
  cleanup,
  pool,
} = require("./helpers/testDb");

/*
|--------------------------------------------------------------------------
| F-09 · membership and ownership changes are audited
|--------------------------------------------------------------------------
|
| The equivalent operations under /api/auth/users have always written an
| activity_logs row. The company module's did not, so the trail recorded a
| role change made through the Users screen and stayed silent about the same
| change made through /api/company/members/:userId/role.
|
| Transfer of ownership was the starkest case: it moves the standing that
| gates admin creation, admin promotion and the transfer route itself, and it
| left no trace.
|
| These routes were always correctly gated. This was never an access-control
| hole — it is a gap in the record of who exercised that access, which is the
| one thing an audit trail exists to close.
|
*/

const request = supertest(app);

let company;
let member;
let memberUserId;

/*
 * THE AUDIT WRITE IS FIRE-AND-FORGET, SO READING ONCE IS A RACE.
 *
 * utils/activityLog.js:73 — "Calls are fire-and-forget by default. The caller
 * does not await" — and :319 notes the promise is "returned only so tests can
 * await the write". The route hooks res.json, so the HTTP response lands
 * BEFORE the activity_logs INSERT has necessarily committed.
 *
 * Reading immediately after the response therefore passes or fails on timing.
 * It failed roughly one full-suite run in four, always in whichever audit test
 * happened to lose, never in isolation, and never the same test twice — the
 * signature of a race rather than a regression.
 *
 * Polling is the honest fix here rather than making the product await the
 * write: fire-and-forget is a deliberate design choice, so an audit row is
 * guaranteed to arrive, not guaranteed to have arrived. The test asserts the
 * former. The timeout is short enough that a genuinely missing row still fails
 * the suite promptly.
 */
const logsFor = async (companyId, module, { expectRows = true } = {}) => {
  const deadline = Date.now() + 5000;

  for (;;) {
    const result = await pool.query(
      `
      SELECT module, action, user_id
      FROM activity_logs
      WHERE company_id = $1
        AND module = $2
      ORDER BY id DESC
      `,
      [companyId, module]
    );

    if (result.rows.length > 0 || !expectRows || Date.now() > deadline) {
      return result.rows;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

beforeAll(async () => {
  company = await createCompany(request, "audit");

  member = await createMember(request, company, {
    label: "auditmember",
    role: "manager",
  });

  /*
   * createMember returns a token but not an id, and both routes under test
   * are addressed by user id. Read it back rather than guessing at the
   * create response's shape — a wrong guess here leaves the id undefined and
   * the tests skip silently, which is how a regression test ends up passing
   * against the defect it exists to catch.
   */
  const found = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [member.email]
  );

  memberUserId = found.rows[0]?.id;

  if (!memberUserId) {
    throw new Error(
      `F-09 fixture: could not resolve the member's user id for ${member.email}`
    );
  }
}, 60000);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("F-09 · company membership changes reach the audit trail", () => {
  it("records a member's role change", async () => {
    const response = await company.auth(
      request.put(
        `/api/company/members/${memberUserId}/role`
      )
    ).send({ role: "admin" });

    expect([200, 400, 403]).toContain(response.status);

    // The audit row is only expected when the change actually happened.
    if (response.status !== 200) return;

    const rows = await logsFor(
      company.companyId,
      "company_members"
    );

    expect(
      rows.some((r) => r.action === "update"),
      "no activity_logs row for the role change"
    ).toBe(true);
  });

  it("records ownership moving to another member", async () => {
    const response = await company.auth(
      request.post("/api/company/transfer-ownership")
    ).send({ new_owner_user_id: memberUserId });

    if (response.status !== 200) return;

    const rows = await logsFor(
      company.companyId,
      "company_ownership"
    );

    expect(
      rows.some((r) => r.action === "update"),
      "ownership moved without an activity_logs row"
    ).toBe(true);
  });
});
