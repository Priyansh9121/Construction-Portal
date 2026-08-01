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
const validatePayment = (payload) => {
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
