import { useEffect, useState } from "react";

import {
  getPayments,
  createPayment,
  deletePayment,
} from "../services/paymentService";

export default function usePayments(user) {
  const [payments, setPayments] = useState([]);

  const fetchPayments = async () => {
    try {
      const data = await getPayments();
      setPayments(data.payments || []);
    } catch (err) {
      console.error("Failed to load payments", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const addPayment = async (payment) => {
    const data = await createPayment(payment);
  
    if (data.payment) {
      setPayments((prev) => [
        data.payment,
        ...prev,
      ]);
    } else {
      await fetchPayments();
    }
  };

  const removePayment = async (id) => {
    await deletePayment(id);
    await fetchPayments();
  };

  return {
    payments,
    addPayment,
    removePayment,
    fetchPayments,
  };
}