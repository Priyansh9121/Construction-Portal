/*
|--------------------------------------------------------------------------
| Add Payment hierarchy
|--------------------------------------------------------------------------
|
| Transcribed from the "Add Payment" notebook. This is the server-side
| source of truth: the frontend renders from GET /api/payments/hierarchy
| rather than keeping its own copy, so the two cannot drift.
|
|   Income
|     1  Personal tender  -> select tender -> 1.1 Investor
|                                             1.2 Government bill
|     2  Subcontractor    -> select tender -> same as 1.1 / 1.2
|     3  Office           -> source name or company balance, cash/bank
|     4  Company charge   -> tender list, % per tender, GST received/left
|     5  TDS
|     6  GST return
|
|   Expense
|     1  Personal tender  -> 1.1 Supervisor
|                            1.2 Site  -> A order (material)
|                                         B salary
|                                         C labour
|                                         D GST
|                                         E other
|                            1.3 Investor
|     2  Subcontract      -> select tender -> Investor
|                                             Government bill (pay into the
|                                             subcontract company, generate
|                                             a bill)
|     3  Office/company   -> A salary  B PF  C tax  D other
|
| `fields` drives both server validation and the form the frontend renders.
|
*/

const DIRECTIONS = Object.freeze({
  INCOME: "income",
  EXPENSE: "expense",
});

const SCOPES = Object.freeze({
  PERSONAL_TENDER: "PERSONAL_TENDER",
  SUBCONTRACTOR_TENDER:
    "SUBCONTRACTOR_TENDER",
  OFFICE: "OFFICE",
});

const SUB_TYPES = Object.freeze({
  INVESTOR: "INVESTOR",
  GOVERNMENT_BILL: "GOVERNMENT_BILL",
  OFFICE_INCOME: "OFFICE_INCOME",
  COMPANY_CHARGE: "COMPANY_CHARGE",
  TDS: "TDS",
  GST_RETURN: "GST_RETURN",

  SUPERVISOR: "SUPERVISOR",
  MATERIAL: "MATERIAL",
  SALARY: "SALARY",
  LABOUR: "LABOUR",
  GST: "GST",
  OTHER: "OTHER",
  PF: "PF",
  TAX: "TAX",
});

/*
|--------------------------------------------------------------------------
| Reusable field groups
|--------------------------------------------------------------------------
*/

// 1.1 Investor — name, FD/site, date, amount, cash/bank, interest %
const INVESTOR_FIELDS = [
  {
    name: "investor_name",
    label: "Investor Name",
    type: "text",
    required: true,
  },
  {
    name: "fd_site",
    label: "FD / Site",
    type: "select",
    options: ["FD", "Site"],
  },
  {
    name: "payment_date",
    label: "Date",
    type: "date",
    required: true,
  },
  {
    name: "amount",
    label: "Amount",
    type: "money",
    required: true,
  },
  {
    name: "payment_mode",
    label: "Cash / Bank",
    type: "select",
    options: ["Cash", "Bank"],
    required: true,
  },
  {
    name: "interest_percent",
    label: "Interest %",
    type: "percent",
    // From the notes: record the rate so the per-day interest accruing on
    // the money can be tracked separately.
    hint: "Daily interest accrues on this amount at the given rate.",
  },
  {
    name: "details",
    label: "Detail",
    type: "textarea",
  },
];

// 1.2 Government bill — date, amount, GST amount
const GOVERNMENT_BILL_FIELDS = [
  {
    name: "payment_date",
    label: "Date",
    type: "date",
    required: true,
  },
  {
    name: "amount",
    label: "Amount",
    type: "money",
    required: true,
  },
  {
    name: "gst_amount",
    label: "GST Amount",
    type: "money",
  },
  {
    name: "bill_number",
    label: "Bill Number",
    type: "text",
  },
  {
    name: "details",
    label: "Detail",
    type: "textarea",
  },
];

const SIMPLE_DATE_AMOUNT_FIELDS = [
  {
    name: "payment_date",
    label: "Date",
    type: "date",
    required: true,
  },
  {
    name: "amount",
    label: "Amount",
    type: "money",
    required: true,
  },
  {
    name: "details",
    label: "Detail",
    type: "textarea",
  },
];

/*
|--------------------------------------------------------------------------
| Income
|--------------------------------------------------------------------------
*/

const INCOME_SECTIONS = [
  {
    key: "INCOME_PERSONAL_TENDER",
    label: "Personal Tender",
    order: 1,
    scope: SCOPES.PERSONAL_TENDER,
    requiresTender: true,
    children: [
      {
        key: "INCOME_PT_INVESTOR",
        label: "Investor",
        subType: SUB_TYPES.INVESTOR,
        fields: INVESTOR_FIELDS,
      },
      {
        key: "INCOME_PT_GOVERNMENT_BILL",
        label: "Government Bill",
        subType:
          SUB_TYPES.GOVERNMENT_BILL,
        fields:
          GOVERNMENT_BILL_FIELDS,
      },
    ],
  },
  {
    key: "INCOME_SUBCONTRACTOR",
    label: "Subcontractor",
    order: 2,
    scope:
      SCOPES.SUBCONTRACTOR_TENDER,
    requiresTender: true,
    // "Same thing from 1.1 to 1.2"
    children: [
      {
        key: "INCOME_SC_INVESTOR",
        label: "Investor",
        subType: SUB_TYPES.INVESTOR,
        fields: INVESTOR_FIELDS,
      },
      {
        key: "INCOME_SC_GOVERNMENT_BILL",
        label: "Government Bill",
        subType:
          SUB_TYPES.GOVERNMENT_BILL,
        fields:
          GOVERNMENT_BILL_FIELDS,
      },
    ],
  },
  {
    key: "INCOME_OFFICE",
    label: "Office",
    order: 3,
    scope: SCOPES.OFFICE,
    requiresTender: false,
    subType: SUB_TYPES.OFFICE_INCOME,
    fields: [
      {
        name: "source_type",
        label: "Source",
        type: "select",
        options: [
          "Name",
          "Company Balance",
        ],
        required: true,
      },
      {
        name: "worker_name",
        label: "Source Name",
        type: "text",
        showWhen: {
          source_type: "Name",
        },
      },
      {
        name: "payment_mode",
        label: "Type",
        type: "select",
        options: ["Cash", "Bank"],
        required: true,
      },
      {
        name: "payment_date",
        label: "Date",
        type: "date",
        required: true,
      },
      {
        name: "amount",
        label: "Amount",
        type: "money",
        required: true,
      },
    ],
  },
  {
    key: "INCOME_COMPANY_CHARGE",
    label: "Company Charge",
    order: 4,
    scope: SCOPES.OFFICE,
    requiresTender: true,
    subType: SUB_TYPES.COMPANY_CHARGE,
    // Worked example from the notes:
    //   tender BVN1460, bill 12000, 2% -> charge 240
    computed: true,
    fields: [
      {
        name: "bill_number",
        label: "Tender / Bill Number",
        type: "text",
      },
      {
        name: "bill_amount",
        label: "Amount of Bill",
        type: "money",
        required: true,
      },
      {
        name: "company_charge_percent",
        label: "% of Charge",
        type: "percent",
        required: true,
        options: [1, 3, 5],
      },
      {
        name: "payment_date",
        label: "Date",
        type: "date",
        required: true,
      },
      {
        name: "charge_amount",
        label: "Charge Amount",
        type: "money",
        readOnly: true,
        derivedFrom:
          "bill_amount * company_charge_percent / 100",
      },
      {
        name: "gst_received",
        label: "GST Received (મળેલ GST)",
        type: "money",
      },
      {
        name: "gst_total",
        label: "GST Total",
        type: "money",
      },
      {
        name: "gst_left",
        label: "GST Remaining (બાકી GST)",
        type: "money",
        readOnly: true,
        derivedFrom:
          "gst_total - gst_received",
      },
    ],
  },
  {
    key: "INCOME_TDS",
    label: "TDS",
    order: 5,
    scope: SCOPES.OFFICE,
    requiresTender: false,
    subType: SUB_TYPES.TDS,
    fields: SIMPLE_DATE_AMOUNT_FIELDS,
  },
  {
    key: "INCOME_GST_RETURN",
    label: "GST Return",
    order: 6,
    scope: SCOPES.OFFICE,
    requiresTender: false,
    subType: SUB_TYPES.GST_RETURN,
    fields: SIMPLE_DATE_AMOUNT_FIELDS,
  },
];

/*
|--------------------------------------------------------------------------
| Expense
|--------------------------------------------------------------------------
*/

const EXPENSE_SECTIONS = [
  {
    key: "EXPENSE_PERSONAL_TENDER",
    label: "Personal Tender",
    order: 1,
    scope: SCOPES.PERSONAL_TENDER,
    requiresTender: true,
    children: [
      {
        key: "EXPENSE_PT_SUPERVISOR",
        label: "Supervisor",
        subType: SUB_TYPES.SUPERVISOR,
        fields: [
          {
            name: "worker_name",
            label: "Supervisor Name",
            type: "text",
            required: true,
          },
          {
            name: "payment_date",
            label: "Date",
            type: "date",
            required: true,
          },
          {
            name: "amount",
            label: "Amount",
            type: "money",
            required: true,
          },
          {
            name: "payment_mode",
            label: "Cash / Bank",
            type: "select",
            options: [
              "Cash",
              "Bank",
              "GST Cash",
            ],
          },
          {
            name: "details",
            label: "Detail",
            type: "textarea",
          },
        ],
      },
      {
        key: "EXPENSE_PT_SITE",
        label: "Site",
        // 1.2 Site breaks down further: A order, B salary, C labour,
        // D GST, E other expense.
        groups: [
          {
            key: "SITE_ORDER",
            label: "A. Order (Material)",
            subType: SUB_TYPES.MATERIAL,
            fields: [
              {
                name: "material_name",
                label: "Select Material",
                type: "material",
                required: true,
              },
              {
                name: "payment_date",
                label: "Date",
                type: "date",
                required: true,
              },
              {
                name: "quantity",
                label: "Quantity",
                type: "number",
              },
              {
                name: "amount",
                label: "Amount",
                type: "money",
                required: true,
              },
              {
                name: "collected_gst",
                label: "Collected GST",
                type: "money",
              },
              {
                name: "details",
                label: "Detail",
                type: "textarea",
              },
            ],
          },
          {
            key: "SITE_SALARY",
            label: "B. Salary",
            subType: SUB_TYPES.SALARY,
            fields: [
              {
                name: "worker_name",
                label: "Name",
                type: "text",
                required: true,
              },
              {
                name: "payment_date",
                label: "Date",
                type: "date",
                required: true,
              },
              {
                name: "amount",
                label: "Amount",
                type: "money",
                required: true,
              },
              {
                name: "details",
                label: "Detail",
                type: "textarea",
              },
            ],
          },
          {
            key: "SITE_LABOUR",
            label: "C. Labour",
            subType: SUB_TYPES.LABOUR,
            fields: [
              {
                name: "worker_name",
                label: "Name",
                type: "text",
                required: true,
              },
              {
                name: "category",
                label: "Category",
                type: "labour_category",
              },
              {
                name: "details",
                label: "Detail",
                type: "textarea",
              },
              {
                name: "payment_date",
                label: "Date",
                type: "date",
                required: true,
              },
              {
                name: "amount",
                label: "Amount",
                type: "money",
                required: true,
              },
            ],
          },
          {
            key: "SITE_GST",
            label: "D. GST",
            subType: SUB_TYPES.GST,
            fields: [
              {
                name: "worker_name",
                label: "Name",
                type: "text",
              },
              {
                name: "amount",
                label: "Amount",
                type: "money",
                required: true,
              },
              {
                name: "payment_date",
                label: "Date",
                type: "date",
                required: true,
              },
              {
                name: "collected_gst",
                label: "Collected GST",
                type: "money",
              },
              {
                name: "details",
                label: "Detail",
                type: "textarea",
              },
            ],
          },
          {
            key: "SITE_OTHER",
            label: "E. Other Expense",
            subType: SUB_TYPES.OTHER,
            fields: [
              {
                name: "category",
                label: "Expense Type",
                type: "select",
                // The examples listed in the notes.
                options: [
                  "Division Expense",
                  "Fuel",
                  "Fastag",
                  "Company Charge",
                  "GST Pay",
                  "Other",
                ],
                required: true,
              },
              {
                name: "payment_date",
                label: "Date",
                type: "date",
                required: true,
              },
              {
                name: "amount",
                label: "Amount",
                type: "money",
                required: true,
              },
              {
                name: "details",
                label: "Detail",
                type: "textarea",
              },
            ],
          },
        ],
      },
      {
        key: "EXPENSE_PT_INVESTOR",
        label: "Investor",
        subType: SUB_TYPES.INVESTOR,
        // 1.3 Investor: name, date, FD/site side, amount, cash or bank,
        // detail.
        fields: INVESTOR_FIELDS,
      },
    ],
  },
  {
    key: "EXPENSE_SUBCONTRACT",
    label: "Subcontract",
    order: 2,
    scope:
      SCOPES.SUBCONTRACTOR_TENDER,
    requiresTender: true,
    children: [
      {
        key: "EXPENSE_SC_INVESTOR",
        label: "Investor",
        subType: SUB_TYPES.INVESTOR,
        // "Same thing (1.3)"
        fields: INVESTOR_FIELDS,
      },
      {
        key: "EXPENSE_SC_GOVERNMENT_BILL",
        label: "Government Bill",
        subType:
          SUB_TYPES.GOVERNMENT_BILL,
        // "Pay into subcontract company - Generate Bill"
        generatesBill: true,
        fields: [
          {
            name: "subcontractor_id",
            label:
              "Subcontract Company",
            type: "subcontractor",
            required: true,
          },
          {
            name: "payment_date",
            label: "Date",
            type: "date",
            required: true,
          },
          {
            name: "amount",
            label: "Amount",
            type: "money",
            required: true,
          },
          {
            name: "gst_amount",
            label: "GST Amount",
            type: "money",
          },
          {
            name: "bill_number",
            label: "Bill Number",
            type: "text",
          },
          {
            name: "details",
            label: "Detail",
            type: "textarea",
          },
        ],
      },
    ],
  },
  {
    key: "EXPENSE_OFFICE",
    label: "Office / Company",
    order: 3,
    scope: SCOPES.OFFICE,
    requiresTender: false,
    children: [
      {
        key: "EXPENSE_OFFICE_SALARY",
        label: "A. Salary",
        subType: SUB_TYPES.SALARY,
        fields: [
          {
            name: "worker_name",
            label: "Employee Name",
            type: "text",
            required: true,
          },
          ...SIMPLE_DATE_AMOUNT_FIELDS,
        ],
      },
      {
        key: "EXPENSE_OFFICE_PF",
        label: "B. PF",
        subType: SUB_TYPES.PF,
        fields: SIMPLE_DATE_AMOUNT_FIELDS,
      },
      {
        key: "EXPENSE_OFFICE_TAX",
        label: "C. Tax",
        subType: SUB_TYPES.TAX,
        fields: SIMPLE_DATE_AMOUNT_FIELDS,
      },
      {
        key: "EXPENSE_OFFICE_OTHER",
        label: "D. Other",
        subType: SUB_TYPES.OTHER,
        fields: SIMPLE_DATE_AMOUNT_FIELDS,
      },
    ],
  },
];

/*
|--------------------------------------------------------------------------
| Lookups
|--------------------------------------------------------------------------
*/

const ALL_SECTIONS = {
  [DIRECTIONS.INCOME]:
    INCOME_SECTIONS,
  [DIRECTIONS.EXPENSE]:
    EXPENSE_SECTIONS,
};

/**
 * Flattens the tree into every valid (scope, subType) pairing.
 *
 * Used to reject a payload that names a combination the hierarchy does not
 * actually contain — for example an OFFICE-scoped INVESTOR payment.
 */
const buildValidCombinations = () => {
  const combos = new Set();

  Object.entries(ALL_SECTIONS).forEach(
    ([direction, sections]) => {
      sections.forEach((section) => {
        const register = (subType) =>
          combos.add(
            `${direction}|${section.scope}|${subType}`
          );

        if (section.subType) {
          register(section.subType);
        }

        (section.children || []).forEach(
          (child) => {
            if (child.subType) {
              register(child.subType);
            }

            (
              child.groups || []
            ).forEach((group) =>
              register(group.subType)
            );
          }
        );
      });
    }
  );

  return combos;
};

const VALID_COMBINATIONS =
  buildValidCombinations();

const isValidCombination = (
  direction,
  scope,
  subType
) =>
  VALID_COMBINATIONS.has(
    `${direction}|${scope}|${subType}`
  );

const ALL_SUB_TYPES = new Set(
  Object.values(SUB_TYPES)
);

const ALL_SCOPES = new Set(
  Object.values(SCOPES)
);

module.exports = {
  DIRECTIONS,
  SCOPES,
  SUB_TYPES,
  INCOME_SECTIONS,
  EXPENSE_SECTIONS,
  ALL_SECTIONS,
  ALL_SUB_TYPES,
  ALL_SCOPES,
  isValidCombination,
  VALID_COMBINATIONS,
};
