/**
 * File purpose:
 * Per-tender derived figures — progress, margins and site counts — for the
 * tender list and detail views.
 *
 * Connected to:
 * - TendersPage.jsx, TenderSummaryCard.jsx, TenderOverviewTab.jsx
 *
 * Important notes:
 * - Display-side only. estimated_margin and actual_margin are stored
 *   columns; anything computed here is presentation on top of them.
 */


  
  
  
  export const getTenderValue = (tenders = []) => {
    return tenders.reduce(
      (sum, tender) => sum + Number(tender.estimated_value || 0),
      0
    );
  };
  
  export const calculateTenderDetailsSummary = ({
    tender,
    materials = [],
    banking = [],
    subcontractors = [],
  }) => {
    const materialTotal = materials.reduce(
      (sum, item) => sum + Number(item.total_amount || 0),
      0
    );
  
    const subcontractorAssignedTotal = subcontractors.reduce(
      (sum, sub) => sum + Number(sub.assigned_amount || 0),
      0
    );
  
    const bankingTotal = banking.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
  
    const gstTotal = banking.reduce(
      (sum, item) => sum + Number(item.gst_amount || 0),
      0
    );
  
    const loanedTotal = banking
      .filter((item) => item.payment_type === "loaned_amount")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  
    const returnedTotal = banking
      .filter((item) => item.payment_type === "company_returned")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  
    const subcontractorCost = subcontractors.reduce(
      (sum, sub) => sum + Number(sub.assigned_amount || 0),
      0
    );
  
    const materialCost = materials.reduce(
      (sum, item) => sum + Number(item.total_amount || 0),
      0
    );
  
    const bankingCost = banking
      .filter((item) =>
        [
          "subcontractor_payment",
          "material_payment",
          "gst_payment",
          "third_party_payment",
          "other",
        ].includes(item.payment_type)
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  
    const tenderIncome = banking
      .filter((item) =>
        ["government_payment", "company_returned"].includes(item.payment_type)
      )
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  
    const totalTenderCost = materialCost + subcontractorCost + bankingCost;
    const tenderValue = Number(tender?.estimated_value || 0);
    const remainingBudget = tenderValue - totalTenderCost;
    const tenderProfit = tenderIncome - totalTenderCost;
  
    const tenderProfitPercentage =
      tenderIncome > 0 ? (tenderProfit / tenderIncome) * 100 : 0;
  
    return {
      materialTotal,
      subcontractorAssignedTotal,
      bankingTotal,
      gstTotal,
      loanedTotal,
      returnedTotal,
      subcontractorCost,
      materialCost,
      bankingCost,
      tenderIncome,
      totalTenderCost,
      tenderValue,
      remainingBudget,
      tenderProfit,
      tenderProfitPercentage,
    };
  };
  
  export const calculateFinancePreview = (financeForm) => {
    const financeAmount = Number(financeForm.amount || 0);
    const financeGstPercent = Number(financeForm.gst_percent || 0);
    const financeCompanyPercent = Number(
      financeForm.company_charge_percent || 0
    );
  
    const calculatedGstTotal =
      financeForm.record_type === "GOVERNMENT_BILL"
        ? (financeAmount * financeGstPercent) / 100
        : Number(financeForm.gst_total || 0);
  
    const calculatedCompanyChargeTotal =
      financeForm.record_type === "COMPANY_CHARGE" ||
      financeForm.record_type === "GOVERNMENT_BILL"
        ? (financeAmount * financeCompanyPercent) / 100
        : Number(financeForm.company_charge_total || 0);
  
    return {
      calculatedGstTotal,
      calculatedCompanyChargeTotal,
    };
  };