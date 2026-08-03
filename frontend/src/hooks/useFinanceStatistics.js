/**
 * File purpose:
 * Derives headline finance figures from a list of payments, in the browser.
 *
 * Parameters:
 * - payments  the already-loaded payment rows
 *
 * Returns:
 * the aggregate totals the finance cards display.
 *
 * Connected to:
 * - FinanceOverview.jsx, FinanceSummaryCards.jsx, DashboardPage.jsx
 * - Consumes rows loaded by usePayments.js
 *
 * Important notes:
 * - Memoised on `payments`, so the arithmetic re-runs only when the rows
 *   actually change rather than on every parent render.
 * - Client-side derivation, unlike GET /payments/summary which aggregates
 *   in SQL. Both exist: this one avoids a round trip when the rows are
 *   already on hand. If the two ever disagree, the server figure is
 *   authoritative — it sees rows this page may have paginated past.
 */

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