/* describe / it / expect / beforeAll / afterAll come from Vitest globals
   (globals: true in vitest.config.js), because a CommonJS file cannot
   require("vitest") directly. */

const {
  calculateCompanyCharge,
  calculateInterest,
  calculateGst,
  validatePayment,
  round2,
} = require("../modules/payments/payment.service");

const {
  daysAgo: entryDaysAgo,
} = require("../modules/siteOperations/entryWindow.service");

/*
|--------------------------------------------------------------------------
| Money maths
|--------------------------------------------------------------------------
|
| Pure functions, so these run without a database.
|
| The company-charge case is taken directly from the worked example in the
| operations notebook, which makes it a regression test against the real
| business rule rather than against my reading of it.
|
*/

describe("company charge", () => {
  it("reproduces the notebook example: bill 12000 at 2% = 240", () => {
    const result = calculateCompanyCharge({
      billAmount: 12000,
      chargePercent: 2,
      gstTotal: 0,
      gstReceived: 0,
    });

    expect(result.charge_amount).toBe(240);
    // The charge is the income, not the bill.
    expect(result.amount).toBe(240);
    expect(result.bill_amount).toBe(12000);
  });

  it.each([
    [100000, 1, 1000],
    [100000, 3, 3000],
    [100000, 5, 5000],
  ])(
    "bill %i at %i%% gives %i",
    (bill, percent, expected) => {
      expect(
        calculateCompanyCharge({
          billAmount: bill,
          chargePercent: percent,
        }).charge_amount
      ).toBe(expected);
    }
  );

  it("tracks GST received against GST remaining", () => {
    const result = calculateCompanyCharge({
      billAmount: 12000,
      chargePercent: 2,
      gstTotal: 2160,
      gstReceived: 500,
    });

    expect(result.gst_total).toBe(2160);
    expect(result.gst_received).toBe(500);
    expect(result.gst_left).toBe(1660);
  });

  it("never reports a negative outstanding GST", () => {
    const result = calculateCompanyCharge({
      billAmount: 12000,
      chargePercent: 2,
      gstTotal: 1000,
      // More collected than was due; the remainder is zero, not -500.
      gstReceived: 1500,
    });

    expect(result.gst_left).toBe(0);
  });
});

describe("investor interest", () => {
  it("accrues simple interest per day", () => {
    const result = calculateInterest({
      principal: 500000,
      interestPercent: 12,
      fromDate: "2026-01-01",
      accruedTo: new Date("2026-04-01"),
    });

    // 500000 * 12% / 365 = 164.38 per day
    expect(result.daily_interest).toBe(164.38);
    expect(result.days_accrued).toBe(90);
    expect(result.interest_amount).toBe(
      round2(164.3835616438356 * 90)
    );
  });

  it("returns zero when no rate was agreed", () => {
    const result = calculateInterest({
      principal: 500000,
      interestPercent: 0,
      fromDate: "2026-01-01",
    });

    expect(result.interest_amount).toBe(0);
  });

  it("does not accrue backwards for a future date", () => {
    const result = calculateInterest({
      principal: 1000,
      interestPercent: 10,
      fromDate: "2027-01-01",
      accruedTo: new Date("2026-01-01"),
    });

    expect(result.days_accrued).toBe(0);
    expect(result.interest_amount).toBe(0);
  });
});

describe("GST", () => {
  it("derives GST from a percentage", () => {
    const result = calculateGst({
      amount: 100000,
      gstPercent: 18,
    });

    expect(result.gst_amount).toBe(18000);
    expect(result.gst_total).toBe(118000);
  });

  it("prefers an explicit GST amount over a rate", () => {
    const result = calculateGst({
      amount: 1200000,
      gstAmount: 216000,
    });

    expect(result.gst_amount).toBe(216000);
    expect(result.gst_percent).toBe(18);
  });
});

/*
|--------------------------------------------------------------------------
| Hierarchy validation
|--------------------------------------------------------------------------
*/

describe("payment validation", () => {
  const base = {
    payment_direction: "income",
    payment_date: "2026-01-01",
    amount: 1000,
  };

  it("accepts a combination the notebook defines", () => {
    const errors = validatePayment({
      ...base,
      payment_scope: "PERSONAL_TENDER",
      payment_sub_type: "INVESTOR",
      investor_name: "Kirit",
      tender_id: 1,
    });

    expect(errors).toEqual([]);
  });

  it("rejects a combination it does not", () => {
    // Investor money always belongs to a tender, never to the office.
    const errors = validatePayment({
      ...base,
      payment_scope: "OFFICE",
      payment_sub_type: "INVESTOR",
      investor_name: "Kirit",
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(" ")).toMatch(
      /not a valid income entry under OFFICE/
    );
  });

  it("requires a tender for tender-scoped entries", () => {
    const errors = validatePayment({
      ...base,
      payment_scope: "PERSONAL_TENDER",
      payment_sub_type: "GOVERNMENT_BILL",
    });

    expect(errors.join(" ")).toMatch(
      /Select a tender/
    );
  });

  it("rejects a zero or negative amount", () => {
    expect(
      validatePayment({
        ...base,
        amount: 0,
        payment_scope: "OFFICE",
        payment_sub_type: "TDS",
      }).join(" ")
    ).toMatch(/greater than zero/);

    expect(
      validatePayment({
        ...base,
        amount: -50,
        payment_scope: "OFFICE",
        payment_sub_type: "TDS",
      }).join(" ")
    ).toMatch(/greater than zero/);
  });

  it("requires an investor name for investor entries", () => {
    const errors = validatePayment({
      ...base,
      payment_scope: "PERSONAL_TENDER",
      payment_sub_type: "INVESTOR",
      tender_id: 1,
    });

    expect(errors.join(" ")).toMatch(
      /investor name is required/i
    );
  });
});

/*
|--------------------------------------------------------------------------
| Entry window date maths
|--------------------------------------------------------------------------
|
| This is where a timezone bug bit during development: comparing against
| UTC midnight rejected the current day as "future" for anyone east of
| Greenwich after 18:30 local.
|
*/

describe("entry window date arithmetic", () => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const shift = (days) =>
    new Date(
      Date.parse(today) - days * 86400000
    )
      .toISOString()
      .slice(0, 10);

  it.each([
    ["today", 0],
    ["yesterday", 1],
    ["two days ago", 2],
    ["ten days ago", 10],
  ])("counts %s correctly", (_label, days) => {
    expect(
      entryDaysAgo(shift(days), "Asia/Kolkata")
    ).toBe(days);
  });

  it("reports a future date as negative", () => {
    expect(
      entryDaysAgo(shift(-1), "Asia/Kolkata")
    ).toBe(-1);
  });

  it("returns null for an unusable value", () => {
    expect(entryDaysAgo("not-a-date")).toBeNull();
    expect(entryDaysAgo(null)).toBeNull();
    expect(entryDaysAgo("")).toBeNull();
  });

  it("treats today as today regardless of the hour", () => {
    // The bug this guards against only appeared in the evening, when the
    // UTC date had already rolled over but the local one had not.
    expect(
      entryDaysAgo(today, "Asia/Kolkata")
    ).toBe(0);
  });
});
