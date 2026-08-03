/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.mjs), because a CommonJS file cannot
   require("vitest") directly. */

const supertest = require("supertest");

const app = require("../server");

const {
  maskAccountNumber,
  maskBsb,
  maskIfsc,
  maskFinancialFields,
} = require("../utils/maskSensitive");

const { redact } = require("../utils/activityLog");

const {
  createCompany,
  createMember,
  marker,
  cleanup,
  pool,
} = require("./helpers/testDb");

/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Regression coverage for F-12: subcontractor payment details must not be
| disclosed in bulk.
|
| The finding:
|   GET /api/subcontractors selected t.*, so one authenticated office
|   request returned every counterparty's full account number and IFSC.
|   The Subcontractors screen needed those values for its edit form,
|   detail modal and CSV export, so the fix could not be a simple
|   projection change — it needed a masked list plus a role-gated detail
|   endpoint.
|
| What these tests pin down:
|
|   1. The list masks account_number and ifsc_code, and returns no raw
|      value under any key.
|   2. The list never returns a TFN.
|   3. Create and update responses are masked too — masking the list alone
|      would leak the value back the moment a record was saved.
|   4. An administrator can retrieve full details from GET /:id.
|   5. A manager gets 403 from the same endpoint.
|   6. A cross-company id returns 404, not 403 — a 403 would confirm the
|      record exists.
|   7. A non-existent id returns 404.
|   8. Order of checks: a manager asking for ANOTHER company's id gets 404,
|      not 403, so the role refusal cannot be used to probe for records.
|   9. The audit redaction covers every sensitive field.
|  10. The masking helpers behave at their boundaries.
|
| Connected to:
|   backend/utils/maskSensitive.js
|   backend/utils/scopedCrud.js — the transformRow hook
|   backend/modules/subcontractors/
|   backend/utils/activityLog.js — REDACTED_KEYS
|   table: subcontractors
|
*/

const request = supertest(app);

let companyA;
let companyB;
let managerA;

let subA;
let subB;

const FULL_ACCOUNT = "123456789012";
const FULL_IFSC = "HDFC0001234";

/**
 * Inserts a subcontractor with banking directly.
 *
 * Written with SQL so the fixture is exact — going through POST would
 * exercise the masking on the way back and make it harder to tell what was
 * actually stored.
 */
const insertSubcontractor = async (
  companyId,
  label
) => {
  const result = await pool.query(
    `
    INSERT INTO public.subcontractors
      (company_id, full_name, phone, business_name,
       bank_name, account_name, account_number, ifsc_code, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
    RETURNING id
    `,
    [
      companyId,
      marker(label),
      "0400000000",
      `${label} Pty Ltd`,
      "Test Bank",
      "Acme Pty Ltd",
      FULL_ACCOUNT,
      FULL_IFSC,
    ]
  );

  return result.rows[0].id;
};

beforeAll(async () => {
  companyA = await createCompany(
    request,
    "finaccA"
  );

  companyB = await createCompany(
    request,
    "finaccB"
  );

  managerA = await createMember(
    request,
    companyA,
    { label: "finmanager", role: "manager" }
  );

  subA = await insertSubcontractor(
    companyA.companyId,
    "acmesub"
  );

  subB = await insertSubcontractor(
    companyB.companyId,
    "othersub"
  );
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

/*
|--------------------------------------------------------------------------
| The list endpoint
|--------------------------------------------------------------------------
*/
describe("F-12 · the list endpoint masks payment details", () => {
  it("returns masked identifiers, not raw ones", async () => {
    const response = await companyA
      .auth(request.get("/api/subcontractors"));

    expect(response.status).toBe(200);

    const row = response.body.subcontractors.find(
      (s) => Number(s.id) === Number(subA)
    );

    expect(row).toBeDefined();

    // The raw keys are gone entirely, not merely blanked.
    expect(row.account_number).toBeUndefined();
    expect(row.ifsc_code).toBeUndefined();

    expect(row.account_number_masked).toBe("••••9012");
    expect(row.ifsc_code_masked).toBe("••••1234");
    expect(row.has_bank_details).toBe(true);
  });

  /*
   * The strongest form of the assertion: the full value must not appear
   * anywhere in the serialised response, under any key. A projection that
   * renamed rather than removed the field would pass the check above and
   * fail this one.
   */
  it("does not contain the full account number anywhere in the payload", async () => {
    const response = await companyA
      .auth(request.get("/api/subcontractors"));

    const body = JSON.stringify(response.body);

    expect(body).not.toContain(FULL_ACCOUNT);
    expect(body).not.toContain(FULL_IFSC);
  });

  it("returns no TFN field", async () => {
    const response = await companyA
      .auth(request.get("/api/subcontractors"));

    const body = JSON.stringify(response.body);

    expect(body).not.toContain("tfn");
    expect(body).not.toContain("bsb");
  });

  /*
   * bank_name and account_name stay visible. Neither is usable without the
   * identifiers, and both are what a person reads to recognise a
   * counterparty — over-masking would make the screen useless.
   */
  it("still returns the descriptive banking fields", async () => {
    const response = await companyA
      .auth(request.get("/api/subcontractors"));

    const row = response.body.subcontractors.find(
      (s) => Number(s.id) === Number(subA)
    );

    expect(row.bank_name).toBe("Test Bank");
    expect(row.account_name).toBe("Acme Pty Ltd");
  });

  /*
   * Masking the list but echoing the value back from create would leak it
   * at exactly the moment nobody is looking.
   */
  it("masks the create response too", async () => {
    const response = await companyA
      .auth(request.post("/api/subcontractors"))
      .send({
        full_name: marker("createsub"),
        phone: "0411111111",
        account_number: "999888777666",
        ifsc_code: "ICIC0009999",
      });

    expect(response.status).toBe(201);
    expect(
      response.body.subcontractor.account_number
    ).toBeUndefined();
    expect(
      response.body.subcontractor.account_number_masked
    ).toBe("••••7666");

    expect(JSON.stringify(response.body)).not.toContain(
      "999888777666"
    );
  });

  it("masks the update response too", async () => {
    const response = await companyA
      .auth(
        request.put(`/api/subcontractors/${subA}`)
      )
      .send({
        full_name: marker("acmesub"),
        phone: "0400000000",
      });

    expect(response.status).toBe(200);
    expect(
      response.body.subcontractor.account_number
    ).toBeUndefined();

    // The stored value survived an edit that never mentioned it — the
    // factory's COALESCE keeps omitted fields.
    expect(
      response.body.subcontractor.account_number_masked
    ).toBe("••••9012");
  });
});

/*
|--------------------------------------------------------------------------
| The detail endpoint
|--------------------------------------------------------------------------
*/
describe("F-12 · GET /api/subcontractors/:id", () => {
  it("gives an administrator the full details", async () => {
    const response = await companyA
      .auth(
        request.get(`/api/subcontractors/${subA}`)
      );

    expect(response.status).toBe(200);
    expect(
      response.body.subcontractor.account_number
    ).toBe(FULL_ACCOUNT);
    expect(
      response.body.subcontractor.ifsc_code
    ).toBe(FULL_IFSC);
  });

  /*
   * A manager can manage the register but not read payment credentials.
   * That is the least-privilege split the fix introduces.
   */
  it("refuses a manager with 403", async () => {
    const response = await managerA
      .auth(
        request.get(`/api/subcontractors/${subA}`)
      );

    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).not.toContain(
      FULL_ACCOUNT
    );
  });

  /*
   * Cross-tenant. Company B's administrator IS permitted to see payment
   * details in general, so a 200 here would be a real leak.
   */
  it("returns 404 for another company's subcontractor", async () => {
    const response = await companyA
      .auth(
        request.get(`/api/subcontractors/${subB}`)
      );

    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain(
      FULL_ACCOUNT
    );
  });

  it("returns 404 for a non-existent id", async () => {
    const response = await companyA
      .auth(
        request.get("/api/subcontractors/99999999")
      );

    expect(response.status).toBe(404);
  });

  /*
   * The ordering assertion, and the subtlest one.
   *
   * A manager asking for ANOTHER company's record must get 404, not 403.
   * If the role check ran first, the two codes would differ by whether the
   * record exists — and a manager could enumerate other tenants'
   * subcontractor ids by watching which one came back.
   */
  it("prefers 404 over 403 for a cross-company id", async () => {
    const response = await managerA
      .auth(
        request.get(`/api/subcontractors/${subB}`)
      );

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(403);
  });

  it("rejects a malformed id with 400", async () => {
    const response = await companyA
      .auth(
        request.get("/api/subcontractors/not-an-id")
      );

    expect(response.status).toBe(400);
  });
});

/*
|--------------------------------------------------------------------------
| Audit redaction
|--------------------------------------------------------------------------
|
| The other half of F-12. tender_banking IS audited and its rows carry
| account_number, so these names had to reach REDACTED_KEYS.
|
*/
describe("F-12 · audit redaction covers payment identifiers", () => {
  it("redacts every sensitive financial field", () => {
    const cleaned = redact({
      account_number: FULL_ACCOUNT,
      ifsc_code: FULL_IFSC,
      bsb: "062-000",
      tfn: "123456782",
      bank_name: "Test Bank",
      account_name: "Acme Pty Ltd",
    });

    expect(cleaned.account_number).toBe("[redacted]");
    expect(cleaned.ifsc_code).toBe("[redacted]");
    expect(cleaned.bsb).toBe("[redacted]");
    expect(cleaned.tfn).toBe("[redacted]");

    expect(cleaned.bank_name).toBe("Test Bank");
    expect(cleaned.account_name).toBe("Acme Pty Ltd");
  });
});

/*
|--------------------------------------------------------------------------
| The masking helpers
|--------------------------------------------------------------------------
*/
describe("F-12 · masking helpers", () => {
  it("shows only the last four of an account number", () => {
    expect(maskAccountNumber("123456789012")).toBe("••••9012");
  });

  /*
   * The boundary that matters. Showing "the last four" of a four-digit
   * value would show all of it.
   */
  it("fully masks a short account number", () => {
    expect(maskAccountNumber("1234")).toBe("••••");
    expect(maskAccountNumber("12")).toBe("••••");
  });

  it("returns null for an absent account number", () => {
    expect(maskAccountNumber(null)).toBeNull();
    expect(maskAccountNumber("")).toBeNull();
    expect(maskAccountNumber(undefined)).toBeNull();
  });

  it("masks a BSB to its last three digits", () => {
    expect(maskBsb("062000")).toBe("•••-000");

    // Separators are stripped first, so both spellings mask identically.
    expect(maskBsb("062-000")).toBe("•••-000");
  });

  it("masks an IFSC to its branch suffix", () => {
    expect(maskIfsc("HDFC0001234")).toBe("••••1234");
  });

  it("removes raw fields rather than blanking them", () => {
    const masked = maskFinancialFields({
      id: 1,
      full_name: "Acme",
      account_number: FULL_ACCOUNT,
      ifsc_code: FULL_IFSC,
      tfn: "123456782",
    });

    expect("account_number" in masked).toBe(false);
    expect("ifsc_code" in masked).toBe(false);
    expect("tfn" in masked).toBe(false);

    expect(masked.full_name).toBe("Acme");
    expect(masked.has_bank_details).toBe(true);
  });

  it("does not mutate the row it was given", () => {
    const row = {
      account_number: FULL_ACCOUNT,
    };

    maskFinancialFields(row);

    // The caller's object is untouched — the detail endpoint relies on
    // being able to return the full row after the list has masked a copy.
    expect(row.account_number).toBe(FULL_ACCOUNT);
  });

  it("reports no bank details when none are stored", () => {
    const masked = maskFinancialFields({
      id: 2,
      account_number: null,
    });

    expect(masked.has_bank_details).toBe(false);
    expect(masked.account_number_masked).toBeNull();
  });
});
