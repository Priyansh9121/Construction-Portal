/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.mjs), because a CommonJS file cannot
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
| Tender child resources
|--------------------------------------------------------------------------
|
| Documents, materials, banking, subcontractor assignments and finance
| records all hang off a tender:
|
|     POST /api/tenders/:tenderId/materials
|
| Two separate faults made every one of these unusable, and they masked
| each other:
|
|   1. The frontend posted to a flat "/api/tender-details/materials" that
|      no router served, so the request 404'd before reaching a handler.
|
|   2. Underneath, the INSERT statements never wrote company_id, which
|      migration 001 had made NOT NULL. Nothing surfaced that, because
|      fault 1 meant the handler was never reached.
|
| Fixing the routing alone would have swapped a 404 for a 500. This suite
| covers both layers: the route resolves, the row is written, and the row
| carries the company that owns the parent tender.
|
*/

const request = supertest(app);

let company;
let tenderId;

const created = {};

beforeAll(async () => {
  company = await createCompany(request, "childres");

  const tender = await company
    .auth(request.post("/api/tenders"))
    .send({
      title: "Child Resource Tender",
      status: "running",
      sites: [
        {
          site_name: "Site A",
          site_type: "Personal Site",
          address: "1 Test Road",
        },
      ],
    });

  tenderId = tender.body?.tender?.id;

  if (!tenderId) {
    throw new Error(
      `Could not create tender: ${JSON.stringify(tender.body)}`
    );
  }
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

/**
 * Every child row must carry the company that owns the parent tender.
 *
 * Reading it back from the database rather than the response body is
 * deliberate: the API could echo a company_id it never persisted.
 */
const expectCompanyOnRow = async (table, id) => {
  const { rows } = await pool.query(
    `SELECT company_id FROM public.${table} WHERE id = $1`,
    [id]
  );

  expect(rows).toHaveLength(1);
  expect(rows[0].company_id).toBe(company.companyId);
};

describe("tender documents", () => {
  it("creates a document and stamps it with the owning company", async () => {
    const res = await company
      .auth(request.post(`/api/tenders/${tenderId}/documents`))
      .send({
        document_name: "Signed Contract",
        document_type: "PDF",
        file_url: "https://example.test/contract.pdf",
      });

    expect(res.status).toBe(201);

    created.document = res.body.document.id;

    await expectCompanyOnRow("tender_documents", created.document);
  });

  it("lists and then deletes the document", async () => {
    const list = await company.auth(
      request.get(`/api/tenders/${tenderId}/documents`)
    );

    expect(list.status).toBe(200);

    const res = await company.auth(
      request.delete(
        `/api/tenders/${tenderId}/documents/${created.document}`
      )
    );

    expect(res.status).toBe(200);
  });
});

describe("tender materials", () => {
  it("creates a material and stamps it with the owning company", async () => {
    const res = await company
      .auth(request.post(`/api/tenders/${tenderId}/materials`))
      .send({
        section_name: "Binder",
        material_name: "Cement",
        quantity: 10,
        unit: "bag",
        rate: 350,
      });

    expect(res.status).toBe(201);

    created.material = res.body.material.id;

    await expectCompanyOnRow("tender_materials", created.material);
  });

  it("deletes the material", async () => {
    const res = await company.auth(
      request.delete(
        `/api/tenders/${tenderId}/materials/${created.material}`
      )
    );

    expect(res.status).toBe(200);
  });
});

describe("tender banking", () => {
  it("creates a banking record and stamps it with the owning company", async () => {
    const res = await company
      .auth(request.post(`/api/tenders/${tenderId}/banking`))
      .send({
        payment_type: "Received",
        bank_name: "HDFC",
        account_name: "Test Account",
        account_number: "123456789",
        amount: 1000,
        payment_date: today(),
      });

    expect(res.status).toBe(201);

    created.banking = res.body.banking.id;

    await expectCompanyOnRow("tender_banking", created.banking);
  });

  it("deletes the banking record", async () => {
    const res = await company.auth(
      request.delete(
        `/api/tenders/${tenderId}/banking/${created.banking}`
      )
    );

    expect(res.status).toBe(200);
  });
});

describe("tender subcontractor assignments", () => {
  it("assigns, updates and removes a subcontractor", async () => {
    const sub = await company
      .auth(request.post("/api/subcontractors"))
      .send({
        full_name: "Test Subcontractor",
        phone: "9999999999",
      });

    const subcontractorId =
      sub.body?.subcontractor?.id ?? sub.body?.data?.id;

    const assign = await company
      .auth(request.post(`/api/tenders/${tenderId}/subcontractors`))
      .send({
        subcontractor_id: subcontractorId,
        work_description: "Plastering",
        assigned_amount: 50000,
      });

    expect(assign.status).toBe(201);

    const assignmentId =
      assign.body?.assignment?.id ?? assign.body?.subcontractor?.id;

    await expectCompanyOnRow("tender_subcontractors", assignmentId);

    const update = await company
      .auth(
        request.put(
          `/api/tenders/${tenderId}/subcontractors/${assignmentId}`
        )
      )
      .send({
        work_description: "Plastering and painting",
        assigned_amount: 70000,
        status: "active",
      });

    expect(update.status).toBe(200);

    const remove = await company.auth(
      request.delete(
        `/api/tenders/${tenderId}/subcontractors/${assignmentId}`
      )
    );

    expect(remove.status).toBe(200);
  });
});

describe("tender finance records", () => {
  it("computes the company charge and stamps the owning company", async () => {
    const res = await company
      .auth(request.post(`/api/tenders/${tenderId}/finance`))
      .send({
        record_type: "GOVERNMENT_BILL",
        source_name: "Government",
        payment_mode: "Bank",
        amount: 12000,
        gst_percent: 18,
        company_charge_percent: 2,
        record_date: today(),
      });

    expect(res.status).toBe(201);

    const record = res.body.finance ?? res.body.record;

    // The worked example from the site notebook: a 12,000 bill at 2%.
    expect(Number(record.company_charge_total)).toBe(240);

    await expectCompanyOnRow("tender_finance_records", record.id);
  });
});

describe("soft delete and restore", () => {
  it("lists a deleted tender only under ?deleted=true", async () => {
    // Deleting is a soft delete, but the list hard-coded is_deleted =
    // FALSE, so a deleted project could not be seen — which left
    // POST /:id/restore unreachable and a mistaken delete permanent as far
    // as anyone using the app could tell.
    const doomed = await company
      .auth(request.post("/api/tenders"))
      .send({
        title: "Deleted By Mistake",
        status: "running",
        sites: [{ site_name: "S", address: "1 Road" }],
      });

    const doomedId = doomed.body.tender.id;

    const titles = async (query) => {
      const res = await company.auth(request.get(`/api/tenders${query}`));

      return (res.body.tenders || []).map((row) => row.title);
    };

    expect(await titles("")).toContain("Deleted By Mistake");
    expect(await titles("?deleted=true")).not.toContain("Deleted By Mistake");

    await company.auth(request.delete(`/api/tenders/${doomedId}`));

    expect(await titles("")).not.toContain("Deleted By Mistake");
    expect(await titles("?deleted=true")).toContain("Deleted By Mistake");

    await company.auth(request.post(`/api/tenders/${doomedId}/restore`));

    expect(await titles("")).toContain("Deleted By Mistake");
    expect(await titles("?deleted=true")).not.toContain("Deleted By Mistake");
  });

  it("restores a deleted tender over POST, not PATCH", async () => {
    const removed = await company.auth(
      request.delete(`/api/tenders/${tenderId}`)
    );

    expect(removed.status).toBe(200);

    // The frontend used PATCH against a route mounted as POST, so restore
    // 404'd rather than doing anything.
    const patched = await company.auth(
      request.patch(`/api/tenders/${tenderId}/restore`)
    );

    expect(patched.status).toBe(404);

    const restored = await company.auth(
      request.post(`/api/tenders/${tenderId}/restore`)
    );

    expect(restored.status).toBe(200);
  });
});
