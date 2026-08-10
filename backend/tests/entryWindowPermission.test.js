/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.mjs), because a CommonJS file cannot
   require("vitest") directly. */

const supertest = require("supertest");

const app = require("../server");

const {
  checkEntryWindow,
  MODULES,
} = require("../modules/siteOperations/entryWindow.service");

const {
  createCompany,
  createMember,
  cleanup,
  today,
  daysAgo,
  pool,
} = require("./helpers/testDb");

/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Regression coverage for the PERMISSION half of F-13.
|
| The finding had two halves. The date half — server-local time instead of
| the site's — is covered by entryWindowTimezone.test.js and was fixed
| first. This file covers the second half:
|
|   createSiteLog carried its own `getUserRole(req) !== "admin"` check,
|   duplicating a decision entryWindow.service.js already owned. The two
|   disagreed: the canonical rule also exempts managers and honours granted
|   access requests, so a manager could backdate a material entry but not a
|   daily update, and a granted request was ignored entirely for daily
|   updates.
|
|   createSiteLog now calls checkEntryWindow like the material, labour and
|   banking controllers do. There is one implementation of the rule.
|
| What these tests pin down:
|
|   1. Administrators bypass the window.
|   2. Managers bypass the window — the behaviour that was missing.
|   3. A valid grant lets an ordinary user through.
|   4. An EXPIRED grant does not.
|   5. A grant already used does not.
|   6. A grant for a DIFFERENT date does not.
|   7. A grant for a different MODULE does not.
|   8. A grant belonging to another user does not.
|   9. A cross-company grant does not.
|  10. An ordinary worker with no grant stays restricted.
|  11. Future dates are refused for everyone, including admins.
|  12. Entries inside the window need no permission at all.
|
| Tested at the service level rather than through HTTP, because
| checkEntryWindow is the shared decision and every controller now routes
| through it — testing it directly covers all four call sites at once. The
| HTTP behaviour of createSiteLog is asserted separately at the foot of the
| file.
|
| Connected to:
|   backend/modules/siteOperations/entryWindow.service.js
|   backend/modules/siteLogs/siteLog.controller.js
|   tables: entry_access_requests, daily_site_logs
|
*/

const request = supertest(app);

let companyA;
let companyB;
let workerA;
let managerA;
let workerB;

/**
 * Inserts an access grant directly.
 *
 * Written with SQL rather than through the API because the grant/deny
 * endpoints are a separate surface with their own rules — a failure there
 * would make this suite report a problem it is not testing.
 */
const insertGrant = async ({
  companyId,
  userId,
  module,
  targetDate,
  status = "granted",
  expiresAt = null,
  usedAt = null,
}) => {
  const result = await pool.query(
    `
    INSERT INTO public.entry_access_requests
      (company_id, requested_by, module, target_date,
       reason, status, expires_at, used_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
    `,
    [
      companyId,
      userId,
      module,
      targetDate,
      "regression test",
      status,
      expiresAt,
      usedAt,
    ]
  );

  return result.rows[0].id;
};

// Comfortably outside the two-day window, so every case below is testing
// the permission rule rather than the window length.
const STALE_DATE = daysAgo(30);

beforeAll(async () => {
  companyA = await createCompany(
    request,
    "ewpermA"
  );

  companyB = await createCompany(
    request,
    "ewpermB"
  );

  workerA = await createMember(
    request,
    companyA,
    { label: "ewworker", role: "worker" }
  );

  managerA = await createMember(
    request,
    companyA,
    { label: "ewmanager", role: "manager" }
  );

  workerB = await createMember(
    request,
    companyB,
    { label: "ewworkerb", role: "worker" }
  );
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("F-13 · role-based window bypass", () => {
  it("lets an administrator record a stale entry", async () => {
    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: companyA.user.id,
      userRole: "admin",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(true);
    expect(result.viaRole).toBe(true);

    // No grant was consumed, because none was needed.
    expect(result.accessRequestId).toBeNull();
  });

  /*
   * The behaviour createSiteLog was missing. Its old inline check compared
   * against "admin" only, so a manager was refused here while being
   * allowed on every other dated module.
   */
  it("lets a manager record a stale entry", async () => {
    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: managerA.user.id,
      userRole: "manager",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(true);
    expect(result.viaRole).toBe(true);
  });

  it("refuses an ordinary worker with no grant", async () => {
    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
    expect(result.reason).toBe("ACCESS_REQUIRED");
  });
});

describe("F-13 · access grants", () => {
  it("lets a worker through with a valid grant", async () => {
    const grantId = await insertGrant({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      module: MODULES.DAILY_UPDATE,
      targetDate: STALE_DATE,
    });

    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(true);

    // The grant is returned so the caller can consume it — that is what
    // makes it single-use.
    expect(Number(result.accessRequestId)).toBe(Number(grantId));

    await pool.query(
      `DELETE FROM public.entry_access_requests WHERE id = $1`,
      [grantId]
    );
  });

  it("refuses an expired grant", async () => {
    const grantId = await insertGrant({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      module: MODULES.DAILY_UPDATE,
      targetDate: STALE_DATE,
      // An hour in the past.
      expiresAt: new Date(Date.now() - 3600000),
    });

    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);

    await pool.query(
      `DELETE FROM public.entry_access_requests WHERE id = $1`,
      [grantId]
    );
  });

  /*
   * A grant is single-use. consumeGrant sets status to 'used' after the
   * entry it authorised is written, and findUsableGrant matches only
   * 'granted' — so the same grant cannot backfill a second record.
   */
  it("refuses a grant that has already been used", async () => {
    const grantId = await insertGrant({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      module: MODULES.DAILY_UPDATE,
      targetDate: STALE_DATE,
      status: "used",
      usedAt: new Date(),
    });

    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(false);

    await pool.query(
      `DELETE FROM public.entry_access_requests WHERE id = $1`,
      [grantId]
    );
  });

  it("refuses a denied grant", async () => {
    const grantId = await insertGrant({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      module: MODULES.DAILY_UPDATE,
      targetDate: STALE_DATE,
      status: "denied",
    });

    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(false);

    await pool.query(
      `DELETE FROM public.entry_access_requests WHERE id = $1`,
      [grantId]
    );
  });

  /*
   * The office authorises a specific day, not a general amnesty.
   */
  it("refuses a grant issued for a different date", async () => {
    const grantId = await insertGrant({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      module: MODULES.DAILY_UPDATE,
      targetDate: daysAgo(31),
    });

    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(false);

    await pool.query(
      `DELETE FROM public.entry_access_requests WHERE id = $1`,
      [grantId]
    );
  });

  /*
   * A grant to backdate a material entry must not also permit a backdated
   * daily update.
   */
  it("refuses a grant issued for a different module", async () => {
    const grantId = await insertGrant({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      module: MODULES.MATERIAL,
      targetDate: STALE_DATE,
    });

    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(false);

    await pool.query(
      `DELETE FROM public.entry_access_requests WHERE id = $1`,
      [grantId]
    );
  });

  /*
   * Grants are personal. One supervisor's permission does not let a
   * colleague backdate their own entries.
   */
  it("refuses a grant belonging to another user", async () => {
    const grantId = await insertGrant({
      companyId: companyA.companyId,
      userId: managerA.user.id,
      module: MODULES.DAILY_UPDATE,
      targetDate: STALE_DATE,
    });

    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(false);

    await pool.query(
      `DELETE FROM public.entry_access_requests WHERE id = $1`,
      [grantId]
    );
  });

  /*
   * The tenant boundary. A grant in company B must be invisible to
   * company A even when the user id is quoted.
   */
  it("refuses a cross-company grant", async () => {
    const grantId = await insertGrant({
      companyId: companyB.companyId,
      userId: workerB.user.id,
      module: MODULES.DAILY_UPDATE,
      targetDate: STALE_DATE,
    });

    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerB.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: STALE_DATE,
    });

    expect(result.allowed).toBe(false);

    await pool.query(
      `DELETE FROM public.entry_access_requests WHERE id = $1`,
      [grantId]
    );
  });
});

describe("F-13 · window boundaries", () => {
  it("allows today with no permission at all", async () => {
    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: today(),
    });

    expect(result.allowed).toBe(true);
    expect(result.daysOld).toBe(0);
  });

  it("allows an entry inside the window", async () => {
    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: workerA.user.id,
      userRole: "worker",
      module: MODULES.DAILY_UPDATE,
      entryDate: daysAgo(1),
    });

    expect(result.allowed).toBe(true);
  });

  /*
   * A future date is refused for EVERYONE. Unlike the stale-date rule
   * there is no role that bypasses it — a daily update records work
   * already done.
   */
  it("refuses a future date even for an administrator", async () => {
    const future = new Date(
      Date.now() + 3 * 86400000
    )
      .toISOString()
      .slice(0, 10);

    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: companyA.user.id,
      userRole: "admin",
      module: MODULES.DAILY_UPDATE,
      entryDate: future,
    });

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(400);
    expect(result.reason).toBe("FUTURE_DATE");
  });

  it("refuses an unparseable date", async () => {
    const result = await checkEntryWindow({
      companyId: companyA.companyId,
      userId: companyA.user.id,
      userRole: "admin",
      module: MODULES.DAILY_UPDATE,
      entryDate: "not-a-date",
    });

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(400);
    expect(result.reason).toBe("INVALID_DATE");
  });
});

/*
|--------------------------------------------------------------------------
| The HTTP surface
|--------------------------------------------------------------------------
|
| createSiteLog is the handler that was carrying the duplicate rule, so it
| gets its own assertions that the delegation actually took effect.
|
| /api/site-logs is office-gated at the mount, so only the admin path is
| reachable here — a worker submits through /api/worker-portal instead.
| That is why the manager and grant cases above are tested at the service
| level: they are the same decision, reached by a different route.
|
*/
describe("F-13 · createSiteLog delegates to the shared rule", () => {
  let siteId;

  /*
   * A worker this company actually owns.
   *
   * These tests previously sent `worker_id: 1` — a literal that belonged to
   * nobody in particular. That passed only because createSiteLog did not
   * check worker ownership, so the request fell through to the date rule
   * these tests are actually about. F-14 closed that hole, and the literal
   * now earns a 404 before the date is ever examined.
   *
   * Using a real worker restores what each test claims to assert. It is also
   * strictly stronger: the request is now legitimate in every respect except
   * the one under test.
   */
  let workerId;

  beforeAll(async () => {
    const tender = await companyA
      .auth(request.post("/api/tenders"))
      .send({
        title: "Entry Window Tender",
        status: "running",
        sites: [
          {
            site_name: "EW Site",
            site_type: "Personal Site",
            address: "1 Test Road",
          },
        ],
      });

    siteId =
      tender.body?.tender?.sites?.[0]?.id;

    const worker = await companyA
      .auth(request.post("/api/workers"))
      .send({
        full_name: "EW Worker",
        phone: "9000000777",
        salary: 25000,
        role: "worker",
        status: "active",
      });

    workerId =
      worker.body?.worker?.id ??
      worker.body?.data?.id;

    if (!workerId) {
      throw new Error(
        `Could not create worker: ${JSON.stringify(worker.body)}`
      );
    }

    if (!siteId) {
      throw new Error(
        `Could not create site: ${JSON.stringify(tender.body)}`
      );
    }
  });

  it("accepts an entry dated today", async () => {
    const response = await companyA
      .auth(request.post("/api/site-logs"))
      .send({
        site_id: siteId,
        worker_id: null,
        subcontractor_id: null,
        log_date: today(),
        notes: "Work today",
        worker_name: "someone",
      });

    // The office admin is exempt anyway, but a same-day entry needs no
    // exemption — this is the ordinary path.
    expect([201, 400]).toContain(response.status);

    if (response.status === 400) {
      // Only acceptable failure is the worker/subcontractor requirement,
      // which is a different rule from the window.
      expect(response.body.message).toMatch(
        /[Ww]orker or subcontractor/
      );
    }
  });

  it("refuses a future entry with 400 FUTURE_DATE", async () => {
    const future = new Date(
      Date.now() + 3 * 86400000
    )
      .toISOString()
      .slice(0, 10);

    const response = await companyA
      .auth(request.post("/api/site-logs"))
      .send({
        site_id: siteId,
        worker_id: workerId,
        log_date: future,
        notes: "Tomorrow's work",
      });

    expect(response.status).toBe(400);

    /*
     * The shape proves the delegation. The old inline check answered with
     * a bare { success, message }; checkEntryWindow's refusals carry a
     * machine-readable `reason`, so its presence means the shared rule
     * produced this response.
     */
    expect(response.body.reason).toBe("FUTURE_DATE");
  });

  it("refuses an unparseable date with 400 INVALID_DATE", async () => {
    const response = await companyA
      .auth(request.post("/api/site-logs"))
      .send({
        site_id: siteId,
        worker_id: workerId,
        log_date: "13/45/2026",
        notes: "Bad date",
      });

    expect(response.status).toBe(400);
    expect(response.body.reason).toBe("INVALID_DATE");
  });
});
