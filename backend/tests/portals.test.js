/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.mjs), because a CommonJS file cannot
   require("vitest") directly. */

const supertest = require("supertest");

const app = require("../server");

const {
  createCompany,
  createMember,
  cleanup,
  today,
  daysAgo,
  pool,
} = require("./helpers/testDb");

/*
|--------------------------------------------------------------------------
| Worker and subcontractor portals
|--------------------------------------------------------------------------
|
| These are the only screens a labourer or a subcontractor ever sees, and
| every write on both of them was broken by two separate faults.
|
| First, four INSERTs omitted company_id, which migration 001 had made NOT
| NULL — submitting a daily update, submitting a backdated one, recording
| an expense and uploading a document each died with 23502.
|
| Second, the worker portal looked its assignments up in tender_workers, a
| table nothing has ever written to. The office writes worker_assignments.
| The lookup also joined on tenders.site_id, a column that does not exist —
| sites point at tenders, not the reverse — so even against the right table
| it could not have matched. Every worker was told they were not assigned
| to the site they were standing on.
|
*/

const request = supertest(app);

let office;
let workerLogin;
let workerId;
let tenderId;
let siteId;

beforeAll(async () => {
  office = await createCompany(request, "portal");

  // --- a tender with a site ---------------------------------------------
  const tender = await office
    .auth(request.post("/api/tenders"))
    .send({
      title: "Portal Tender",
      status: "running",
      sites: [
        {
          site_name: "Portal Site",
          site_type: "Personal Site",
          address: "1 Portal Road",
        },
      ],
    });

  tenderId = tender.body.tender.id;
  siteId = tender.body.tender.sites[0].id;

  // --- a login, and a worker record pointing at it ------------------------
  workerLogin = await createMember(request, office, {
    label: "portalworker",
    role: "worker",
  });

  const worker = await office
    .auth(request.post("/api/workers"))
    .send({
      full_name: "Portal Worker",
      phone: "9812345670",
      salary: 800,
      role: "Mason",
      status: "active",
      user_id: workerLogin.user.id,
    });

  workerId = worker.body?.worker?.id ?? worker.body?.data?.id;

  if (!workerId) {
    throw new Error(
      `Could not create worker: ${JSON.stringify(worker.body)}`
    );
  }

  // --- the office assigns them -------------------------------------------
  const assignment = await office
    .auth(request.post(`/api/tenders/${tenderId}/workers`))
    .send({
      worker_id: workerId,
      site_id: siteId,
      role: "Mason",
      status: "active",
    });

  if (assignment.status !== 201) {
    throw new Error(
      `Could not assign worker: ${JSON.stringify(assignment.body)}`
    );
  }
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("worker portal", () => {
  it("returns the linked worker profile", async () => {
    const res = await workerLogin.auth(
      request.get("/api/worker-portal/me")
    );

    expect(res.status).toBe(200);
    expect(res.body.worker.worker_id).toBe(workerId);
  });

  it("lists the assignment the office made", async () => {
    const res = await workerLogin.auth(
      request.get("/api/worker-portal/assignments")
    );

    expect(res.status).toBe(200);
    expect(res.body.assignments).toHaveLength(1);

    const assignment = res.body.assignments[0];

    expect(assignment.tender_id).toBe(tenderId);
    expect(assignment.site_id).toBe(siteId);
    expect(assignment.site_name).toBe("Portal Site");
    expect(assignment.tender_title).toBe("Portal Tender");
  });

  it("accepts a daily update for today", async () => {
    const res = await workerLogin
      .auth(request.post("/api/worker-portal/daily-updates"))
      .send({
        site_id: siteId,
        tender_id: tenderId,
        log_date: today(),
        notes: "Poured the slab.",
      });

    expect(res.status).toBe(201);

    const { rows } = await pool.query(
      `SELECT company_id FROM daily_site_logs WHERE id = $1`,
      [res.body.update.id]
    );

    // A row with a null company_id is invisible to every company-scoped
    // read, so the office would never see this update.
    expect(rows[0].company_id).toBe(office.companyId);
  });

  it("sends a backdated update to the approvals queue", async () => {
    const res = await workerLogin
      .auth(request.post("/api/worker-portal/daily-updates"))
      .send({
        site_id: siteId,
        tender_id: tenderId,
        log_date: daysAgo(10),
        notes: "Forgot to log this at the time.",
      });

    expect(res.status).toBe(202);
    expect(res.body.requiresApproval).toBe(true);

    const { rows } = await pool.query(
      `SELECT company_id FROM daily_update_approvals WHERE id = $1`,
      [res.body.approval.id]
    );

    expect(rows[0].company_id).toBe(office.companyId);
  });

  it("shows the office that backdated update", async () => {
    const res = await office.auth(
      request.get("/api/daily-update-approvals")
    );

    expect(res.status).toBe(200);
    expect(res.body.approvals.length).toBeGreaterThan(0);
  });

  it("reads its own money", async () => {
    const res = await workerLogin.auth(
      request.get("/api/worker-portal/money")
    );

    expect(res.status).toBe(200);
  });

  it("records an expense against an allocation", async () => {
    const allocation = await office
      .auth(request.post("/api/worker-allocations"))
      .send({
        worker_id: workerId,
        allocated_amount: 5000,
        purpose: "Materials float",
      });

    const allocationId =
      allocation.body?.allocation?.id ?? allocation.body?.data?.id;

    // A worker can only spend against an allocation the office has signed
    // off, so approve it before the portal will accept the expense.
    const approved = await office.auth(
      request.post(`/api/worker-allocations/${allocationId}/approve`)
    );

    expect(approved.status).toBe(200);

    const res = await workerLogin
      .auth(request.post("/api/worker-portal/expenses"))
      .send({
        allocation_id: allocationId,
        expense_amount: 1200,
        expense_date: today(),
        expense_description: "Cement",
      });

    expect(res.status).toBe(202);

    const { rows } = await pool.query(
      `SELECT company_id FROM worker_expenses WHERE id = $1`,
      [res.body.expense.id]
    );

    expect(rows[0].company_id).toBe(office.companyId);
  });

  it("refuses a site the worker is not assigned to", async () => {
    const other = await office
      .auth(request.post("/api/tenders"))
      .send({
        title: "Unassigned Tender",
        status: "running",
        sites: [
          {
            site_name: "Elsewhere",
            site_type: "Personal Site",
            address: "2 Other Road",
          },
        ],
      });

    const res = await workerLogin
      .auth(request.post("/api/worker-portal/daily-updates"))
      .send({
        site_id: other.body.tender.sites[0].id,
        tender_id: other.body.tender.id,
        log_date: today(),
        notes: "Should not be accepted.",
      });

    expect(res.status).toBe(403);
  });
});

describe("subcontractor portal", () => {
  let subLogin;
  let subcontractorId;

  beforeAll(async () => {
    subLogin = await createMember(request, office, {
      label: "portalsub",
      role: "subcontractor",
    });

    const created = await office
      .auth(request.post("/api/subcontractors"))
      .send({
        full_name: "Portal Subcontractor",
        phone: "9812345671",
        status: "active",
        user_id: subLogin.user.id,
      });

    subcontractorId =
      created.body?.subcontractor?.id ?? created.body?.data?.id;

    if (!subcontractorId) {
      throw new Error(
        `Could not create subcontractor: ${JSON.stringify(created.body)}`
      );
    }

    const assignment = await office
      .auth(request.post(`/api/tenders/${tenderId}/subcontractors`))
      .send({
        subcontractor_id: subcontractorId,
        work_description: "Plastering",
        assigned_amount: 50000,
      });

    if (assignment.status !== 201) {
      throw new Error(
        `Could not assign subcontractor: ${JSON.stringify(assignment.body)}`
      );
    }
  });

  it("returns the linked subcontractor profile", async () => {
    const res = await subLogin.auth(
      request.get("/api/subcontractor-portal/me")
    );

    expect(res.status).toBe(200);
    expect(res.body.subcontractor.subcontractor_id).toBe(subcontractorId);
  });

  it("lists the tenders it is assigned to", async () => {
    const res = await subLogin.auth(
      request.get("/api/subcontractor-portal/tenders")
    );

    expect(res.status).toBe(200);
    expect(res.body.tenders.length).toBeGreaterThan(0);
  });

  it("accepts a daily update for today", async () => {
    const res = await subLogin
      .auth(request.post("/api/subcontractor-portal/daily-updates"))
      .send({
        site_id: siteId,
        tender_id: tenderId,
        log_date: today(),
        notes: "Plastered the east wall.",
      });

    expect(res.status).toBe(201);

    const { rows } = await pool.query(
      `SELECT company_id FROM daily_site_logs WHERE id = $1`,
      [res.body.update.id]
    );

    expect(rows[0].company_id).toBe(office.companyId);
  });

  it("sends a backdated update to the approvals queue", async () => {
    const res = await subLogin
      .auth(request.post("/api/subcontractor-portal/daily-updates"))
      .send({
        site_id: siteId,
        tender_id: tenderId,
        log_date: daysAgo(12),
        notes: "Late entry.",
      });

    expect(res.status).toBe(202);

    const { rows } = await pool.query(
      `SELECT company_id FROM daily_update_approvals WHERE id = $1`,
      [res.body.approval.id]
    );

    expect(rows[0].company_id).toBe(office.companyId);
  });

  it("uploads a tender document", async () => {
    const res = await subLogin
      .auth(request.post("/api/subcontractor-portal/documents"))
      .send({
        tender_id: tenderId,
        document_name: "Work completion photo",
        document_type: "PDF",
        file_url: "https://example.test/proof.pdf",
      });

    expect(res.status).toBe(201);

    const { rows } = await pool.query(
      `SELECT company_id FROM tender_documents WHERE id = $1`,
      [res.body.document.id]
    );

    expect(rows[0].company_id).toBe(office.companyId);
  });
});
