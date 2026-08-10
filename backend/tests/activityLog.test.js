/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.mjs), because a CommonJS file cannot
   require("vitest") directly. */

const supertest = require("supertest");

const app = require("../server");

const {
  redact,
  diff,
} = require("../utils/activityLog");

const {
  createCompany,
  cleanup,
  today,
  pool,
} = require("./helpers/testDb");

/*
|--------------------------------------------------------------------------
| Audit trail
|--------------------------------------------------------------------------
|
| activity_logs and GET /api/activity both existed, and so did a complete
| utils/activityLog.js — but nothing ever called it. The endpoint served an
| always-empty table.
|
| For a system that moves money and records approvals, "who changed this
| figure" is the question you most need answered, so the writer is now
| attached to every mutating route on payments, worker allocations and
| expenses, daily update approvals, tenders and their children, and user
| management.
|
*/

const request = supertest(app);

let company;

beforeAll(async () => {
  company = await createCompany(request, "audit");
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

const query = async (module, action) => {
  const { rows } = await pool.query(
    `SELECT * FROM activity_logs
      WHERE company_id = $1 AND module = $2 AND action = $3
      ORDER BY id DESC`,
    [company.companyId, module, action]
  );

  return rows;
};

/**
 * Audit writes are deliberately not awaited by the request — an audit miss
 * is bad, but failing a payment because the audit insert was slow is
 * worse. That means the row can land just after the response, so read it
 * with a short poll rather than assuming it is already there.
 */
const rowsFor = async (module, action, { atLeast = 1 } = {}) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = await query(module, action);

    if (rows.length >= atLeast) {
      return rows;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return query(module, action);
};

describe("redaction", () => {
  it("strips credentials at any depth", () => {
    const cleaned = redact({
      email: "a@b.test",
      password: "hunter2",
      nested: {
        password_hash: "$2b$12$abcdef",
        reset_token: "deadbeef",
        keep: "visible",
      },
      list: [{ token: "jwt.value" }],
    });

    expect(cleaned.email).toBe("a@b.test");
    expect(cleaned.password).toBe("[redacted]");
    expect(cleaned.nested.password_hash).toBe("[redacted]");
    expect(cleaned.nested.reset_token).toBe("[redacted]");
    expect(cleaned.nested.keep).toBe("visible");
    expect(cleaned.list[0].token).toBe("[redacted]");
  });

  /*
   * F-12 regression.
   *
   * REDACTED_KEYS previously listed only the ENCRYPTED worker column names
   * (encrypted_account_number, encrypted_bsb, encrypted_tfn). The
   * plain-text equivalents were absent, so a payload carrying one reached
   * activity_logs verbatim.
   *
   * That was live, not theoretical: tender_banking is audited via
   * logActivity in tender.routes.js and its rows carry account_number.
   */
  it("strips plain-text payment identifiers", () => {
    const cleaned = redact({
      bank_name: "Test Bank",
      account_name: "Acme Pty Ltd",
      account_number: "123456789",
      ifsc_code: "TEST0001234",
      bsb: "062-000",
      tfn: "123456782",
    });

    expect(cleaned.account_number).toBe("[redacted]");
    expect(cleaned.ifsc_code).toBe("[redacted]");
    expect(cleaned.bsb).toBe("[redacted]");
    expect(cleaned.tfn).toBe("[redacted]");

    /*
     * Deliberately still visible. Neither is usable without the
     * identifiers above, and "the bank was changed from X to Y" is
     * precisely what the audit trail exists to answer — over-redacting
     * would make it useless for the case it is most needed in.
     */
    expect(cleaned.bank_name).toBe("Test Bank");
    expect(cleaned.account_name).toBe("Acme Pty Ltd");
  });

  /*
   * The realistic shape: a diff of a tender banking record, which is the
   * audited path that was actually leaking.
   */
  it("strips payment identifiers from a before/after diff", () => {
    const result = diff(
      {
        id: 7,
        bank_name: "Old Bank",
        account_number: "111111111",
      },
      {
        id: 7,
        bank_name: "New Bank",
        account_number: "222222222",
      }
    );

    expect(result.old.account_number).toBe("[redacted]");
    expect(result.new.account_number).toBe("[redacted]");

    // The change is still legible without exposing the number.
    expect(result.old.bank_name).toBe("Old Bank");
    expect(result.new.bank_name).toBe("New Bank");
  });

  it("keeps timestamps readable", () => {
    // node-pg hands back Date objects. Walking into one the way a plain
    // object is walked yields {} and loses the value entirely.
    const when = new Date("2026-08-01T10:00:00.000Z");

    expect(redact({ created_at: when }).created_at).toBe(
      "2026-08-01T10:00:00.000Z"
    );
  });
});

describe("diff", () => {
  it("records only the fields that changed", () => {
    const result = diff(
      { id: 1, amount: 100, note: "same" },
      { id: 1, amount: 250, note: "same" }
    );

    expect(result.old).toEqual({ amount: 100 });
    expect(result.new).toEqual({ amount: 250 });
  });

  it("treats a numeric and its string form as equal", () => {
    // pg returns NUMERIC as a string, so 100 and "100" are one value in
    // two shapes and must not show up as a change.
    const result = diff({ amount: 100 }, { amount: "100" });

    expect(result.old).toEqual({});
    expect(result.new).toEqual({});
  });
});

describe("writes an audit row for money and approvals", () => {
  let tenderId;

  it("records a tender being created", async () => {
    const res = await company
      .auth(request.post("/api/tenders"))
      .send({
        title: "Audited Tender",
        status: "running",
        estimated_value: 500000,
        sites: [{ site_name: "S1", address: "1 Road" }],
      });

    expect(res.status).toBe(201);

    tenderId = res.body.tender.id;

    const rows = await rowsFor("tenders", "create");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].record_id).toBe(String(tenderId));
    expect(rows[0].user_id).toBe(company.user.id);
  });

  it("records a payment being created", async () => {
    const res = await company
      .auth(request.post("/api/payments"))
      .send({
        payment_direction: "income",
        payment_scope: "OFFICE",
        payment_sub_type: "TDS",
        amount: 42000,
        payment_date: today(),
      });

    expect(res.status).toBe(201);

    const rows = await rowsFor("payments", "create");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].new_data.amount).toBe("42000.00");
  });

  it("records a delete and the restore that follows it", async () => {
    await company.auth(request.delete(`/api/tenders/${tenderId}`));
    await company.auth(request.post(`/api/tenders/${tenderId}/restore`));

    expect((await rowsFor("tenders", "delete")).length).toBeGreaterThan(0);
    expect((await rowsFor("tenders", "restore")).length).toBeGreaterThan(0);
  });

  it("never stores a password", async () => {
    await company
      .auth(request.post("/api/auth/users"))
      .send({
        full_name: "Audited Member",
        email: `audit-member-${Date.now()}@test.local`,
        password: "NeverStoreThis!99",
        role: "manager",
      });

    await rowsFor("users", "create");

    const { rows } = await pool.query(
      `SELECT count(*)::int AS leaks FROM activity_logs
        WHERE new_data::text LIKE '%NeverStoreThis%'
           OR old_data::text LIKE '%NeverStoreThis%'`
    );

    expect(rows[0].leaks).toBe(0);
  });

  it("does not record a request that failed", async () => {
    const before = (await rowsFor("payments", "create")).length;

    const res = await company
      .auth(request.post("/api/payments"))
      .send({ amount: -1 });

    expect(res.status).toBeGreaterThanOrEqual(400);

    // Long enough that a write would have landed if one had been made.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const after = (await query("payments", "create")).length;

    expect(after).toBe(before);
  });
});

/*
|--------------------------------------------------------------------------
| F-08 · the depth cap must fail closed
|--------------------------------------------------------------------------
|
| `redact()` walks a payload and replaces anything in REDACTED_KEYS. It stops
| descending past six levels, and it used to return the remaining subtree
| UNTOUCHED — so a redacted key sitting deeper than the cap was written to
| activity_logs verbatim.
|
| Since F-12 that list includes payment identifiers, which makes the failure
| mode an account number surviving into a table retained longer and read more
| widely than the register it came from.
|
| No current payload nests anywhere near this deep, and that is precisely the
| argument for closing it: the guard only ever runs on a shape nobody
| anticipated, and an unanticipated shape is the one not to trust.
|
*/

describe("F-08 · redact() fails closed below the depth cap", () => {
  /** Wraps a value n levels deep. */
  const nest = (value, levels) => {
    let out = value;

    for (let i = 0; i < levels; i += 1) {
      out = { level: out };
    }

    return out;
  };

  it("does not emit a redacted key that sits below the cap", () => {
    const deep = nest({ account_number: "123456789" }, 8);

    const serialised = JSON.stringify(redact(deep));

    expect(serialised).not.toContain("123456789");
  });

  it("marks the truncation rather than dropping it silently", () => {
    const deep = nest({ anything: "value" }, 8);

    expect(JSON.stringify(redact(deep))).toContain("[truncated]");
  });

  it("still returns shallow payloads in full", () => {
    // The cap must not damage the shapes that actually occur.
    const shallow = {
      full_name: "Ravi",
      nested: { amount: 2500 },
    };

    expect(redact(shallow)).toEqual(shallow);
  });

  it("keeps null distinguishable from a truncated subtree", () => {
    expect(redact(null)).toBe(null);
  });
});
