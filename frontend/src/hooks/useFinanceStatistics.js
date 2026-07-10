import { useMemo } from "react";

export default function useFinanceStatistics(payments = []) {
  return useMemo(() => {
    const totalIncome = payments
      .filter((p) => p.payment_type === "Income")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const totalExpense = payments
      .filter((p) => p.payment_type === "Expense")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const gstTotal = payments
      .filter((p) => p.payment_sub_type === "GOVERNMENT_BILL")
      .reduce((sum, p) => sum + Number(p.gst_amount || 0), 0);

    const gstReturned = payments
      .filter((p) => p.payment_sub_type === "GST_RETURN")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const companyChargeTotal = payments
      .filter((p) => p.payment_sub_type === "COMPANY_CHARGE")
      .reduce((sum, p) => sum + Number(p.gst_amount || p.amount || 0), 0);

    const companyChargePaid = payments
      .filter((p) => p.payment_sub_type === "COMPANY_CHARGE_PAYMENT")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      gstTotal,
      gstReturned,
      gstPending: gstTotal - gstReturned,
      companyChargeTotal,
      companyChargePaid,
      companyChargePending: companyChargeTotal - companyChargePaid,
      recordCount: payments.length,
    };
  }, [payments]);
}