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

/*
|--------------------------------------------------------------------------
| The tree the form is built from
|--------------------------------------------------------------------------
|
| The Add Payment form used to be built from a second copy of this tree
| hard-coded in the frontend, and the two drifted: the form offered three
| subcontractor expense types the server refuses, and hid two it accepts.
|
| The form now reads GET /api/payments/hierarchy, so these assert the two
| things that made the drift possible — every option the tree offers is a
| combination the validator accepts, and the endpoint really does serve the
| whole tree.
|
*/

describe("payment hierarchy", () => {
  const {
    INCOME_SECTIONS,
    EXPENSE_SECTIONS,
    isValidCombination,
  } = require("../modules/payments/payment.hierarchy");

  /*
   * Walks a section down to its leaves. Most branches are two levels, but
   * "Site" under a personal-tender expense carries a third — the
   * notebook's A. Order / B. Salary / C. Labour / D. GST / E. Other — as
   * `groups`.
   */
  const leaves = (node, label) => {
    const groups = node.groups ?? [];

    if (groups.length > 0) {
      return groups.map((group) => ({
        subType: group.subType,
        fields: group.fields,
        label: `${label} / ${group.label}`,
      }));
    }

    const children = node.children ?? [];

    if (children.length > 0) {
      return children.flatMap((child) =>
        leaves(child, `${label} / ${child.label}`)
      );
    }

    return [{ subType: node.subType, fields: node.fields, label }];
  };

  const offered = (sections, direction) =>
    sections.flatMap((section) =>
      leaves(section, section.label).map((leaf) => ({
        ...leaf,
        direction,
        scope: section.scope,
      }))
    );

  const everyOption = [
    ...offered(INCOME_SECTIONS, "income"),
    ...offered(EXPENSE_SECTIONS, "expense"),
  ];

  it("offers only combinations the validator accepts", () => {
    const rejected = everyOption.filter(
      (option) =>
        !isValidCombination(
          option.direction,
          option.scope,
          option.subType
        )
    );

    expect(rejected).toEqual([]);
  });

  it("gives every option a sub-type and a scope", () => {
    for (const option of everyOption) {
      expect(option.subType, option.label).toBeTruthy();
      expect(option.scope, option.label).toBeTruthy();
    }
  });

  it("describes the fields each option needs", () => {
    // The form renders from these, so an option with no fields would show
    // the user an empty form.
    for (const option of everyOption) {
      expect(option.fields?.length, option.label).toBeGreaterThan(0);
    }
  });

  it("offers every combination the validator accepts", () => {
    // The other direction: a combination the server would accept but no
    // option reaches is a payment the user cannot record. Material and
    // Labour against a personal tender were exactly that, because the
    // client dropped the third level of the tree.
    const reachable = new Set(
      everyOption.map(
        (option) =>
          `${option.direction}|${option.scope}|${option.subType}`
      )
    );

    const {
      VALID_COMBINATIONS,
    } = require("../modules/payments/payment.hierarchy");

    const unreachable = [...VALID_COMBINATIONS].filter(
      (combination) => !reachable.has(combination)
    );

    expect(unreachable).toEqual([]);
  });
});
