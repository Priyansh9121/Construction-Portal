/**
 * File purpose:
 * Local UI state for the payment add/edit workflow — which form is open,
 * what is being edited, and the filters applied to the list.
 *
 * Returns:
 * the current selection and filter state plus the setters that change it.
 *
 * Connected to:
 * - PaymentsPage.jsx and the payment form components
 * - Pairs with usePayments.js, which owns the DATA; this hook owns only
 *   the interaction state around it
 *
 * Important notes:
 * - Deliberately holds no server data and issues no requests. Keeping the
 *   two apart means the list does not refetch when a modal opens.
 */

import { useMemo, useState } from "react";

export function usePaymentManager({
  payments = [],
  tenderId = null,
  siteId = null,
} = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTenderId, setSelectedTenderId] = useState(tenderId || "");
  const [selectedSiteId, setSelectedSiteId] = useState(siteId || "");

  const filteredPayments = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return payments.filter((payment) => {
      const matchesTender =
        tenderId || selectedTenderId
          ? String(payment.tender_id) === String(tenderId || selectedTenderId)
          : true;

      const matchesSite =
        siteId || selectedSiteId
          ? String(payment.site_id) === String(siteId || selectedSiteId)
          : true;

      const matchesSearch =
        payment.payment_type?.toLowerCase().includes(search) ||
        payment.payment_sub_type?.toLowerCase().includes(search) ||
        payment.category?.toLowerCase().includes(search) ||
        payment.description?.toLowerCase().includes(search) ||
        payment.details?.toLowerCase().includes(search) ||
        payment.investor_name?.toLowerCase().includes(search) ||
        payment.worker_name?.toLowerCase().includes(search) ||
        payment.material_name?.toLowerCase().includes(search) ||
        String(payment.amount || "").includes(search);

      return matchesTender && matchesSite && matchesSearch;
    });
  }, [payments, tenderId, siteId, selectedTenderId, selectedSiteId, searchTerm]);

  const summary = useMemo(() => {
    const totalIncome = filteredPayments
      .filter((p) => p.payment_type === "Income")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const totalExpense = filteredPayments
      .filter((p) => p.payment_type === "Expense")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const gstTotal = filteredPayments
      .filter((p) => p.payment_sub_type === "GOVERNMENT_BILL")
      .reduce((sum, p) => sum + Number(p.gst_amount || 0), 0);

    const gstReturned = filteredPayments
      .filter((p) => p.payment_sub_type === "GST_RETURN")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const companyChargeTotal = filteredPayments
      .filter((p) => p.payment_sub_type === "COMPANY_CHARGE")
      .reduce((sum, p) => sum + Number(p.gst_amount || p.amount || 0), 0);

    const companyChargePaid = filteredPayments
      .filter((p) => p.payment_sub_type === "COMPANY_CHARGE_PAYMENT")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,

      gstTotal,
      gstReturned,
      gstLeft: gstTotal - gstReturned,

      companyChargeTotal,
      companyChargePaid,
      companyChargeLeft: companyChargeTotal - companyChargePaid,
    };
  }, [filteredPayments]);

  return {
    searchTerm,
    setSearchTerm,
    selectedTenderId,
    setSelectedTenderId,
    selectedSiteId,
    setSelectedSiteId,
    filteredPayments,
    summary,
  };
}