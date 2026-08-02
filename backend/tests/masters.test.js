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
| Master data
|--------------------------------------------------------------------------
|
| Investors, suppliers and clients existed in the database with a complete
| API in front of them and nothing on screen, so a payment could only name
| an investor as free text — which makes "what do we owe this investor
| across every tender" unanswerable.
|
| The statement is the reason the tables are worth having: it pulls every
| payment to and from one investor across all tenders and accrues interest
| to today.
|
*/

const request = supertest(app);

let office;

beforeAll(async () => {
  office = await createCompany(request, "masters");
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe("the three registers share one controller", () => {
  it.each([
    ["investors", {}],
    ["suppliers", { gst_number: "24ABCDE1234F1Z5" }],
    ["clients", { gst_number: "24ABCDE1234F1Z6" }],
  ])("creates, lists, updates and archives a %s", async (master, extra) => {
    const created = await office
      .auth(request.post(`/api/masters/${master}`))
      .send({
        name: `Test ${master}`,
        phone: "9812300000",
        email: `${master}@test.local`,
        address: "Ahmedabad",
        ...extra,
      });

    expect(created.status).toBe(201);

    const id = created.body.item.id;

    const listed = await office.auth(request.get(`/api/masters/${master}`));

    expect(listed.status).toBe(200);
    expect(
      (listed.body.items ?? listed.body[master]).some(
        (row) => row.id === id
      )
    ).toBe(true);

    const updated = await office
      .auth(request.put(`/api/masters/${master}/${id}`))
      .send({ name: `Renamed ${master}`, phone: "9812300001" });

    expect(updated.status).toBe(200);
    expect(updated.body.item.name).toBe(`Renamed ${master}`);

    const archived = await office.auth(
      request.delete(`/api/masters/${master}/${id}`)
    );

    expect(archived.status).toBe(200);
  });

  it("refuses a master type that is not on the allowlist", async () => {
    // The table name is interpolated into SQL, so anything off the
    // allowlist has to be rejected rather than passed through.
    const res = await office.auth(request.get("/api/masters/users"));

    expect(res.status).toBe(404);
  });
});

describe("investor statement", () => {
  it("accrues interest across a tender", async () => {
    const investor = await office
      .auth(request.post("/api/masters/investors"))
      .send({ name: "Kishor Patel", phone: "9825011111" });

    const investorId = investor.body.item.id;

    const tender = await office
      .auth(request.post("/api/tenders"))
      .send({
        title: "Investor Tender",
        status: "running",
        sites: [{ site_name: "S1", address: "1 Road" }],
      });

    const payment = await office
      .auth(request.post("/api/payments"))
      .send({
        payment_direction: "income",
        payment_scope: "PERSONAL_TENDER",
        payment_sub_type: "INVESTOR",
        amount: 500000,
        interest_percent: 12,
        investor_id: investorId,
        investor_name: "Kishor Patel",
        tender_id: tender.body.tender.id,
        payment_date: "2026-07-03",
      });

    expect(payment.status).toBe(201);

    const res = await office.auth(
      request.get(`/api/masters/investors/${investorId}/statement`)
    );

    expect(res.status).toBe(200);
    expect(res.body.investor.name).toBe("Kishor Patel");
    expect(res.body.entries).toHaveLength(1);

    const entry = res.body.entries[0];

    expect(entry.tender_title).toBe("Investor Tender");
    expect(Number(entry.amount)).toBe(500000);

    // Simple interest: 500,000 x 12% x days / 365. At the notebook's rate
    // that is 164.38 a day, so the accrual has to track the day count
    // rather than being a flat figure.
    const expected =
      Math.round(((500000 * 12) / 100 / 365) * entry.days_accrued * 100) /
      100;

    expect(entry.interest_amount).toBeCloseTo(expected, 2);

    expect(res.body.summary.total_received).toBe(500000);
    expect(res.body.summary.total_returned).toBe(0);
    expect(res.body.summary.outstanding).toBeCloseTo(
      500000 + entry.interest_amount,
      2
    );
  });

  it("returns 404 for an investor in another company", async () => {
    const other = await createCompany(request, "othermasters");

    const theirs = await other
      .auth(request.post("/api/masters/investors"))
      .send({ name: "Someone Else" });

    const res = await office.auth(
      request.get(`/api/masters/investors/${theirs.body.item.id}/statement`)
    );

    expect(res.status).toBe(404);
  });
});

describe("master data is office-only", () => {
  it("refuses a worker", async () => {
    const worker = await createMember(request, office, {
      label: "masterslabourer",
      role: "worker",
    });

    const res = await worker.auth(request.get("/api/masters/investors"));

    expect(res.status).toBe(403);
  });
});
