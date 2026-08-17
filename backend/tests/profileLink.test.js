/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.mjs), because a CommonJS file cannot
   require("vitest") directly. */

const supertest = require("supertest");

const app = require("../server");

const {
  createCompany,
  cleanup,
  pool,
} = require("./helpers/testDb");

/*
|--------------------------------------------------------------------------
| A login and the register row that gives it meaning — BUG-002
|--------------------------------------------------------------------------
|
| The reported symptom was that a worker created through User Management
| never appeared in a tender's worker picker, so they could not be assigned.
|
| The cause was not the picker. `GET /workers` is
| `SELECT t.* FROM workers t WHERE t.company_id = $1` — one table, no join to
| users — so a worker who exists only as a `users` row is invisible to it by
| construction. Two creation paths each wrote half the record: User
| Management wrote `users` + `company_users` and no profile; Workforce wrote
| `workers` and no login.
|
| What was actually missing was the operation that joins them. `user_id` had
| always existed on both registers and had always been writable; nothing in
| the product ever set it, and the only writer in the repository was a local
| dev fixture script.
|
| These tests assert the primitive that closes it, and — just as important —
| that it did not close too much. A worker with no login must stay valid,
| because most workers are payroll records only.
|
| The subcontractor side is exercised deliberately. It is the same code
| reached through a different key in PROFILE_FOR_ROLE, and asserting it here
| is what would catch someone reimplementing it as a branch.
|
*/

const request = supertest(app);

let office;

const NEW_LOGIN = {
  password: "TestPass123!",
};

const createUser = (body) =>
  office.auth(request.post("/api/auth/users")).send({
    ...NEW_LOGIN,
    ...body,
  });

const email = (label) =>
  `${label}-${Date.now()}-${Math.floor(
    Math.random() * 100000
  )}@profilelink.test.local`;

beforeAll(async () => {
  office = await createCompany(request, "profilelink");
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("a role-bearing login must resolve a profile", () => {
  it("refuses a worker login with no profile instruction", async () => {
    const res = await createUser({
      full_name: "Unlinked Worker",
      email: email("unlinked-worker"),
      role: "worker",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/worker record/i);
  });

  it("refuses a subcontractor login with no profile instruction", async () => {
    const res = await createUser({
      full_name: "Unlinked Sub",
      email: email("unlinked-sub"),
      role: "subcontractor",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/subcontractor record/i);
  });

  /*
   * The asymmetry, asserted. admin and manager are absent from
   * PROFILE_FOR_ROLE and must be unaffected by omission — if adding a role
   * to that map ever started requiring an exception for these, this fails.
   */
  it("leaves manager and admin untouched", async () => {
    const res = await createUser({
      full_name: "Office Manager",
      email: email("manager"),
      role: "manager",
    });

    expect(res.status).toBe(201);
    expect(res.body.profile_id).toBeNull();
  });

  /*
   * The failure has to happen before the account exists, not alongside it.
   * A rejected request that still left a users row would be the same bug in
   * a new shape.
   */
  it("writes no users row when the profile is refused", async () => {
    const address = email("rolled-back");

    const res = await createUser({
      full_name: "Rolled Back",
      email: address,
      role: "worker",
    });

    expect(res.status).toBe(400);

    const found = await pool.query(
      "SELECT id FROM public.users WHERE email = $1",
      [address]
    );

    expect(found.rows).toHaveLength(0);
  });
});

describe("create-new resolves a usable profile", () => {
  it("creates the worker row and reports its id", async () => {
    const res = await createUser({
      full_name: "Created Worker",
      email: email("created-worker"),
      role: "worker",
      profile: {
        mode: "create",
        full_name: "Created Worker",
        phone: "9800000001",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.profile_id).toBeTruthy();

    const worker = await pool.query(
      "SELECT full_name, user_id, salary FROM public.workers WHERE id = $1",
      [res.body.profile_id]
    );

    expect(worker.rows[0].user_id).toBe(res.body.user.id);
    expect(worker.rows[0].full_name).toBe("Created Worker");

    /*
     * No salary was collected, and none was invented. An admin issuing a
     * login has no business knowing anyone's pay; the payroll screen fills
     * this in later.
     */
    expect(worker.rows[0].salary).toBeNull();
  });

  it("creates the subcontractor row through the same code", async () => {
    const res = await createUser({
      full_name: "Created Sub",
      email: email("created-sub"),
      role: "subcontractor",
      profile: {
        mode: "create",
        full_name: "Created Sub",
        phone: "9800000002",
      },
    });

    expect(res.status).toBe(201);

    const sub = await pool.query(
      "SELECT full_name, user_id FROM public.subcontractors WHERE id = $1",
      [res.body.profile_id]
    );

    expect(sub.rows[0].user_id).toBe(res.body.user.id);
  });

  it("needs a name for the new record", async () => {
    const res = await createUser({
      full_name: "No Profile Name",
      email: email("no-profile-name"),
      role: "worker",
      profile: { mode: "create" },
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name is required/i);
  });
});

/*
| The primary path. Payroll comes first in practice: a worker is on the
| register for weeks, then someone decides they need portal access. In that
| case no phone and no salary are collected at all — the row already has
| them.
*/
describe("link-existing is the primary path", () => {
  let payrollWorkerId;

  beforeAll(async () => {
    const created = await office
      .auth(request.post("/api/workers"))
      .send({
        full_name: "Payroll First",
        phone: "9800000003",
        salary: 900,
        role: "Mason",
        status: "active",
      });

    payrollWorkerId =
      created.body?.worker?.id ?? created.body?.data?.id;

    expect(payrollWorkerId).toBeTruthy();
  });

  it("links the existing row rather than creating a second one", async () => {
    const res = await createUser({
      full_name: "Payroll First",
      email: email("payroll-first"),
      role: "worker",
      profile: {
        mode: "link",
        id: payrollWorkerId,
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.profile_id).toBe(payrollWorkerId);

    const worker = await pool.query(
      "SELECT user_id, salary FROM public.workers WHERE id = $1",
      [payrollWorkerId]
    );

    expect(worker.rows[0].user_id).toBe(res.body.user.id);

    // The payroll data it already had is untouched.
    expect(Number(worker.rows[0].salary)).toBe(900);
  });

  it("refuses to link a record that already has a login", async () => {
    const res = await createUser({
      full_name: "Second Claim",
      email: email("second-claim"),
      role: "worker",
      profile: {
        mode: "link",
        id: payrollWorkerId,
      },
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already has a login/i);
  });

  it("reports an unknown record as not found", async () => {
    const res = await createUser({
      full_name: "Ghost Link",
      email: email("ghost-link"),
      role: "worker",
      profile: {
        mode: "link",
        id: 987654321,
      },
    });

    expect(res.status).toBe(404);
  });

  /*
   * The company scope comes from the session, so an admin cannot reach
   * another tenant's register. Reported as 404 rather than 403, matching
   * scopedCrud — a 403 would confirm the row exists.
   */
  it("cannot link a record belonging to another company", async () => {
    const other = await createCompany(
      request,
      "profilelinkother"
    );

    const foreign = await other
      .auth(request.post("/api/workers"))
      .send({
        full_name: "Foreign Worker",
        phone: "9800000004",
        salary: 700,
        role: "Mason",
        status: "active",
      });

    const foreignId =
      foreign.body?.worker?.id ?? foreign.body?.data?.id;

    expect(foreignId).toBeTruthy();

    const res = await createUser({
      full_name: "Cross Tenant",
      email: email("cross-tenant"),
      role: "worker",
      profile: {
        mode: "link",
        id: foreignId,
      },
    });

    expect(res.status).toBe(404);

    const untouched = await pool.query(
      "SELECT user_id FROM public.workers WHERE id = $1",
      [foreignId]
    );

    expect(untouched.rows[0].user_id).toBeNull();
  });
});

/*
| The over-correction guard. The direction is asymmetric on purpose: a
| role-bearing login must have a profile, but a profile need never have a
| login. worker.controller.js says so of its own column — "Most workers have
| none — they exist as payroll records only."
|
| If a later change makes the link mandatory in both directions, this fails.
*/
describe("a profile still needs no login", () => {
  it("creates a payroll-only worker with no user_id", async () => {
    const res = await office
      .auth(request.post("/api/workers"))
      .send({
        full_name: "Payroll Only",
        phone: "9800000005",
        salary: 850,
        role: "Helper",
        status: "active",
      });

    expect(res.status).toBeLessThan(400);

    const id = res.body?.worker?.id ?? res.body?.data?.id;

    const worker = await pool.query(
      "SELECT user_id FROM public.workers WHERE id = $1",
      [id]
    );

    expect(worker.rows[0].user_id).toBeNull();
  });

  /*
   * Salary stopped being required so that a worker created alongside a
   * login could be edited afterwards. validateWorker runs on PUT as well as
   * POST, so while it was required such a row was frozen: changing a phone
   * number would 400 demanding a figure somebody had to invent.
   */
  it("accepts a worker with no salary, and can still edit them", async () => {
    const created = await office
      .auth(request.post("/api/workers"))
      .send({
        full_name: "No Salary",
        phone: "9800000006",
        role: "Helper",
        status: "active",
      });

    expect(created.status).toBeLessThan(400);

    const id =
      created.body?.worker?.id ?? created.body?.data?.id;

    const edited = await office
      .auth(request.put(`/api/workers/${id}`))
      .send({
        full_name: "No Salary",
        phone: "9800000007",
        role: "Helper",
        status: "active",
      });

    expect(edited.status).toBeLessThan(400);
  });

  it("still rejects a salary that is present but not positive", async () => {
    const res = await office
      .auth(request.post("/api/workers"))
      .send({
        full_name: "Negative Salary",
        phone: "9800000008",
        salary: -5,
        role: "Helper",
        status: "active",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/greater than 0/i);
  });
});

/*
| Repair. The two orphans in the development database predate the fix, and
| production will have its own. They are found by the users list, which now
| reports whether a role needs a profile and whether it has one.
*/
describe("the users list reports the link", () => {
  it("marks a linked worker as requiring a profile and having one", async () => {
    const created = await createUser({
      full_name: "Listed Worker",
      email: email("listed-worker"),
      role: "worker",
      profile: {
        mode: "create",
        full_name: "Listed Worker",
      },
    });

    expect(created.status).toBe(201);

    const list = await office.auth(
      request.get("/api/auth/users")
    );

    const row = list.body.users.find(
      (user) => user.id === created.body.user.id
    );

    expect(row.requires_profile).toBe(true);
    expect(row.profile_id).toBe(created.body.profile_id);
  });

  it("reports a manager as needing no profile", async () => {
    const created = await createUser({
      full_name: "Listed Manager",
      email: email("listed-manager"),
      role: "manager",
    });

    const list = await office.auth(
      request.get("/api/auth/users")
    );

    const row = list.body.users.find(
      (user) => user.id === created.body.user.id
    );

    expect(row.requires_profile).toBe(false);
    expect(row.profile_id).toBeNull();
  });

  /*
   * An orphan is requires_profile true with profile_id null. It cannot be
   * made through the API any more, so it is written directly — which is
   * exactly how the two in the development database came to exist.
   */
  it("shows a directly-inserted orphan as unlinked, and repairs it", async () => {
    const address = email("orphan");

    const inserted = await pool.query(
      `
      INSERT INTO public.users (full_name, email, password_hash, role, status)
      VALUES ($1, $2, 'x', 'worker', 'active')
      RETURNING id
      `,
      ["Orphan Worker", address]
    );

    const orphanId = inserted.rows[0].id;

    await pool.query(
      `
      INSERT INTO public.company_users (company_id, user_id, role, created_at)
      VALUES ($1, $2, 'worker', now())
      `,
      [office.companyId, orphanId]
    );

    const list = await office.auth(
      request.get("/api/auth/users")
    );

    const row = list.body.users.find(
      (user) => user.id === orphanId
    );

    expect(row.requires_profile).toBe(true);
    expect(row.profile_id).toBeNull();

    /*
     * The repair. Which human an orphan belongs to is not a question a
     * migration could answer, so it is an admin action rather than a script.
     */
    const repaired = await office
      .auth(
        request.put(
          `/api/auth/users/${orphanId}/profile`
        )
      )
      .send({
        profile: {
          mode: "create",
          full_name: "Orphan Worker",
        },
      });

    expect(repaired.status).toBe(200);
    expect(repaired.body.profile_id).toBeTruthy();

    const after = await office.auth(
      request.get("/api/auth/users")
    );

    const fixed = after.body.users.find(
      (user) => user.id === orphanId
    );

    expect(fixed.profile_id).toBe(
      repaired.body.profile_id
    );

    // And it cannot be linked twice.
    const again = await office
      .auth(
        request.put(
          `/api/auth/users/${orphanId}/profile`
        )
      )
      .send({
        profile: {
          mode: "create",
          full_name: "Orphan Worker",
        },
      });

    expect(again.status).toBe(409);
  });

  it("refuses to link a role that has no register", async () => {
    const manager = await createUser({
      full_name: "Unlinkable Manager",
      email: email("unlinkable-manager"),
      role: "manager",
    });

    const res = await office
      .auth(
        request.put(
          `/api/auth/users/${manager.body.user.id}/profile`
        )
      )
      .send({
        profile: {
          mode: "create",
          full_name: "Nope",
        },
      });

    expect(res.status).toBe(400);
  });
});
