/**
 * File purpose:
 * Loads the payment ledger and exposes the mutations against it.
 *
 * API endpoints:
 * - GET/POST/PUT/DELETE /payments, via services/paymentService.js
 *
 * Connected to:
 * - PaymentsPage.jsx, the finance components, DashboardPage
 * - Built on useCollection.js
 * - Pairs with usePaymentManager.js, which holds the UI state
 *
 * Important notes:
 * - Office-only, checked through canLoadAdminData before any request.
 * - Money figures displayed here are whatever the server returned. The
 *   backend recalculates them on write, so a client-side total is never
 *   what gets stored.
 */

import { useCallback } from "react";

import {
  getPayments,
  createPayment,
  deletePayment,
} from "../services/paymentService";

import { canLoadAdminData } from "../utils/roleAccess";

import { useCollection } from "./useCollection";

function usePayments(user) {
  const {
    items: payments,
    loading,
    error,
    refresh,
    patch,
  } = useCollection(user, {
    fetcher: getPayments,
    label: "payments",
  });

  const addPayment = useCallback(
    async (paymentData) => {
      if (!canLoadAdminData(user)) {
        throw new Error("You are not allowed to create payments.");
      }

      const data = await createPayment(paymentData);

      if (data.payment) {
        patch((rows) => [
          data.payment,
          ...rows.filter((item) => item.id !== data.payment.id),
        ]);
      } else {
        await refresh();
      }

      return data;
    },
    [user, patch, refresh]
  );

  const removePayment = useCallback(
    async (id) => {
      if (!canLoadAdminData(user)) {
        throw new Error("You are not allowed to delete payments.");
      }

      const data = await deletePayment(id);

      patch((rows) =>
        rows.filter((payment) => Number(payment.id) !== Number(id))
      );

      return data;
    },
    [user, patch]
  );

  return {
    payments,
    loading,
    error,
    fetchPayments: refresh,
    addPayment,
    removePayment,
  };
}

export default usePayments;
