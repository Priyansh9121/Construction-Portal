/**
 * ===========================================================================
 * BUG-002 — A WORKER CREATED IN USER MANAGEMENT REACHES THE TENDER PICKER
 * ===========================================================================
 *
 * File purpose:
 * Locks the two halves of BUG-002's fix against each other, because either
 * one alone is a regression.
 *
 * The bug: a worker created through User Management never appeared in a
 * tender's worker picker, so they could not be assigned to a tender.
 *
 * The cause was not the picker. `GET /workers` is
 * `SELECT t.* FROM workers t WHERE t.company_id = $1` — one table, no join
 * to `users` — so a worker who exists only as a `users` row is invisible to
 * it by construction. Two creation paths each wrote half the record: User
 * Management wrote `users` + `company_users` and no register row; Workforce
 * wrote `workers` and no login. `user_id` had always existed on the register
 * and had always been writable. Nothing in the product ever set it.
 *
 * WHAT EACH TEST GUARDS
 *
 *   1. The reported bug. A login created in User Management now resolves a
 *      `workers` row, so the picker can see them.
 *
 *   2. The over-correction. A payroll-only worker — no login at all — is
 *      still valid and still appears in the picker. `worker.controller.js`
 *      says so of its own column: "Most workers have none — they exist as
 *      payroll records only." If a later change makes the link mandatory in
 *      both directions, this fails.
 *
 * The direction is asymmetric on purpose. A role-bearing login MUST have a
 * register record; a register record need NEVER have a login. Test 2 is the
 * one that keeps the second half true.
 *
 * ---------------------------------------------------------------------------
 * SAFETY — READ BEFORE RUNNING
 * ---------------------------------------------------------------------------
 * Unlike the responsive suites, this one WRITES: it creates users, workers
 * and a tender. It must only ever be pointed at a local development stack —
 * assertLocalTarget() refuses to start otherwise.
 *
 * Everything it creates is tagged with a unique run marker in the name and
 * email, so a failed run leaves identifiable rows rather than mystery data.
 *
 * ---------------------------------------------------------------------------
 * SETUP
 * ---------------------------------------------------------------------------
 *   cd backend  && RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000 npm start
 *   cd frontend && npm run dev
 *   cd frontend && LOCAL_ADMIN_FIXTURE_PASSWORD=... \
 *                  npx playwright test tests/worker-profile-link.spec.js
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";

import {
  API_URL,
  assertLocalTarget,
  assertServerFresh,
  login,
} from "./support/fixtures.js";

assertLocalTarget();

const RUN = `e2e${Date.now()}`;

let admin;
let api;

/*
 * The specs drive the API rather than the User Management form.
 *
 * That is deliberate and worth stating, because it is a real limitation. The
 * bug lived in what the two creation paths WROTE, not in how the form looked,
 * and the picker's blindness was a property of its SQL. Asserting through the
 * API pins the behaviour that actually broke, and keeps this suite meaningful
 * if the form is redesigned — which is likely, since the branch it lives on
 * is a UI redesign.
 *
 * The form's own wiring is covered by the field-level check at the end.
 */
const authed = (headers = {}) => ({
  ...headers,
  Authorization: `Bearer ${admin.token}`,
});

test.beforeAll(async () => {
  /*
   * Before anything else. This suite's whole purpose is to say whether a
   * backend fix works, so a stale API process would make it answer
   * confidently about code that is not running. It has done exactly that.
   */
  await assertServerFresh(playwrightRequest);

  admin = await login(playwrightRequest, "admin");
  api = await playwrightRequest.newContext();
});

test.afterAll(async () => {
  await api?.dispose();
});

/** The picker's real data source: GET /workers, unfiltered by any join. */
const fetchPickerWorkers = async () => {
  const res = await api.get(`${API_URL}/api/workers?limit=200`, {
    headers: authed(),
  });

  expect(res.status()).toBe(200);

  const body = await res.json();

  return body.workers || body.data || [];
};

test.describe("BUG-002 — the two creation paths meet in the picker", () => {
  /*
   * The reported bug, end to end. Before the fix this created a users row
   * and nothing else, and the assertion below found no worker.
   */
  test("a User Management worker appears in the worker picker", async () => {
    const email = `${RUN}-um@profilelink.local`;
    const name = `${RUN} UM Worker`;

    const created = await api.post(`${API_URL}/api/auth/users`, {
      headers: authed(),
      data: {
        full_name: name,
        email,
        password: "TestPass123!",
        role: "worker",
        profile: {
          mode: "create",
          full_name: name,
          phone: "9800000101",
        },
      },
    });

    expect(created.status()).toBe(201);

    const body = await created.json();

    // The link is reported, rather than left for someone to go and check.
    expect(body.profile_id).toBeTruthy();

    const workers = await fetchPickerWorkers();

    const found = workers.find(
      (worker) => worker.id === body.profile_id
    );

    expect(
      found,
      "a worker created through User Management must be visible to the tender picker"
    ).toBeTruthy();

    expect(found.full_name).toBe(name);
    expect(found.user_id).toBe(body.user.id);
  });

  /*
   * The over-correction guard. The fix must not have made a login
   * compulsory: most workers are payroll records and never sign in.
   */
  test("a payroll-only worker with no login still appears in the picker", async () => {
    const name = `${RUN} Payroll Only`;

    const created = await api.post(`${API_URL}/api/workers`, {
      headers: authed(),
      data: {
        full_name: name,
        phone: "9800000102",
        salary: 750,
        role: "Mason",
        status: "active",
      },
    });

    expect(
      created.status(),
      "creating a worker without a login must still be allowed"
    ).toBeLessThan(400);

    const body = await created.json();
    const workerId = body.worker?.id ?? body.data?.id;

    const workers = await fetchPickerWorkers();

    const found = workers.find(
      (worker) => worker.id === workerId
    );

    expect(found).toBeTruthy();

    // The point of the test: no login, and that is a valid worker.
    expect(found.user_id).toBeFalsy();
  });

  /*
   * The refusal that replaced the silent breakage. Creating a worker login
   * with no register instruction used to succeed and produce an unusable
   * account; it is now rejected before anything is written.
   */
  test("a worker login with no record is refused, and writes nothing", async () => {
    const email = `${RUN}-orphan@profilelink.local`;

    const created = await api.post(`${API_URL}/api/auth/users`, {
      headers: authed(),
      data: {
        full_name: `${RUN} Orphan`,
        email,
        password: "TestPass123!",
        role: "worker",
      },
    });

    expect(created.status()).toBe(400);

    // And the account was not left behind: the same address is still free.
    const retry = await api.post(`${API_URL}/api/auth/users`, {
      headers: authed(),
      data: {
        full_name: `${RUN} Orphan`,
        email,
        password: "TestPass123!",
        role: "worker",
        profile: {
          mode: "create",
          full_name: `${RUN} Orphan`,
        },
      },
    });

    expect(
      retry.status(),
      "the refused attempt must not have consumed the email address"
    ).toBe(201);
  });

  /*
   * Link-existing is the primary path — payroll first, portal access later.
   * The worker is already in the picker; linking must not create a second
   * row, and must not disturb the payroll data already on the first.
   */
  test("linking an existing payroll worker keeps one row and its salary", async () => {
    const name = `${RUN} Link Later`;

    const worker = await api.post(`${API_URL}/api/workers`, {
      headers: authed(),
      data: {
        full_name: name,
        phone: "9800000103",
        salary: 1200,
        role: "Carpenter",
        status: "active",
      },
    });

    const body = await worker.json();
    const workerId = body.worker?.id ?? body.data?.id;

    const linked = await api.post(`${API_URL}/api/auth/users`, {
      headers: authed(),
      data: {
        full_name: name,
        email: `${RUN}-link@profilelink.local`,
        password: "TestPass123!",
        role: "worker",
        profile: { mode: "link", id: workerId },
      },
    });

    expect(linked.status()).toBe(201);

    const linkedBody = await linked.json();

    expect(linkedBody.profile_id).toBe(workerId);

    const workers = await fetchPickerWorkers();

    const matches = workers.filter(
      (candidate) => candidate.full_name === name
    );

    expect(
      matches,
      "linking must not create a second register row"
    ).toHaveLength(1);

    expect(matches[0].user_id).toBe(linkedBody.user.id);
    expect(Number(matches[0].salary)).toBe(1200);
  });
});

/*
| The form's own wiring. The API tests above prove the behaviour; this proves
| User Management actually asks for the record, so the fix cannot be bypassed
| by the screen that caused the bug.
*/
test.describe("the User Management form asks for the record", () => {
  test("the profile control appears for a worker and not for a manager", async ({
    page,
    context,
  }) => {
    await context.addInitScript(
      ([token, user]) => {
        localStorage.setItem("token", token);
        localStorage.setItem("user", user);
      },
      [admin.token, JSON.stringify(admin.user)]
    );

    await page.goto("/users");

    const roleSelect = page.locator('select[name="role"]').first();

    await expect(roleSelect).toBeVisible({ timeout: 15000 });

    /*
     * Scoped to the control's own class rather than its text. The users
     * table below now carries "No worker record — link one" markers for
     * accounts that predate the fix, and a text locator matches those too.
     */
    const profileField = page.locator(".profile-link-field");

    // Worker: the register control is present, and defaults to linking.
    await roleSelect.selectOption("worker");

    await expect(profileField).toHaveCount(1);
    await expect(
      profileField.getByRole("option", {
        name: /Link an existing worker/i,
      })
    ).toHaveCount(1);

    // Manager: it is absent, because that role has no register.
    await roleSelect.selectOption("manager");

    await expect(profileField).toHaveCount(0);

    // Subcontractor: the same control, through the same code.
    await roleSelect.selectOption("subcontractor");

    await expect(profileField).toHaveCount(1);
    await expect(
      profileField.getByRole("option", {
        name: /Link an existing subcontractor/i,
      })
    ).toHaveCount(1);
  });
});
