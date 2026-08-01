/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.js), because a CommonJS file cannot
   require("vitest") directly. */

const supertest = require("supertest");

const app = require("../server");

const {
  createCompany,
  cleanup,
  today,
  pool,
} = require("./helpers/testDb");

/*
|--------------------------------------------------------------------------
| Cross-tenant isolation
|--------------------------------------------------------------------------
|
| This is the deliverable that closes the leak the audit found: several
| controllers listed and mutated records with no company_id filter, so any
| authenticated user could read — and in some cases approve or destroy —
| another company's financial records.
|
| The suite seeds two real companies and asserts that neither can observe
| or touch the other's data through any endpoint.
|
| A single-company test cannot catch this class of bug. That is precisely
| why it survived: it is invisible until a second tenant exists.
|
*/

const request = supertest(app);

let alpha;
let beta;

// Ids created by Alpha, used to attempt access as Beta.
const alphaIds = {};

beforeAll(async () => {
  alpha = await createCompany(request, "alpha");
  beta = await createCompany(request, "beta");

  // --- Alpha creates one record in each tenant-owned module -------------

  const tender = await alpha
    .auth(request.post("/api/tenders"))
    .send({
      title: "Alpha Confidential Tender",
      status: "running",
      estimated_value: 5000000,
      sites: [
        {
          site_name: "Alpha Site",
          site_type: "Personal Site",
          address: "Alpha Road",
        },
      ],
    });

  alphaIds.tender =
    tender.body?.tender?.id ??
    tender.body?.data?.id;

  const payment = await alpha
    .auth(request.post("/api/payments"))
    .send({
      payment_direction: "income",
      payment_scope: "OFFICE",
      payment_sub_type: "TDS",
      amount: 999999,
      payment_date: today(),
    });

  alphaIds.payment = payment.body?.payment?.id;

  const worker = await alpha
    .auth(request.post("/api/workers"))
    .send({
      full_name: "Alpha Worker",
      phone: "9000000001",
      salary: 30000,
      role: "worker",
      status: "active",
    });

  alphaIds.worker =
    worker.body?.worker?.id ??
    worker.body?.data?.id;

  if (alphaIds.worker) {
    const allocation = await alpha
      .auth(
        request.post("/api/worker-allocations")
      )
      .send({
        worker_id: alphaIds.worker,
        allocated_amount: 50000,
        purpose: "Alpha secret advance",
      });

    alphaIds.allocation =
      allocation.body?.allocation?.id;
  }

  const labour = await alpha
    .auth(
      request.post("/api/site-operations/labour")
    )
    .send({
      full_name: "Alpha Labourer",
      category: "kadiya",
      daily_rate: 800,
    });

  alphaIds.labour = labour.body?.labour?.id;

  const investor = await alpha
    .auth(request.post("/api/masters/investors"))
    .send({ name: "Alpha Investor" });

  alphaIds.investor = investor.body?.item?.id;
}, 60000);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

/*
|--------------------------------------------------------------------------
| Reads
|--------------------------------------------------------------------------
*/

describe("list endpoints never return another company's rows", () => {
  const listEndpoints = [
    ["/api/payments", "payments"],
    ["/api/tenders", "tenders"],
    ["/api/workers", "workers"],
    ["/api/sites", "sites"],
    ["/api/invoices", "invoices"],
    ["/api/site-logs", "siteLogs"],
    ["/api/worker-allocations", "allocations"],
    ["/api/worker-expenses", "expenses"],
    [
      "/api/daily-update-approvals",
      "approvals",
    ],
    [
      "/api/site-operations/labour",
      "labour",
    ],
    [
      "/api/site-operations/materials",
      "entries",
    ],
    ["/api/masters/investors", "items"],
  ];

  it.each(listEndpoints)(
    "%s returns nothing belonging to Alpha when called as Beta",
    async (path, key) => {
      const response = await beta.auth(
        request.get(path)
      );

      expect(response.status).toBe(200);

      const rows =
        response.body[key] ??
        response.body.items ??
        [];

      expect(Array.isArray(rows)).toBe(true);

      // Beta is a brand-new company, so anything at all here came from
      // Alpha and represents a leak.
      expect(rows).toHaveLength(0);
    }
  );

  it("Alpha still sees its own records", async () => {
    const response = await alpha.auth(
      request.get("/api/payments")
    );

    expect(response.status).toBe(200);
    expect(
      response.body.payments.length
    ).toBeGreaterThan(0);
  });
});

/*
|--------------------------------------------------------------------------
| Writes
|--------------------------------------------------------------------------
|
| Reading someone else's data is bad; approving or deleting it is worse.
| These were reachable by id enumeration before the fix.
|
*/

describe("write endpoints reject another company's record ids", () => {
  it("Beta cannot delete Alpha's payment", async () => {
    const response = await beta.auth(
      request.delete(
        `/api/payments/${alphaIds.payment}`
      )
    );

    expect(response.status).toBe(404);

    // And it is genuinely still there.
    const check = await alpha.auth(
      request.get("/api/payments")
    );

    expect(
      check.body.payments.some(
        (p) => p.id === alphaIds.payment
      )
    ).toBe(true);
  });

  it("Beta cannot approve Alpha's worker allocation", async () => {
    if (!alphaIds.allocation) return;

    const response = await beta.auth(
      request.post(
        `/api/worker-allocations/${alphaIds.allocation}/approve`
      )
    );

    expect(response.status).toBe(404);
  });

  it("Beta cannot attach an expense to Alpha's allocation", async () => {
    if (!alphaIds.allocation) return;

    const response = await beta.auth(
      request.post("/api/worker-expenses")
    ).send({
      allocation_id: alphaIds.allocation,
      expense_amount: 100,
      expense_date: today(),
    });

    expect(response.status).toBe(404);
  });

  it("Beta cannot record a site log against Alpha's site", async () => {
    const sites = await alpha.auth(
      request.get("/api/sites")
    );

    const alphaSite = (
      sites.body.sites ?? []
    )[0];

    if (!alphaSite) return;

    const response = await beta.auth(
      request.post("/api/site-logs")
    ).send({
      site_id: alphaSite.id,
      log_date: today(),
      worker_id: alphaIds.worker,
      notes: "Injected by Beta",
    });

    expect(response.status).toBe(404);
  });

  it("Beta cannot read Alpha's labour ledger", async () => {
    if (!alphaIds.labour) return;

    const response = await beta.auth(
      request.get(
        `/api/site-operations/labour/${alphaIds.labour}/ledger`
      )
    );

    expect(response.status).toBe(404);
  });

  it("Beta cannot read Alpha's investor statement", async () => {
    if (!alphaIds.investor) return;

    const response = await beta.auth(
      request.get(
        `/api/masters/investors/${alphaIds.investor}/statement`
      )
    );

    expect(response.status).toBe(404);
  });

  it("Beta cannot attach a payment to Alpha's tender", async () => {
    if (!alphaIds.tender) return;

    const response = await beta.auth(
      request.post("/api/payments")
    ).send({
      payment_direction: "income",
      payment_scope: "PERSONAL_TENDER",
      payment_sub_type: "GOVERNMENT_BILL",
      tender_id: alphaIds.tender,
      amount: 1000,
      payment_date: today(),
    });

    expect(response.status).toBe(404);
  });
});

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

describe("authentication is required", () => {
  it("rejects an unauthenticated request", async () => {
    const response = await request.get(
      "/api/payments"
    );

    expect(response.status).toBe(401);
  });

  it("rejects a malformed token", async () => {
    const response = await request
      .get("/api/payments")
      .set(
        "Authorization",
        "Bearer not-a-real-token"
      );

    expect(response.status).toBe(401);
  });
});
