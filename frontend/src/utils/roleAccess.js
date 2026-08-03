/**
 * File purpose:
 * The single place the frontend decides whether a user counts as "office"
 * and may therefore load the commercial registers.
 *
 * Exports:
 * - canLoadAdminData(user)
 *
 * Connected to:
 * - useCollection.js gates every register hook on this
 * - Sidebar.jsx and the pages use it to hide controls
 *
 * Important notes:
 * - Mirrors requireOffice on the backend (admin and manager). If the two
 *   ever disagree, the backend wins — this only decides whether a request
 *   is worth making.
 * - Its real job is avoiding pointless 403s: before it existed, several
 *   hooks fired /workers, /sites, /tenders and /invoices for every worker
 *   and subcontractor login.
 */

export function normaliseRole(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }
  
  export function canLoadAdminData(user) {
    const role = normaliseRole(user?.role);
  
    return role === "admin" || role === "manager";
  }