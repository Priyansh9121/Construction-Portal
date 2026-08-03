/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.mjs), because a CommonJS file cannot
   require("vitest") directly. */

const supertest = require("supertest");

const app = require("../server");

const {
  createCompany,
  marker,
  cleanup,
  pool,
} = require("./helpers/testDb");

/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Regression coverage for F-16: linking a client to a tender.
|
| The bug:
|   validateClientOwnership in tenderQueries.js filtered on
|   `COALESCE(is_deleted, FALSE) = FALSE`. The clients table has no
|   is_deleted column — it carries `status` — so the statement failed with
|   Postgres error 42703 and the request became a 500.
|
|   It only fired when a client_id was actually supplied, because the
|   function returns early when there is none. That is why every tender
|   created without a client worked, and the fault went unnoticed.
|
| What these tests pin down:
|
|   1. Creating a tender WITH a client succeeds and stores the link.
|      This is the case that used to 500, and it is the one that would
|      break again if the bad column reappeared.
|
|   2. Updating a tender with a client succeeds. The update path calls the
|      same validator, and the frontend always sends client_id back, so
|      this is the second way the bug surfaced.
|
|   3. A client belonging to ANOTHER company is rejected with 404.
|      This is the check the function exists for, and the fix must not
|      have weakened it — removing a WHERE condition is exactly the kind
|      of change that could.
|
|   4. A non-existent client id is rejected with 404.
|
|   5. An ARCHIVED (status = 'inactive') client of the caller's own
|      company is still accepted. This documents a deliberate decision
|      rather than an accident — see the note on test 5 and the comment on
|      validateClientOwnership.
|
|   6. Creating a tender with no client at all still works, confirming the
|      early-return path is untouched.
|
| Connected to:
|   backend/modules/tenders/tenderQueries.js  validateClientOwnership
|   backend/modules/tenders/tender.service.js validateClient
|   POST /api/tenders, PUT /api/tenders/:id
|   tables: tenders, clients
|
*/

const request = supertest(app);

let companyA;
let companyB;

// A client in company A, active.
let clientA;

// A client in company A that has been archived.
let archivedClientA;

// A client in company B — company A must never be able to reference it.
let clientB;

/**
 * Inserts a client directly.
 *
 * Done with SQL rather than through the API because /api/masters/:master
 * is a separate surface with its own behaviour, and a failure there would
 * make this suite report a problem it is not testing. The columns written
 * here are exactly those the live clients table has.
 */
const insertClient = async (
  companyId,
  name,
  status = "active"
) => {
  const result = await pool.query(
    `
    INSERT INTO public.clients
      (company_id, name, status)
    VALUES ($1, $2, $3)
    RETURNING id
    `,
    [companyId, marker(name), status]
  );

  return result.rows[0].id;
};

beforeAll(async () => {
  // Two tenants, so the cross-company rejection can be asserted rather
  // than assumed. A single-company suite cannot catch a missing
  // company_id filter.
  companyA = await createCompany(
    request,
    "clientvalA"
  );

  companyB = await createCompany(
    request,
    "clientvalB"
  );

  clientA = await insertClient(
    companyA.companyId,
    "acme"
  );

  archivedClientA = await insertClient(
    companyA.companyId,
    "archived",
    "inactive"
  );

  clientB = await insertClient(
    companyB.companyId,
    "othercorp"
  );
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("Tender client validation (F-16)", () => {
  /*
   * The headline regression. Before the fix this returned 500 with
   * 42703 "column is_deleted does not exist".
   */
  it("creates a tender with a client of the same company", async () => {
    const response = await companyA
      .auth(request.post("/api/tenders"))
      .send({
        title: "Tender With Client",
        status: "running",
        sites: [
          {
            site_name: "Site A",
            site_type: "Personal Site",
            address: "1 Test Road",
          },
        ],
        client_id: clientA,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    // The link is actually stored, not merely accepted.
    expect(
      Number(response.body.tender.client_id)
    ).toBe(Number(clientA));
  });

  /*
   * The update path runs the same validator. Worth its own test because
   * the frontend sends the full tender back on every edit, so this is how
   * most users would have met the bug.
   */
  it("updates a tender with a client of the same company", async () => {
    const created = await companyA
      .auth(request.post("/api/tenders"))
      .send({
        title: "Tender To Update",
        status: "running",
        sites: [
          {
            site_name: "Site A",
            site_type: "Personal Site",
            address: "1 Test Road",
          },
        ],
      });

    expect(created.status).toBe(201);

    const response = await companyA
      .auth(
        request.put(
          `/api/tenders/${created.body.tender.id}`
        )
      )
      .send({
        title: "Tender To Update",
        status: "running",
        sites: [
          {
            site_name: "Site A",
            site_type: "Personal Site",
            address: "1 Test Road",
          },
        ],
        client_id: clientA,
      });

    expect(response.status).toBe(200);
    expect(
      Number(response.body.tender.client_id)
    ).toBe(Number(clientA));
  });

  /*
   * The reason the function exists. The fix removed a WHERE condition, so
   * this guards against the company scoping having been removed with it.
   */
  it("rejects a client belonging to another company", async () => {
    const response = await companyA
      .auth(request.post("/api/tenders"))
      .send({
        title: "Cross Tenant Tender",
        status: "running",
        sites: [
          {
            site_name: "Site A",
            site_type: "Personal Site",
            address: "1 Test Road",
          },
        ],
        client_id: clientB,
      });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);

    // Specifically not a 500 — a database error would also be a
    // "failure", and this asserts the refusal is the deliberate kind.
    expect(response.status).not.toBe(500);
  });

  it("rejects a client id that does not exist", async () => {
    const response = await companyA
      .auth(request.post("/api/tenders"))
      .send({
        title: "Missing Client Tender",
        status: "running",
        sites: [
          {
            site_name: "Site A",
            site_type: "Personal Site",
            address: "1 Test Road",
          },
        ],
        client_id: 99999999,
      });

    expect(response.status).toBe(404);
  });

  /*
   * Documents a decision, not just behaviour.
   *
   * validateClientOwnership checks ownership only. An archived client is
   * still the company's client, so it passes.
   *
   * This is deliberate: the frontend returns the whole tender on update
   * including client_id, so rejecting archived clients here would make
   * every tender whose client was later archived uneditable. If archived
   * clients should be un-selectable for NEW tenders, that rule belongs on
   * the create path alone.
   *
   * If that decision is ever revisited, this test should fail and be
   * changed — which is the point of asserting it.
   */
  it("accepts an archived client of the same company", async () => {
    const response = await companyA
      .auth(request.post("/api/tenders"))
      .send({
        title: "Archived Client Tender",
        status: "running",
        sites: [
          {
            site_name: "Site A",
            site_type: "Personal Site",
            address: "1 Test Road",
          },
        ],
        client_id: archivedClientA,
      });

    expect(response.status).toBe(201);
    expect(
      Number(response.body.tender.client_id)
    ).toBe(Number(archivedClientA));
  });

  /*
   * The path that always worked, confirmed still to work — the early
   * return in validateClientOwnership was not disturbed by the fix.
   */
  it("creates a tender with no client at all", async () => {
    const response = await companyA
      .auth(request.post("/api/tenders"))
      .send({
        title: "No Client Tender",
        status: "running",
        sites: [
          {
            site_name: "Site A",
            site_type: "Personal Site",
            address: "1 Test Road",
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
