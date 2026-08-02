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
