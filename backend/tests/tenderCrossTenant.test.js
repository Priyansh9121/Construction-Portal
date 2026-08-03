/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.mjs), because a CommonJS file cannot
   require("vitest") directly. */

const supertest = require("supertest");

const app = require("../server");

const tenderQueries = require("../modules/tenders/tenderQueries");

const {
  createCompany,
  cleanup,
  pool,
} = require("./helpers/testDb");

/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Regression coverage for F-17: tender child collections must not be
| reachable across companies.
|
| The finding:
|   Five queries in tenderQueries.js filtered on tender_id alone —
|   getTenderDocuments, getTenderMaterials, getTenderBanking,
|   getTenderFinanceRecords and getTenderFinanceSummary. They were safe only
|   because both call paths happened to prove ownership first. The
|   guarantee lived in the CALL SITES, not the queries, so a new caller or a
|   refactor could have opened cross-tenant reads with no visible change to
|   the query.
|
|   Each now takes companyId and filters on it directly.
|
| This suite tests both layers, deliberately:
|
|   1. THE HTTP LAYER — company B asks for company A's tender by id, through
|      every child endpoint. Proves the API refuses.
|
|   2. THE QUERY LAYER — the five functions are called DIRECTLY with a
|      mismatched companyId, bypassing the service entirely. This is the
|      layer that was actually unprotected, and it is the part an HTTP test
|      cannot reach: a passing HTTP test only shows the caller checked, not
|      that the query would refuse on its own.
|
| Without the second group, reverting the fix would leave this suite green.
|
| Connected to:
|   backend/modules/tenders/tenderQueries.js — the five scoped queries
|   backend/modules/tenders/tender.service.js — prepareChildOperation
|   tables: tenders, tender_documents, tender_materials, tender_banking,
|           tender_finance_records
|
*/

const request = supertest(app);

let companyA;
let companyB;

// A tender in company A, populated with one row in every child collection.
let tenderA;

const SITE_PAYLOAD = [
  {
    site_name: "Cross Tenant Site",
    site_type: "Personal Site",
    address: "1 Test Road",
  },
];

beforeAll(async () => {
  companyA = await createCompany(
    request,
    "xtenantA"
  );

  companyB = await createCompany(
    request,
    "xtenantB"
  );

  const created = await companyA
    .auth(request.post("/api/tenders"))
    .send({
      title: "Company A Tender",
      status: "running",
      sites: SITE_PAYLOAD,
    });

  if (created.status !== 201) {
    throw new Error(
      `Could not create tender: ${JSON.stringify(created.body)}`
    );
  }

  tenderA = created.body.tender.id;

  /*
   * Populate every child collection, so a cross-tenant read that leaked
   * would return actual rows rather than an empty array that looks like a
   * pass for the wrong reason.
   */
  await companyA
    .auth(
      request.post(`/api/tenders/${tenderA}/documents`)
    )
    .send({
      document_name: "Secret Contract",
      document_url: "https://example.test/secret.pdf",
    });

  await companyA
    .auth(
      request.post(`/api/tenders/${tenderA}/materials`)
    )
    .send({
      section_name: "Structure",
      material_name: "Secret Cement",
      quantity: 100,
      rate: 250,
    });

  await companyA
    .auth(
      request.post(`/api/tenders/${tenderA}/banking`)
    )
    .send({
      payment_type: "Security Deposit",
      bank_name: "Secret Bank",
      account_name: "Company A",
      account_number: "999888777",
      amount: 50000,
    });

  await companyA
    .auth(
      request.post(`/api/tenders/${tenderA}/finance`)
    )
    .send({
      record_type: "GOVERNMENT_BILL",
      amount: 100000,
      gst_percent: 18,
    });
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

/*
|--------------------------------------------------------------------------
| 1. The HTTP layer
|--------------------------------------------------------------------------
|
| Company B knows company A's tender id and asks for it directly. Every
| endpoint must refuse with 404 — not 403, which would confirm the tender
| exists.
|
*/
describe("F-17 · cross-tenant access through the API", () => {
  const childPaths = [
    "documents",
    "materials",
    "banking",
    "subcontractors",
    "workers",
    "finance",
    "finance/summary",
  ];

  it.each(childPaths)(
    "refuses company B reading company A's %s",
    async (path) => {
      const response = await companyB
        .auth(
          request.get(
            `/api/tenders/${tenderA}/${path}`
          )
        );

      expect(response.status).toBe(404);

      // Specifically not a 200 with an empty list, which would mean the
      // query ran and simply found nothing — the caller must be refused.
      expect(response.status).not.toBe(200);
    }
  );

  it("refuses company B reading company A's tender details", async () => {
    const response = await companyB
      .auth(
        request.get(
          `/api/tenders/${tenderA}/details`
        )
      );

    expect(response.status).toBe(404);
  });

  it("refuses company B reading company A's tender", async () => {
    const response = await companyB
      .auth(
        request.get(`/api/tenders/${tenderA}`)
      );

    expect(response.status).toBe(404);
  });

  it("still lets company A read its own children", async () => {
    // The control. Without this, a bug that broke every read would make
    // the refusals above pass for entirely the wrong reason.
    const response = await companyA
      .auth(
        request.get(
          `/api/tenders/${tenderA}/details`
        )
      );

    expect(response.status).toBe(200);
    expect(response.body.documents.length).toBeGreaterThan(0);
    expect(response.body.materials.length).toBeGreaterThan(0);
    expect(response.body.banking.length).toBeGreaterThan(0);
    expect(response.body.finance.length).toBeGreaterThan(0);
  });
});

/*
|--------------------------------------------------------------------------
| 2. The query layer
|--------------------------------------------------------------------------
|
| The part that actually was unprotected.
|
| Each query is called directly with company A's tender id and company B's
| company id — the exact combination a forgetful caller would produce. A
| scoped query returns nothing; an unscoped one returns company A's rows.
|
| These fail if the companyId filter is removed, even though the HTTP tests
| above would still pass.
|
*/
describe("F-17 · the queries refuse on their own", () => {
  it("getTenderDocuments returns nothing for the wrong company", async () => {
    const own = await tenderQueries.getTenderDocuments({
      tenderId: tenderA,
      companyId: companyA.companyId,
    });

    const foreign = await tenderQueries.getTenderDocuments({
      tenderId: tenderA,
      companyId: companyB.companyId,
    });

    expect(own.length).toBeGreaterThan(0);
    expect(foreign).toEqual([]);
  });

  it("getTenderMaterials returns nothing for the wrong company", async () => {
    const own = await tenderQueries.getTenderMaterials({
      tenderId: tenderA,
      companyId: companyA.companyId,
    });

    const foreign = await tenderQueries.getTenderMaterials({
      tenderId: tenderA,
      companyId: companyB.companyId,
    });

    expect(own.length).toBeGreaterThan(0);
    expect(foreign).toEqual([]);
  });

  it("getTenderBanking returns nothing for the wrong company", async () => {
    const own = await tenderQueries.getTenderBanking({
      tenderId: tenderA,
      companyId: companyA.companyId,
    });

    const foreign = await tenderQueries.getTenderBanking({
      tenderId: tenderA,
      companyId: companyB.companyId,
    });

    expect(own.length).toBeGreaterThan(0);

    // Banking rows carry account_number. A leak here is the F-12 exposure
    // and the F-17 one at once.
    expect(foreign).toEqual([]);
  });

  it("getTenderFinanceRecords returns nothing for the wrong company", async () => {
    const own = await tenderQueries.getTenderFinanceRecords({
      tenderId: tenderA,
      companyId: companyA.companyId,
    });

    const foreign = await tenderQueries.getTenderFinanceRecords({
      tenderId: tenderA,
      companyId: companyB.companyId,
    });

    expect(own.length).toBeGreaterThan(0);
    expect(foreign).toEqual([]);
  });

  /*
   * The summary aggregates rather than listing, so "nothing" is zeroes
   * rather than an empty array — a leak would show as company A's real
   * totals.
   */
  it("getTenderFinanceSummary totals zero for the wrong company", async () => {
    const own = await tenderQueries.getTenderFinanceSummary({
      tenderId: tenderA,
      companyId: companyA.companyId,
    });

    const foreign = await tenderQueries.getTenderFinanceSummary({
      tenderId: tenderA,
      companyId: companyB.companyId,
    });

    expect(Number(own.government_bill_total)).toBeGreaterThan(0);
    expect(Number(foreign.government_bill_total)).toBe(0);
  });
});
