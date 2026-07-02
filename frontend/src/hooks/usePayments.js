import { useEffect, useState } from "react";
import {
  getPayments,
  createPayment,
  deletePayment,
} from "../services/paymentService";

function usePayments(user) {
  const [payments, setPayments] = useState([]);

  const fetchPayments = async () => {
    if (!user) return;

    try {
      const data = await getPayments();
      console.log("Fetched payments:", data);

      setPayments(Array.isArray(data) ? data : data.payments || []);
    } catch (err) {
      console.error("Failed to fetch payments", err);
      setPayments([]);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [user]);

  const addPayment = async (paymentData) => {
    const data = await createPayment(paymentData);
  
    setPayments((prev) => [
      data.payment,
      ...prev,
    ]);
  
    await fetchPayments();
  
    return data;
  };

  const removePayment = async (id) => {
    await deletePayment(id);

    setPayments((prev) =>
      prev.filter((payment) => payment.id !== id)
    );
  };

  return {
    payments,
    fetchPayments,
    addPayment,
    removePayment,
  };
}

export default usePayments;