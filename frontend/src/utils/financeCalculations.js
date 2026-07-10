import { formatCurrency } from "./currency";

export const money = formatCurrency;
  
export const calculateIncome = (payments = []) => {
  return payments
    .filter((p) => p.payment_type === "income")
    .reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );
};
  
export const calculateExpense = (payments = []) => {
  return payments
    .filter((p) => p.payment_type === "expense")
    .reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );
};
  
export const calculateBalance = (payments = []) => {
    return (
      calculateIncome(payments) -
      calculateExpense(payments)
    );
};

function toNumber(value) {
  return Number(value || 0);
}

function calculateFinanceValues(payload) {
  const {
    record_type,
    amount = 0,
    gst_percent = 0,
    gst_total = 0,
    gst_done = 0,
    company_charge_percent = 0,
    company_charge_total = 0,
    company_charge_done = 0,
    tds_amount = 0,
  } = payload;

  const finalGstTotal =
    record_type === "GOVERNMENT_BILL" && toNumber(gst_total) === 0
      ? (toNumber(amount) * toNumber(gst_percent)) / 100
      : toNumber(gst_total);

  const finalGstDone =
    record_type === "GST_RETURN" && toNumber(gst_done) === 0
      ? toNumber(amount)
      : toNumber(gst_done);

  const finalGstLeft = finalGstTotal - finalGstDone;

  const finalCompanyChargeTotal =
    (record_type === "COMPANY_CHARGE" || record_type === "GOVERNMENT_BILL") &&
    toNumber(company_charge_total) === 0
      ? (toNumber(amount) * toNumber(company_charge_percent)) / 100
      : toNumber(company_charge_total);

  const finalCompanyChargeDone = toNumber(company_charge_done);

  const finalCompanyChargeLeft =
    finalCompanyChargeTotal - finalCompanyChargeDone;

  const finalTdsAmount =
    record_type === "TDS" && toNumber(tds_amount) === 0
      ? toNumber(amount)
      : toNumber(tds_amount);

  return {
    amount: toNumber(amount),
    gst_percent: toNumber(gst_percent),
    gst_total: finalGstTotal,
    gst_done: finalGstDone,
    gst_left: finalGstLeft,
    company_charge_percent: toNumber(company_charge_percent),
    company_charge_total: finalCompanyChargeTotal,
    company_charge_done: finalCompanyChargeDone,
    company_charge_left: finalCompanyChargeLeft,
    tds_amount: finalTdsAmount,
  };
}