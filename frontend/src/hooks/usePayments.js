import { useEffect, useState } from "react";

import {
  getPayments,
  createPayment,
  deletePayment,
} from "../services/paymentService";

import { canLoadAdminData } from "../utils/roleAccess";

function usePayments(user) {
  const [payments, setPayments] = useState([]);

  const fetchPayments = async () => {
    if (!canLoadAdminData(user)) {
      setPayments([]);
      return [];
    }

    try {
      const data = await getPayments();

      const rows = Array.isArray(data)
        ? data
        : data.payments || [];

      setPayments(rows);
      return rows;
    } catch (error) {
      console.error(
        "Failed to fetch payments",
        error.response?.data || error
      );

      setPayments([]);
      throw error;
    }
  };

  useEffect(() => {
    if (canLoadAdminData(user)) {
      fetchPayments();
    } else {
      setPayments([]);
    }
  }, [user?.id, user?.role]);

  const addPayment = async (paymentData) => {
    if (!canLoadAdminData(user)) {
      throw new Error("You are not allowed to create payments.");
    }

    const data = await createPayment(paymentData);

    if (data.payment) {
      setPayments((previous) => [
        data.payment,
        ...previous.filter(
          (item) => item.id !== data.payment.id
        ),
      ]);
    } else {
      await fetchPayments();
    }

    return data;
  };

  const removePayment = async (id) => {
    if (!canLoadAdminData(user)) {
      throw new Error("You are not allowed to delete payments.");
    }

    const data = await deletePayment(id);

    setPayments((previous) =>
      previous.filter(
        (payment) => Number(payment.id) !== Number(id)
      )
    );

    return data;
  };

  return {
    payments,
    fetchPayments,
    addPayment,
    removePayment,
  };
}

export default usePayments;