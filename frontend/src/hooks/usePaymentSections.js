/**
 * File purpose:
 * Loads the Add Payment hierarchy and turns it into the sections the
 * payment form renders.
 *
 * Returns:
 * the section structure, plus loading and error state.
 *
 * API endpoints:
 * - GET /payments/hierarchy
 *
 * Connected to:
 * - PaymentTabs.jsx, FinanceWizard.jsx and the payment forms
 * - Built on useAsyncResource.js
 * - Backed by backend/modules/payments/payment.hierarchy.js
 *
 * Important notes:
 * - The hierarchy comes from the SERVER rather than being hard-coded here.
 *   That is deliberate: payment.service.js validates submissions against
 *   the same structure, so a form built from it cannot offer a combination
 *   the backend will reject.
 */

import {
  useCallback,
  useMemo,
} from "react";

import { getPaymentHierarchy } from "../services/paymentService";

import useAsyncResource from "./useAsyncResource";

/*
|--------------------------------------------------------------------------
| Payment sections
|--------------------------------------------------------------------------
|
| The Income/Expense tree behind the Add Payment form, read from
| GET /api/payments/hierarchy.
|
| It used to be a second copy hard-coded in config/paymentSections.js, and
| the two had drifted. The form offered three combinations the server
| refuses outright:
|
|     expense | SUBCONTRACTOR_TENDER | SUPERVISOR
|     expense | SUBCONTRACTOR_TENDER | MATERIAL
|     expense | SUBCONTRACTOR_TENDER | LABOUR
|
| — each a 400 reading "SUPERVISOR is not a valid expense entry under
| SUBCONTRACTOR_TENDER" once the user had filled the form in. It also hid
| two the server does accept there, GOVERNMENT_BILL and INVESTOR, so those
| payments could not be recorded at all.
|
| Reading the tree from the same module that validates it makes that class
| of mismatch impossible rather than merely fixed.
|
*/

/**
 * Flattens one child into the options the wizard can offer.
 *
 * Most children are a single option. "Site" under a personal-tender
 * expense is not: the notebook breaks it down into A. Order (Material),
 * B. Salary, C. Labour, D. GST and E. Other, which the API carries as a
 * third level called `groups`.
 *
 * The wizard renders two levels, and the old hard-coded config simply
 * dropped the third — so Material, Labour, GST and the rest could not be
 * recorded against a personal tender at all. Flattening the groups up into
 * the child list exposes all five without the wizard needing to grow
 * another tier.
 */
const toOptions = (child) => {
  const groups = child.groups ?? [];

  if (groups.length === 0) {
    return [child];
  }

  return groups.map((group) => ({
    ...group,
    label: `${child.label} — ${group.label}`,
  }));
};

/**
 * The server names the child list `children`; the wizard expects
 * `childOptions`. Renaming here keeps the mapping in one place.
 */
const toSection = (section) => ({
  ...section,
  childOptions: (section.children ?? []).flatMap(toOptions),
});

export function usePaymentSections() {
  const load = useCallback(() => getPaymentHierarchy(), []);

  const { data, loading, error } = useAsyncResource(load, {
    label: "payment types",
    initial: null,
  });

  const sections = useMemo(
    () => ({
      income: (data?.income ?? []).map(toSection),
      expense: (data?.expense ?? []).map(toSection),
    }),
    [data]
  );

  const getActiveSections = useCallback(
    (mainTab) =>
      mainTab === "Income" ? sections.income : sections.expense,
    [sections]
  );

  return {
    sections,
    getActiveSections,
    loading,
    error,
  };
}

/**
 * The first child of a section, or null when it has none.
 *
 * Pure, so it stays a plain function rather than part of the hook.
 */
export const getDefaultChildOption = (section) => {
  if (!section?.childOptions?.length) {
    return null;
  }

  return section.childOptions[0];
};

export default usePaymentSections;
