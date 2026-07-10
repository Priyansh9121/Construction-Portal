export function n(value) {
    return Number(value || 0);
  }
  
  export function formatMoney(value) {
    return n(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  
  export function calculateSubletBill(data = {}) {
    const originalWorkAmount = n(data.originalWorkAmount);
  
    const cgst9 = originalWorkAmount * 0.09;
    const sgst9 = originalWorkAmount * 0.09;
    const gst18 = cgst9 + sgst9;
    const grossTotal = originalWorkAmount + gst18;
  
    const tds2 = originalWorkAmount * 0.02;
    const tdsOnGst2 = gst18 * 0.02;
    const welfareTax1 = originalWorkAmount * 0.01;
    const extTimeLimit = n(data.extTimeLimit);
    const withheld = n(data.withheld);
  
    const totalDepartmentDeduction =
      tds2 + tdsOnGst2 + welfareTax1 + extTimeLimit + withheld;
  
    const securityDeposit = grossTotal * 0.05;
  
    const netChequeFromDepartment =
      grossTotal - totalDepartmentDeduction - securityDeposit;
  
    const billWritingCharge = originalWorkAmount * 0.005;
    const agencyPercent = n(data.agencyPercent || 0.03);
    const agencyCharge = originalWorkAmount * agencyPercent;
  
    const subletTaxableValue = n(
      data.subletTaxableValue || originalWorkAmount * 0.92
    );
  
    const subletGst18 = subletTaxableValue * 0.18;
    const subletTotal = subletTaxableValue + subletGst18;
  
    const subletSecurityDeposit = subletTotal * 0.05;
    const subletWithheld = n(data.subletWithheld);
    const insurance1 = data.insurance ? n(data.insurance) : subletTaxableValue * 0.01;
    const costOfBillFine = n(data.costOfBillFine);
    const tdsByShivdas2 = subletTaxableValue * 0.02;
  
    const totalSubletDeduction =
      subletSecurityDeposit +
      subletWithheld +
      insurance1 +
      costOfBillFine +
      tdsByShivdas2;
  
    const netPayableSublet = subletTotal - totalSubletDeduction;
  
    const gstHold18 = n(data.gstHold18);
    const loanAmount = n(data.loanAmount);
    const trfPayment = netPayableSublet - gstHold18 - loanAmount;
  
    return {
      originalWorkAmount,
      cgst9,
      sgst9,
      gst18,
      grossTotal,
      tds2,
      tdsOnGst2,
      welfareTax1,
      extTimeLimit,
      withheld,
      totalDepartmentDeduction,
      securityDeposit,
      netChequeFromDepartment,
      billWritingCharge,
      agencyPercent,
      agencyCharge,
      subletTaxableValue,
      subletGst18,
      subletTotal,
      subletSecurityDeposit,
      subletWithheld,
      insurance1,
      costOfBillFine,
      tdsByShivdas2,
      totalSubletDeduction,
      netPayableSublet,
      gstHold18,
      loanAmount,
      trfPayment,
    };
  }