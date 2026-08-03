/**
 * File purpose:
 * Loads the invoices register and exposes create, update and delete.
 *
 * API endpoints:
 * - GET/POST/PUT/DELETE /invoices, via services/invoiceService.js
 *
 * Connected to:
 * - InvoicesPage.jsx, and the tender Finance tab
 * - Built on useCollection.js, so it inherits the office-only gate,
 *   per-identity caching and race handling
 *
 * Important notes:
 * - Office-only. Returns empty for a worker or subcontractor rather than
 *   firing a request the API would refuse.
 */

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
