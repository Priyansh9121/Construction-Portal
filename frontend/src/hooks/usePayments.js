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
      setPayments(data);
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
    await createPayment(payment);
    fetchPayments();
  };

  const removePayment = async (id) => {
    await deletePayment(id);
    fetchPayments();
  };

  return {
    payments,
    addPayment,
    removePayment,
    fetchPayments,
  };
}