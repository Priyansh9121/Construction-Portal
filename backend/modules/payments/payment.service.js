/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The money layer. Every figure the payments module stores is computed
| here, and every payment payload is validated here before it reaches a
| query.
|
| The governing rule: the server calculates, the client does not. A request
| may carry a derived figure — the frontend shows running totals as a user
| types — but it is recalculated from the inputs rather than trusted.
| Otherwise a rounding difference, a stale form, or an edited request
| becomes the recorded amount, and financial records must not be
| falsifiable by their own client.
|
| Responsibilities:
|   - Coerce money safely (never NaN, never float noise)
|   - Compute company charge, interest and GST from the operations notes
|   - Validate a payment against the direction/sub-type/scope hierarchy
|   - Enforce the per-sub-type required fields
|   - Build the final record the controller writes
|
| Exports:
|   money, round2                 numeric helpers, used across modules
|   calculateCompanyCharge        the company's percentage cut of a bill
|   calculateInterest             simple interest on investor money
|   calculateGst                  GST split
|   validatePayment               hierarchy + required-field validation
|   buildPaymentRecord            the final row shape
|
| Used by:
|   ./payment.controller.js — create and update
|   modules/masters/master.controller.js — imports calculateInterest and
|     money for the investor statement, so the statement and the Payments
|     screen can never disagree about what an investor is owed
|
| Depends on:
|   ./payment.hierarchy.js — the valid direction/sub-type/scope
|     combinations, transcribed from the "Add Payment" notebook
|
| Database tables touched:
|   none. This file is pure computation and validation; payment.controller
|   owns the SQL.
|
| Provenance:
|   The formulas are transcribed from the office's own notes, and the
|   comments cite page numbers and the original Gujarati terms — મળેલ
|   (received) and બાકી (remaining). Those citations are the specification;
|   they should survive any refactor of this file.
|
| Tested by:
|   backend/tests/paymentCalculations.test.js
|
*/

const {
  DIRECTIONS,
  SUB_TYPES,
  ALL_SUB_TYPES,
  ALL_SCOPES,
  isValidCombination,
} = require("./payment.hierarchy");

/*
|--------------------------------------------------------------------------
| Payment calculations
|--------------------------------------------------------------------------
|
| Money is computed here, on the server, from the inputs the notes describe.
| The client may send a derived figure, but it is recalculated rather than
| trusted — otherwise a rounding difference or an edited request silently
| becomes the recorded amount.
|
*/

/**
 * Parses to a finite number, defaulting rather than producing NaN.
 *
 * Purpose:
 * The entry point for every figure in this module. Money arrives from two
 * directions that disagree on type — JSON bodies carry strings, and
 * node-pg returns NUMERIC columns as strings too — so nothing here can
 * assume it was handed a number.
 *
 * Parameters:
 * value    - anything; typically a number, numeric string, null or ""
 * fallback - returned when the value is absent or unparseable
 *
 * Returns:
 * A finite number. Never NaN and never Infinity.
 *
 * Security:
 * Stronger than it looks for a financial module. NaN propagates silently —
 * every comparison against it is false, and any total it touches becomes
 * NaN — so a single unparseable field could turn a running balance into
 * null in the database with no error raised anywhere. Excluding it here
 * means a bad input becomes 0, which is wrong but visible.
 */
const money = (value, fallback = 0) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
};

/**
 * Rounds to paise. Financial totals should not carry float noise.
 *
 * Purpose:
 * IEEE-754 doubles cannot represent most decimal fractions exactly, so
 * `0.1 + 0.2` is 0.30000000000000004. Left alone, a percentage
 * calculation stores 239.99999999999997 where the office wrote 240, and
 * every later sum drifts further.
 *
 * Parameters:
 * value - anything money() accepts
 *
 * Returns:
 * The value rounded to two decimal places.
 *
 * Notes:
 * Number.EPSILON nudges values sitting a hair below a rounding boundary
 * up onto it. Without it `Math.round(1.005 * 100) / 100` gives 1 rather
 * than 1.01, because 1.005 is actually stored as slightly less than
 * 1.005.
 *
 * This is not exact decimal arithmetic — the correct answer for money is
 * integer paise or a decimal library — but it is enough for the
 * magnitudes here, and it matches what the office's own arithmetic
 * produces. Worth revisiting if these figures ever feed a reconciliation
 * that must balance to the paise.
 */
const round2 = (value) =>
  Math.round(
    (money(value) + Number.EPSILON) *
      100
  ) / 100;

/**
 * Company charge (notes p.04).
 *
 *   "Tender BVN1460, bill 12000, 2% -> 240"
 *
 * The charge is a percentage of the bill. GST on it is tracked as received
 * (મળેલ) versus remaining (બાકી), which is what the two columns beside the
 * tender name are recording.
 */
const calculateCompanyCharge = ({
  billAmount,
  chargePercent,
  gstTotal,
  gstReceived,
}) => {
  const bill = money(billAmount);

  const percent = money(
    chargePercent
  );

  const chargeAmount = round2(
    (bill * percent) / 100
  );

  const totalGst = money(gstTotal);

  const receivedGst = money(
    gstReceived
  );

  return {
    bill_amount: round2(bill),
    company_charge_percent: percent,
    charge_amount: chargeAmount,
    company_charge_total:
      chargeAmount,
    gst_total: round2(totalGst),
    gst_received: round2(receivedGst),
    // Never report a negative outstanding balance.
    gst_left: round2(
      Math.max(
        totalGst - receivedGst,
        0
      )
    ),
    // The charge is the income; the bill itself is not.
    amount: chargeAmount,
  };
};

/**
 * Interest accrued on investor money (notes p.02).
 *
 *   "However many % interest the money came at — keep the extra per-day
 *    interest recorded."
 *
 * Simple interest, pro-rated by day:
 *
 *     amount x rate% x days / 365
 *
 * accruedTo defaults to today, so a caller can ask "what is owed as of now".
 *
 * Parameters (one options object):
 * principal       - the sum taken from the investor
 * interestPercent - the annual rate agreed with them
 * fromDate        - when the money was received; accrual starts here
 * accruedTo       - the "as of" date, defaulting to now
 *
 * Returns:
 * { interest_amount, days_accrued, daily_interest }, all rounded to paise.
 * All three are zero when the inputs make accrual meaningless.
 *
 * Side effects:
 * None. Nothing is stored — interest is recomputed on every read, so a
 * statement is correct as of the moment it is requested rather than as of
 * the last time someone recalculated it.
 *
 * Business rules:
 * - Simple interest, not compound. That is what the notes describe, and
 *   changing it would silently restate every historical balance.
 * - 365-day year, so a leap year is not special-cased. Consistent with the
 *   office's own arithmetic.
 * - Whole days only. Interest starts accruing the day AFTER the money
 *   arrived; a payment received today has accrued nothing.
 * - Zero principal, zero rate, or a missing date all yield zero rather
 *   than an error — an interest-free investor loan is a normal record.
 *
 * Notes:
 * `Math.max(..., 0)` clamps a negative span to zero, so asking for the
 * position at a date BEFORE the money arrived reports no interest rather
 * than a negative amount owed.
 *
 * The day count divides by a fixed 86,400,000 ms. Unlike the entry-window
 * arithmetic in F-13 this is not a timezone bug: both endpoints are
 * absolute instants and the result is deliberately a count of elapsed
 * 24-hour periods, not of calendar days. A DST transition would shift the
 * boundary by an hour, which cannot change a whole-day floor except for a
 * payment timed within an hour of midnight.
 *
 * Used by:
 * modules/masters/master.controller.js for the investor statement, which
 * is why this must stay the single implementation.
 */
const calculateInterest = ({
  principal,
  interestPercent,
  fromDate,
  accruedTo = new Date(),
}) => {
  const amount = money(principal);

  const rate = money(interestPercent);

  if (
    amount <= 0 ||
    rate <= 0 ||
    !fromDate
  ) {
    return {
      interest_amount: 0,
      days_accrued: 0,
      daily_interest: 0,
    };
  }

  const start = new Date(fromDate);

  const end = new Date(accruedTo);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return {
      interest_amount: 0,
      days_accrued: 0,
      daily_interest: 0,
    };
  }

  const days = Math.max(
    Math.floor(
      (end - start) / 86400000
    ),
    0
  );

  const dailyInterest =
    (amount * rate) / 100 / 365;

  return {
    interest_amount: round2(
      dailyInterest * days
    ),
    days_accrued: days,
    daily_interest: round2(
      dailyInterest
    ),
  };
};

/**
 * Splits a gross amount into base and GST when a rate is supplied.
 *
 * Treats `amount` as GST-exclusive, which matches how the material and
 * government-bill screens capture it.
 */
/**
 * Splits an amount into its base and GST components.
 *
 * Purpose:
 * A payment may be entered either as "this much plus 18% GST" or as "this
 * much, of which this is GST" — both happen, depending on what the source
 * document states. This normalises the two into the same four fields.
 *
 * Parameters (one options object):
 * amount     - the base amount, exclusive of GST
 * gstPercent - the rate, used when no explicit amount is given
 * gstAmount  - an explicit GST figure; takes precedence when supplied
 *
 * Returns:
 * { amount, gst_percent, gst_amount, gst_total }, all rounded to paise.
 * gst_total is the inclusive figure.
 *
 * Business rules:
 * - An explicit gst_amount always wins, and the percentage is then
 *   BACK-CALCULATED from it rather than the other way round. That matters
 *   when a supplier's invoice states a GST figure that does not divide to
 *   a round percentage — the stated figure is authoritative, and forcing
 *   it to match a clean rate would misstate the bill.
 * - Presence is tested rather than truthiness, so an explicit gst_amount
 *   of 0 is honoured as "no GST on this" rather than falling through to
 *   the percentage branch.
 *
 * Notes:
 * The `base ? ... : 0` guard prevents a division by zero when an explicit
 * GST amount accompanies a zero base. The percentage is meaningless in
 * that case, so it is reported as 0 rather than Infinity.
 */
const calculateGst = ({
  amount,
  gstPercent,
  gstAmount,
}) => {
  const base = money(amount);

  // An explicit GST amount always wins over a recomputed one.
  if (
    gstAmount !== undefined &&
    gstAmount !== null &&
    gstAmount !== ""
  ) {
    const explicit = money(gstAmount);

    return {
      amount: round2(base),
      gst_percent: base
        ? round2(
            (explicit / base) * 100
          )
        : 0,
      gst_amount: round2(explicit),
      gst_total: round2(
        base + explicit
      ),
    };
  }

  const percent = money(gstPercent);

  const gst = round2(
    (base * percent) / 100
  );

  return {
    amount: round2(base),
    gst_percent: percent,
    gst_amount: gst,
    gst_total: round2(base + gst),
  };
};

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

/**
 * Field requirements per sub-type, mirroring the hierarchy definition.
 */
/**
 * Extra fields each payment sub-type cannot be recorded without.
 *
 * Purpose:
 * The base payment fields — amount, date, direction — are required for
 * everything. These are the additional ones that make a payment
 * identifiable after the fact: an investor payment without a name, or a
 * material purchase without a material, is a figure nobody can later
 * account for.
 *
 * Shape:
 * sub-type -> array of required field names. A sub-type absent from this
 * map has no extra requirements, which is the common case.
 *
 * Business rules:
 * - INVESTOR needs a name, since the investor statement matches on it —
 *   see the legacy-name fallback in master.controller.js.
 * - LABOUR, SUPERVISOR and SALARY all need worker_name. They are three
 *   different kinds of payment to a person, and all three are useless
 *   without knowing which person.
 * - COMPANY_CHARGE needs both the bill amount and the percentage, because
 *   the recorded amount is DERIVED from them by calculateCompanyCharge
 *   rather than entered directly.
 *
 * Notes:
 * Keyed by the SUB_TYPES constants rather than string literals, so a
 * rename in payment.hierarchy.js cannot leave this map silently pointing
 * at a sub-type that no longer exists.
 */
const REQUIRED_BY_SUB_TYPE = {
  [SUB_TYPES.INVESTOR]: [
    "investor_name",
  ],
  [SUB_TYPES.MATERIAL]: [
    "material_name",
  ],
  [SUB_TYPES.LABOUR]: ["worker_name"],
  [SUB_TYPES.SUPERVISOR]: [
    "worker_name",
  ],
  [SUB_TYPES.SALARY]: ["worker_name"],
  [SUB_TYPES.COMPANY_CHARGE]: [
    "bill_amount",
    "company_charge_percent",
  ],
};

/**
 * Validates an Add Payment payload against the hierarchy.
 *
 * Returns an array of messages; empty means valid.
 */
/**
 * Validates a payment payload against the hierarchy and the field rules.
 *
 * Purpose:
 * A payment is described by three dimensions at once — direction (income
 * or expense), scope (personal tender, subcontractor, office) and sub-type
 * (investor, material, labour, …) — and only certain combinations are
 * meaningful. This checks all three individually and then checks that they
 * make sense together.
 *
 * Parameters:
 * payload - the request body
 *
 * Returns:
 * An array of error message strings. Empty means valid. The caller turns a
 * non-empty array into a 400.
 *
 * Side effects:
 * None.
 *
 * Business rules:
 * - Direction must be income or expense.
 * - A payment date is always required; a payment with no date cannot be
 *   placed in any period and corrupts every report it appears in.
 * - Scope and sub-type, when supplied, must exist in the hierarchy.
 * - The COMBINATION must exist. An office-scoped investor payment is
 *   nonsense — investor money belongs to a tender — and isValidCombination
 *   is what encodes that, transcribed from the office's own notebook.
 * - Each sub-type's extra required fields, from REQUIRED_BY_SUB_TYPE.
 *
 * Notes:
 * Collects ALL errors rather than returning at the first. A user fixing a
 * payment form should be told everything that is wrong at once, not made
 * to resubmit five times.
 *
 * The combination check is guarded on all three values being present and
 * individually valid. Without that guard an unrecognised scope would
 * produce two errors — "invalid scope" and "not a valid entry under
 * undefined" — the second of which is noise.
 *
 * Tested by backend/tests/paymentCalculations.test.js.
 */
const validatePayment = (payload) => {
  /*
   * Accumulated rather than thrown one at a time, so the response can name
   * every problem in the payload at once.
   */
  const errors = [];

  const direction = String(
    payload.payment_direction || ""
  ).toLowerCase();

  if (
    ![
      DIRECTIONS.INCOME,
      DIRECTIONS.EXPENSE,
    ].includes(direction)
  ) {
    errors.push(
      "Payment direction must be either income or expense."
    );
  }

  if (!payload.payment_date) {
    errors.push(
      "Payment date is required."
    );
  }

  const scope = payload.payment_scope;

  if (scope && !ALL_SCOPES.has(scope)) {
    errors.push(
      "Invalid payment scope."
    );
  }

  const subType =
    payload.payment_sub_type;

  if (
    subType &&
    !ALL_SUB_TYPES.has(subType)
  ) {
    errors.push(
      "Invalid payment sub type."
    );
  }

  // Reject combinations the hierarchy does not contain, such as an
  // office-scoped investor payment.
  if (
    direction &&
    scope &&
    subType &&
    ALL_SCOPES.has(scope) &&
    ALL_SUB_TYPES.has(subType) &&
    !isValidCombination(
      direction,
      scope,
      subType
    )
  ) {
    errors.push(
      `${subType} is not a valid ${direction} entry under ${scope}.`
    );
  }

  // Company charge derives its amount, so the bill drives validation
  // rather than `amount`.
  const isDerived =
    subType === SUB_TYPES.COMPANY_CHARGE;

  if (!isDerived) {
    const amount = money(
      payload.amount
    );

    if (amount <= 0) {
      errors.push(
        "Amount must be greater than zero."
      );
    }
  }

  (
    REQUIRED_BY_SUB_TYPE[subType] || []
  ).forEach((field) => {
    const value = payload[field];

    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {
      errors.push(
        `${field.replace(/_/g, " ")} is required for ${subType}.`
      );
    }
  });

  if (
    [
      "PERSONAL_TENDER",
      "SUBCONTRACTOR_TENDER",
    ].includes(scope) &&
    !payload.tender_id
  ) {
    errors.push(
      "Select a tender for this payment."
    );
  }

  return errors;
};

/**
 * Normalises a payload into the exact column set `payments` expects.
 *
 * Every derived figure is recomputed here so the stored row is internally
 * consistent regardless of what the client sent.
 */
/**
 * Builds the payment row from a validated payload.
 *
 * Purpose:
 * The last step before the INSERT. Turns a request body into the exact set
 * of columns the payments table expects, with every money figure computed
 * here rather than taken from the client.
 *
 * Parameters:
 * payload - the request body, already through validatePayment
 * context - { companyId, userId }, both from the authenticated session
 *
 * Returns:
 * A flat object of column values, ready to be passed to a query.
 *
 * Side effects:
 * None.
 *
 * Business rules:
 * - COMPANY_CHARGE takes a different route from every other sub-type. Its
 *   amount is DERIVED — the recorded income is the percentage cut, not the
 *   bill — so it goes through calculateCompanyCharge, which returns the
 *   charge as `amount`. Everything else goes through calculateGst, where
 *   the amount is what the user entered.
 * - Interest is computed against the FINANCIAL amount, not the raw payload
 *   amount, so a company charge accrues interest on the charge rather than
 *   on the whole bill.
 * - company_id and created_by come from the session and are written here,
 *   so neither can be supplied by the client.
 *
 * Security:
 * This function is the allow-list for the payments table. It names every
 * column explicitly and builds a new object, so a key invented by the
 * client — id, is_deleted, company_id — never reaches the INSERT. That is
 * what makes mass assignment impossible on this path.
 *
 * Notes:
 * `payment_type` duplicates `payment_direction` in title case. It is a
 * legacy column the existing screens still read; both are written so
 * neither the old nor the new consumer breaks. See the inline comment.
 *
 * The `?? 0` defaults matter because the two calculate* functions return
 * different key sets — calculateCompanyCharge has gst_received and
 * gst_left, calculateGst does not. Without the defaults those columns
 * would be undefined for ordinary payments, which node-pg sends as NULL
 * into NOT NULL numeric columns.
 */
const buildPaymentRecord = (
  payload,
  { companyId, userId }
) => {
  const direction = String(
    payload.payment_direction || ""
  ).toLowerCase();

  const subType =
    payload.payment_sub_type || null;

  let financial;

  if (
    subType === SUB_TYPES.COMPANY_CHARGE
  ) {
    financial = calculateCompanyCharge({
      billAmount: payload.bill_amount,
      chargePercent:
        payload.company_charge_percent,
      gstTotal: payload.gst_total,
      gstReceived:
        payload.gst_received,
    });
  } else {
    financial = calculateGst({
      amount: payload.amount,
      gstPercent: payload.gst_percent,
      gstAmount: payload.gst_amount,
    });
  }

  const interest = calculateInterest({
    principal: financial.amount,
    interestPercent:
      payload.interest_percent,
    fromDate: payload.payment_date,
  });

  return {
    company_id: companyId,
    // payment_type is retained for the existing screens, which still read
    // the capitalised "Income"/"Expense" form.
    payment_type:
      direction === DIRECTIONS.INCOME
        ? "Income"
        : "Expense",
    payment_direction: direction,
    payment_scope:
      payload.payment_scope || null,
    payment_sub_type: subType,
    category:
      payload.category ||
      subType ||
      null,

    amount: financial.amount,
    gst_percent:
      financial.gst_percent ?? 0,
    gst_amount:
      financial.gst_amount ?? 0,
    gst_total: financial.gst_total ?? 0,
    gst_received:
      financial.gst_received ?? 0,
    gst_left: financial.gst_left ?? 0,
    collected_gst: money(
      payload.collected_gst
    ),

    bill_number:
      payload.bill_number || null,
    bill_amount:
      financial.bill_amount ?? null,
    charge_amount:
      financial.charge_amount ?? null,
    company_charge_percent:
      financial.company_charge_percent ??
      0,
    company_charge_total:
      financial.company_charge_total ??
      0,

    interest_percent: money(
      payload.interest_percent
    ),
    interest_amount:
      interest.interest_amount,
    interest_accrued_to:
      payload.interest_percent
        ? payload.payment_date
        : null,

    tds_amount: money(
      payload.tds_amount
    ),
    quantity: money(payload.quantity),

    payment_date: payload.payment_date,
    payment_mode:
      payload.payment_mode || null,
    source_type:
      payload.source_type || null,
    fd_site: payload.fd_site || null,

    tender_id:
      payload.tender_id || null,
    site_id: payload.site_id || null,
    investor_id:
      payload.investor_id || null,
    supplier_id:
      payload.supplier_id || null,
    client_id: payload.client_id || null,
    subcontractor_id:
      payload.subcontractor_id || null,
    labour_id: payload.labour_id || null,

    investor_name:
      payload.investor_name || null,
    worker_name:
      payload.worker_name || null,
    material_name:
      payload.material_name || null,

    description:
      payload.description || "",
    details: payload.details || null,
    reference_number:
      payload.reference_number || null,
    receipt_url:
      payload.receipt_url || null,

    created_by: userId,
  };
};

module.exports = {
  money,
  round2,
  calculateCompanyCharge,
  calculateInterest,
  calculateGst,
  validatePayment,
  buildPaymentRecord,
};
