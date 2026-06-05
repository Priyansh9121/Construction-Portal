import { useEffect, useState } from "react";

import {
  getInvoices,
  createInvoice,
  deleteInvoice,
} from "../services/invoiceService";

export default function useInvoices(user) {
  const [invoices, setInvoices] = useState([]);

  const fetchInvoices = async () => {
    try {
      const data = await getInvoices();
      setInvoices(data);
    } catch (err) {
      console.error("Failed to load invoices", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  const addInvoice = async (invoice) => {
    await createInvoice(invoice);
    fetchInvoices();
  };

  const removeInvoice = async (id) => {
    await deleteInvoice(id);
    fetchInvoices();
  };

  return {
    invoices,
    addInvoice,
    removeInvoice,
    fetchInvoices,
  };
}