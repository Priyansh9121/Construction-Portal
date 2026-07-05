export const incomeSections = [
  {
    key: "INCOME_PERSONAL_TENDER",
    label: "Personal Tender",
    paymentType: "Income",
    scope: "PERSONAL_TENDER",
    requiresTender: true,
    childOptions: [
      {
        key: "PERSONAL_TENDER_INVESTOR",
        label: "Investor",
        subType: "INVESTOR",
      },
      {
        key: "PERSONAL_TENDER_GOVERNMENT_BILL",
        label: "Government Bill",
        subType: "GOVERNMENT_BILL",
      },
    ],
  },
  {
    key: "INCOME_SUBCONTRACTOR",
    label: "Subcontractor",
    paymentType: "Income",
    scope: "SUBCONTRACTOR_TENDER",
    requiresTender: true,
    childOptions: [
      {
        key: "SUBCONTRACTOR_INVESTOR",
        label: "Investor",
        subType: "INVESTOR",
      },
      {
        key: "SUBCONTRACTOR_GOVERNMENT_BILL",
        label: "Government Bill",
        subType: "GOVERNMENT_BILL",
      },
    ],
  },
  {
    key: "INCOME_OFFICE",
    label: "Office",
    paymentType: "Income",
    scope: "OFFICE",
    requiresTender: false,
    subType: "OFFICE_INCOME",
  },
  {
    key: "INCOME_COMPANY_CHARGE",
    label: "Company Charge",
    paymentType: "Income",
    scope: "OFFICE",
    requiresTender: true,
    subType: "COMPANY_CHARGE",
  },
  {
    key: "INCOME_TDS",
    label: "TDS",
    paymentType: "Income",
    scope: "OFFICE",
    requiresTender: false,
    subType: "TDS",
  },
  {
    key: "INCOME_GST_RETURN",
    label: "GST Return",
    paymentType: "Income",
    scope: "OFFICE",
    requiresTender: false,
    subType: "GST_RETURN",
  },
];

export const expenseSections = [
  {
    key: "EXPENSE_PERSONAL_TENDER",
    label: "Personal Tender",
    paymentType: "Expense",
    scope: "PERSONAL_TENDER",
    requiresTender: true,
    childOptions: [
      {
        key: "PERSONAL_SUPERVISOR",
        label: "Supervisor",
        subType: "SUPERVISOR",
      },
      {
        key: "PERSONAL_SITE_MATERIAL",
        label: "Site / Material",
        subType: "MATERIAL",
      },
      {
        key: "PERSONAL_LABOUR",
        label: "Labour",
        subType: "LABOUR",
      },
    ],
  },
  {
    key: "EXPENSE_SUBCONTRACTOR",
    label: "Subcontractor",
    paymentType: "Expense",
    scope: "SUBCONTRACTOR_TENDER",
    requiresTender: true,
    childOptions: [
      {
        key: "SUBCONTRACTOR_SUPERVISOR",
        label: "Supervisor",
        subType: "SUPERVISOR",
      },
      {
        key: "SUBCONTRACTOR_SITE_MATERIAL",
        label: "Site / Material",
        subType: "MATERIAL",
      },
      {
        key: "SUBCONTRACTOR_LABOUR",
        label: "Labour",
        subType: "LABOUR",
      },
    ],
  },
  {
    key: "EXPENSE_OFFICE",
    label: "Office / Company",
    paymentType: "Expense",
    scope: "OFFICE",
    requiresTender: false,
    childOptions: [
      {
        key: "OFFICE_SALARY",
        label: "Salary",
        subType: "SALARY",
      },
      {
        key: "OFFICE_PF",
        label: "PF",
        subType: "PF",
      },
      {
        key: "OFFICE_TAX",
        label: "Tax",
        subType: "TAX",
      },
      {
        key: "OFFICE_OTHER",
        label: "Other",
        subType: "OTHER",
      },
    ],
  },
];

export const getActiveSections = (mainTab) => {
  return mainTab === "Income" ? incomeSections : expenseSections;
};

export const getDefaultSectionKey = (mainTab) => {
  return mainTab === "Income"
    ? incomeSections[0].key
    : expenseSections[0].key;
};

export const getSectionByKey = (mainTab, sectionKey) => {
  return getActiveSections(mainTab).find(
    (section) => section.key === sectionKey
  );
};

export const getDefaultChildOption = (section) => {
  if (!section?.childOptions?.length) return null;
  return section.childOptions[0];
};