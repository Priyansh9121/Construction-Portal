export const incomeSections = [
    {
      key: "PERSONAL_INVESTOR",
      label: "Personal Investor",
      scope: "PERSONAL_TENDER",
      subType: "INVESTOR",
    },
    {
      key: "PERSONAL_GOVERNMENT_BILL",
      label: "Personal Govt Bill",
      scope: "PERSONAL_TENDER",
      subType: "GOVERNMENT_BILL",
    },
    {
      key: "SUBCONTRACTOR_INVESTOR",
      label: "Subcontractor Investor",
      scope: "SUBCONTRACTOR_TENDER",
      subType: "INVESTOR",
    },
    {
      key: "SUBCONTRACTOR_GOVERNMENT_BILL",
      label: "Subcontractor Govt Bill",
      scope: "SUBCONTRACTOR_TENDER",
      subType: "GOVERNMENT_BILL",
    },
    {
      key: "OFFICE_INCOME",
      label: "Office Income",
      scope: "OFFICE",
      subType: "OFFICE_INCOME",
    },
    {
      key: "COMPANY_CHARGE",
      label: "Company Charge",
      scope: "OFFICE",
      subType: "COMPANY_CHARGE",
    },
    {
      key: "TDS",
      label: "TDS",
      scope: "OFFICE",
      subType: "TDS",
    },
    {
      key: "GST_RETURN",
      label: "GST Return",
      scope: "OFFICE",
      subType: "GST_RETURN",
    },
  ];
  
  export const expenseSections = [
    {
      key: "PERSONAL_SUPERVISOR",
      label: "Personal Supervisor",
      scope: "PERSONAL_TENDER",
      subType: "SUPERVISOR",
    },
    {
      key: "PERSONAL_SITE_MATERIAL",
      label: "Personal Site / Material",
      scope: "PERSONAL_TENDER",
      subType: "MATERIAL",
    },
    {
      key: "PERSONAL_LABOUR",
      label: "Personal Labour",
      scope: "PERSONAL_TENDER",
      subType: "LABOUR",
    },
    {
      key: "SUBCONTRACTOR_SUPERVISOR",
      label: "Subcontractor Supervisor",
      scope: "SUBCONTRACTOR_TENDER",
      subType: "SUPERVISOR",
    },
    {
      key: "SUBCONTRACTOR_SITE_MATERIAL",
      label: "Subcontractor Site / Material",
      scope: "SUBCONTRACTOR_TENDER",
      subType: "MATERIAL",
    },
    {
      key: "SUBCONTRACTOR_LABOUR",
      label: "Subcontractor Labour",
      scope: "SUBCONTRACTOR_TENDER",
      subType: "LABOUR",
    },
    {
      key: "OFFICE_SALARY",
      label: "Office Salary",
      scope: "OFFICE",
      subType: "SALARY",
    },
    {
      key: "OFFICE_PF",
      label: "Office PF",
      scope: "OFFICE",
      subType: "PF",
    },
    {
      key: "OFFICE_TAX",
      label: "Office Tax",
      scope: "OFFICE",
      subType: "TAX",
    },
    {
      key: "OFFICE_OTHER",
      label: "Office Other",
      scope: "OFFICE",
      subType: "OTHER",
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