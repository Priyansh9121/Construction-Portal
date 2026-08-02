/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.mjs), because a CommonJS file cannot
   require("vitest") directly. */

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
| Privilege separation inside a company
|--------------------------------------------------------------------------
|
| The isolation suite proves one company cannot read another's data. It
| says nothing about what a labourer can read inside their own company,
| and that turned out to be everything.
|
| Authentication was being treated as authorisation: every office register
| was mounted behind authMiddleware alone. A worker login — the kind handed
| out for the worker portal — could read the tender list with
| estimated_value, estimated_margin, actual_margin, client_name,
| client_email and client_phone; the full payment ledger; worker
| allocations and expenses; subcontractors with their bank details; and the
| investor list. It could also create payments, invoices and
| subcontractors.
|
| Workers and subcontractors have their own scoped surfaces:
|
|     /api/worker-portal/*          assignments, updates, their own money
|     /api/subcontractor-portal/*   their tenders and documents
|
| This suite asserts the office registers stay closed to them and that
| those portals stay open.
|
*/

const request = supertest(app);

let office;
let worker;
let subcontractor;

// Reachable by admin and manager only.
const OFFICE_READS = [
  "/api/tenders",
  "/api/sites",
  "/api/workers",
  "/api/invoices",
  "/api/payments",
  "/api/site-logs",
  "/api/subcontractors",
  "/api/worker-allocations",
  "/api/worker-expenses",
  "/api/masters/investors",
  "/api/tender-workers/1",
];

const OFFICE_WRITES = [
  {
    method: "post",
    path: "/api/payments",
    body: {
      payment_direction: "income",
      payment_scope: "OFFICE",
      payment_sub_type: "TDS",
      amount: 5000,
      payment_date: "2026-01-01",
    },
  },
  {
    method: "post",
    path: "/api/invoices",
    body: { invoice_number: "ESCALATION-1", amount: 5000 },
  },
  {
    method: "post",
    path: "/api/subcontractors",
    body: { full_name: "Ghost Subcontractor", phone: "9000000000" },
  },
  {
    method: "post",
    path: "/api/workers",
    body: { full_name: "Ghost Worker", phone: "9000000001" },
  },
  {
    method: "post",
    path: "/api/sites",
    body: { site_name: "Ghost Site", address: "Nowhere" },
  },
];

beforeAll(async () => {
  office = await createCompany(request, "office");

  worker = await createMember(request, office, {
    label: "labourer",
    role: "worker",
  });

  subcontractor = await createMember(request, office, {
    label: "subbie",
    role: "subcontractor",
  });
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("office registers reject workers", () => {
  it.each(OFFICE_READS)("GET %s is forbidden", async (path) => {
    const res = await worker.auth(request.get(path));

    expect(res.status).toBe(403);
  });

  it.each(OFFICE_WRITES.map((w) => [w.path, w]))(
    "POST %s is forbidden",
    async (_path, write) => {
      const res = await worker
        .auth(request[write.method](write.path))
        .send(write.body);

      expect(res.status).toBe(403);
    }
  );
});

describe("office registers reject subcontractors", () => {
  it.each(OFFICE_READS)("GET %s is forbidden", async (path) => {
    const res = await subcontractor.auth(request.get(path));

    expect(res.status).toBe(403);
  });
});

describe("office registers stay open to the office", () => {
  it.each([
    "/api/tenders",
    "/api/sites",
    "/api/workers",
    "/api/invoices",
    "/api/payments",
    "/api/site-logs",
    "/api/subcontractors",
    "/api/worker-allocations",
    "/api/worker-expenses",
    "/api/masters/investors",
  ])("GET %s succeeds for an admin", async (path) => {
    const res = await office.auth(request.get(path));

    expect(res.status).toBe(200);
  });
});

describe("scoped portals stay reachable", () => {
  it("a worker can still reach the worker portal", async () => {
    const res = await worker.auth(request.get("/api/worker-portal/me"));

    // 200 with a linked worker record, 404 without one. Either proves the
    // route resolved and the role check passed — 403 would not.
    expect([200, 404]).toContain(res.status);
  });

  it("a subcontractor can still reach the subcontractor portal", async () => {
    const res = await subcontractor.auth(
      request.get("/api/subcontractor-portal/me")
    );

    expect([200, 404]).toContain(res.status);
  });

  it("a worker can still upload a photo", async () => {
    const res = await worker.auth(request.get("/api/upload"));

    expect(res.status).not.toBe(403);
  });

  it("a worker can still read notifications", async () => {
    const res = await worker.auth(request.get("/api/notifications"));

    expect(res.status).not.toBe(403);
  });

  it("any member can still read the company profile", async () => {
    const res = await worker.auth(request.get("/api/company"));

    expect(res.status).toBe(200);
  });
});

describe("commercial fields are not exposed to workers", () => {
  it("does not return tender margins or client contacts", async () => {
    const res = await worker.auth(request.get("/api/tenders"));

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain("estimated_margin");
    expect(JSON.stringify(res.body)).not.toContain("client_phone");
  });
});
