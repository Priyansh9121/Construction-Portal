/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true), because a CommonJS file cannot require("vitest"). */

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
| Idempotent evidentiary writes
|--------------------------------------------------------------------------
|
| Site Operations records evidence, and every write there was retry-unsafe.
| A double-tap on a slow connection created two ledger entries; a request that
| timed out but actually landed could not be retried, because the client had
| no way to discover which had happened.
|
| The sharpest case is the backdating grant. Grants are single-use and are
| consumed server-side AFTER the write succeeds, so retrying a request that
| already succeeded finds no grant left — and the supervisor has to ask the
| office for access a second time, for an entry that is already recorded.
|
| No business rule changes here. A repeated request returns the answer the
| first one got instead of doing the work twice.
|
*/

const request = supertest(app);

let company;
let siteId;

const KEY = () =>
  `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const materialEntries = async () => {
  const response = await company.auth(
    request.get("/api/site-operations/materials")
  );

  return (
    response.body?.entries ??
    response.body?.data ??
    []
  );
};

beforeAll(async () => {
  company = await createCompany(request, "idem");

  const tender = await company
    .auth(request.post("/api/tenders"))
    .send({
      title: "Idempotency Tender",
      status: "running",
      sites: [
        {
          site_name: "Idem Site",
          site_type: "Personal Site",
          address: "3 Test Road",
        },
      ],
    });

  siteId = tender.body?.tender?.sites?.[0]?.id;

  if (!siteId) {
    throw new Error(
      `Could not create site: ${JSON.stringify(tender.body)}`
    );
  }
}, 60000);

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("a repeated write does not create a second record", () => {
  it("returns the first response and writes once", async () => {
    const key = KEY();

    const payload = {
      site_id: siteId,
      material_name: "Cement",
      quantity: 10,
      unit: "bag",
      rate: 400,
      entry_date: today(),
    };

    const before = (await materialEntries()).length;

    const first = await company
      .auth(request.post("/api/site-operations/materials"))
      .set("Idempotency-Key", key)
      .send(payload);

    // If the payload shape is wrong the test is meaningless, so say so.
    expect(
      first.status,
      `first write failed: ${JSON.stringify(first.body)}`
    ).toBe(201);

    const second = await company
      .auth(request.post("/api/site-operations/materials"))
      .set("Idempotency-Key", key)
      .send(payload);

    expect(second.status).toBe(201);

    // Same answer, not a second record.
    expect(second.body).toEqual(first.body);

    const after = (await materialEntries()).length;

    expect(
      after - before,
      "the retry created a second entry"
    ).toBe(1);
  });

  it("treats a different key as a different request", async () => {
    const payload = {
      site_id: siteId,
      material_name: "Sand",
      quantity: 5,
      unit: "brass",
      rate: 3000,
      entry_date: today(),
    };

    const before = (await materialEntries()).length;

    await company
      .auth(request.post("/api/site-operations/materials"))
      .set("Idempotency-Key", KEY())
      .send(payload);

    await company
      .auth(request.post("/api/site-operations/materials"))
      .set("Idempotency-Key", KEY())
      .send(payload);

    const after = (await materialEntries()).length;

    // Two deliveries of the same material on the same day is legitimate.
    expect(after - before).toBe(2);
  });

  it("refuses a key reused for a different payload", async () => {
    const key = KEY();

    await company
      .auth(request.post("/api/site-operations/materials"))
      .set("Idempotency-Key", key)
      .send({
        site_id: siteId,
        material_name: "Steel",
        quantity: 1,
        unit: "kg",
        rate: 60,
        entry_date: today(),
      });

    const mismatched = await company
      .auth(request.post("/api/site-operations/materials"))
      .set("Idempotency-Key", key)
      .send({
        site_id: siteId,
        material_name: "Steel",
        quantity: 999,
        unit: "kg",
        rate: 60,
        entry_date: today(),
      });

    // Silently replaying the first response here would answer a question the
    // caller did not ask.
    expect(mismatched.status).toBe(422);
  });

  it("is opt-in: no key behaves exactly as before", async () => {
    const payload = {
      site_id: siteId,
      material_name: "Gravel",
      quantity: 2,
      unit: "brass",
      rate: 2500,
      entry_date: today(),
    };

    const before = (await materialEntries()).length;

    await company
      .auth(request.post("/api/site-operations/materials"))
      .send(payload);

    await company
      .auth(request.post("/api/site-operations/materials"))
      .send(payload);

    const after = (await materialEntries()).length;

    expect(after - before).toBe(2);
  });

  it("does not keep the claim when the write failed", async () => {
    const key = KEY();

    // A site that is not this company's: the handler refuses.
    const failed = await company
      .auth(request.post("/api/site-operations/materials"))
      .set("Idempotency-Key", key)
      .send({
        site_id: 999999999,
        material_name: "Cement",
        quantity: 1,
        unit: "bag",
        rate: 400,
        entry_date: today(),
      });

    expect(failed.status).toBeGreaterThanOrEqual(400);

    /*
     * The same key must still be usable. Holding a claim after a failure
     * would turn one transient error into a permanently unusable key — the
     * caller could never complete that operation.
     */
    const retried = await company
      .auth(request.post("/api/site-operations/materials"))
      .set("Idempotency-Key", key)
      .send({
        site_id: siteId,
        material_name: "Cement",
        quantity: 1,
        unit: "bag",
        rate: 400,
        entry_date: today(),
      });

    expect(retried.status).toBe(201);
  });
});
