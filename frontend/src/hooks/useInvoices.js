import { useCallback } from "react";

import {
  getInvoices,
  createInvoice,
  deleteInvoice,
} from "../services/invoiceService";

import { useCollection } from "./useCollection";

export default function useInvoices(user) {
  const {
    items: invoices,
    loading,
    error,
    refresh,
  } = useCollection(user, {
    fetcher: getInvoices,
    label: "invoices",
  });

  const addInvoice = useCallback(
    async (invoice) => {
      const result = await createInvoice(invoice);
      await refresh();

      return result;
    },
    [refresh]
  );

  const removeInvoice = useCallback(
    async (id) => {
      const result = await deleteInvoice(id);
      await refresh();

      return result;
    },
    [refresh]
  );

  return {
    invoices,
    loading,
    error,
    addInvoice,
    removeInvoice,
    fetchInvoices: refresh,
  };
}
