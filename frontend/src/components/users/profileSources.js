/**
 * File purpose:
 * The role -> register map for portal profiles, mirroring PROFILE_FOR_ROLE
 * in backend/modules/auth/profileLink.service.js.
 *
 * API endpoints:
 * - GET /workers          (via services/workerService.js)
 * - GET /subcontractors   (via services/subcontractorService.js)
 *
 * Connected to:
 * - ProfileLinkField.jsx — the control that resolves a record at create time
 * - UsersPage.jsx — to decide whether a role needs one at all
 *
 * Important notes:
 * - This is configuration, not logic. Subcontractor support is a key here,
 *   the same way it is a key in the server's map. Nothing that consumes this
 *   file should test for a specific role; adding a role should be an edit to
 *   this object alone.
 * - `normalise` exists because the two list endpoints disagree on their
 *   response shape — /workers returns the array, /subcontractors returns
 *   { subcontractors }. Keeping that difference here is what stops it
 *   becoming a branch in the component.
 * - It lives in its own file because a file that exports both a component
 *   and constants breaks React Fast Refresh.
 */

import { getWorkers } from "../../services/workerService";
import { getSubcontractors } from "../../services/subcontractorService";

export const PROFILE_SOURCES = {
  worker: {
    label: "worker",
    noun: "Worker",
    fetch: getWorkers,
    normalise: (data) =>
      Array.isArray(data)
        ? data
        : data?.workers || [],
    createFields: [
      { name: "phone", label: "Phone", type: "tel" },
    ],
  },
  subcontractor: {
    label: "subcontractor",
    noun: "Subcontractor",
    fetch: getSubcontractors,
    normalise: (data) =>
      Array.isArray(data)
        ? data
        : data?.subcontractors || [],
    createFields: [
      { name: "phone", label: "Phone", type: "tel" },
      {
        name: "business_name",
        label: "Business name",
        type: "text",
      },
    ],
  },
};

/*
 * True when the role needs a register record to be usable at all. A role
 * absent from the map needs none — admin and manager are unaffected by
 * omission rather than by an exception.
 */
export const roleNeedsProfile = (role) =>
  Boolean(
    PROFILE_SOURCES[
      String(role || "").toLowerCase()
    ]
  );
