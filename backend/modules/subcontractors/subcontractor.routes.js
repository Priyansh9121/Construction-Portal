/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for /api/subcontractors — the office's register of engaged
| firms and individuals, including their payment details.
|
| Endpoint summary:
|
|   Method Path   Auth  Roles           Controller
|   ------ ------ ----  --------------  -----------------------
|   GET    /      yes   admin, manager  getSubcontractors   (masked)
|   GET    /:id   yes   admin*          getSubcontractorById (full)
|   POST   /      yes   admin, manager  createSubcontractor
|   PUT    /:id   yes   admin, manager  updateSubcontractor
|   DELETE /:id   yes   admin, manager  deleteSubcontractor
|
|   * GET /:id is reachable by any office user, but returns 403 unless the
|     caller may see payment details. See canSeeFinancialDetails.
|
| Mount:
|   server.js mounts this at /api/subcontractors behind authMiddleware and
|   requireOffice, which is why neither appears here.
|
|   A subcontractor cannot reach this router at all, not even to read
|   their own record; their surface is /api/subcontractor-portal.
|
|   Since F-12 the office gate is no longer the ONLY protection on the
|   banking columns. GET / returns masked identifiers to everyone, and the
|   real values require both office access and the administrator role.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js
|
| Depends on:
|   ./subcontractor.controller.js — handlers already wrapped in
|   asyncHandler by createScopedCrud, so nothing is wrapped again here
|
| Database tables touched:
|   subcontractors
|
| Frontend consumers:
|   frontend/src/services/subcontractorService.js -> SubcontractorsPage,
|   and the picker on TenderSubcontractorsTab.
|
| Notes:
|   No validation middleware, unlike worker.routes.js. Requiredness is
|   enforced only by the factory's own check on the two columns marked
|   required in the controller config.
|
|   No logActivity, so changes to a subcontractor's bank details leave no
|   audit trail. The redaction gap that made that risky is now closed —
|   account_number and ifsc_code are in REDACTED_KEYS — so auditing this
|   module would be safe to add.
|
*/

const express = require("express");
const router = express.Router();

const subcontractorController = require("./subcontractor.controller");

/**
 * GET /api/subcontractors
 *
 * Auth:     required
 * Roles:    admin, manager
 * Query:    ?search= ?status= ?limit= ?offset=
 * Response: 200 { success, subcontractors, pagination }
 *
 * Security:
 * Payment identifiers are MASKED in this response (F-12). Each row carries
 * account_number_masked, ifsc_code_masked and has_bank_details instead of
 * the raw values, so the screen can show which counterparties have banking
 * on file without the register disclosing how to pay them.
 *
 * bank_name and account_name are returned in full — neither is usable
 * without the identifiers, and both are what a person reads to recognise a
 * counterparty.
 */
router.get("/", subcontractorController.getSubcontractors);

/**
 * GET /api/subcontractors/:id — the full record, payment details included.
 *
 * Auth:     required
 * Roles:    admin only for the unmasked values; see
 *           canSeeFinancialDetails in the controller
 * Response: 200 { success, subcontractor } with the real account_number
 *               and ifsc_code
 *           400 invalid id
 *           403 in the right company, but not permitted to see payment
 *               details
 *           404 no such live subcontractor in this company
 *
 * Added for F-12. The list endpoint now returns masked identifiers, so
 * this is the only route that serves the real ones — one record at a time,
 * to one role, rather than the whole register to anyone in the office.
 *
 * Declared BEFORE the "/:id" write routes purely for readability; Express
 * distinguishes them by method, so the order carries no behaviour here.
 */
router.get("/:id", subcontractorController.getSubcontractorById);

/**
 * POST /api/subcontractors
 *
 * Auth:       required
 * Roles:      admin, manager
 * Validation: factory-level only — full_name and phone are required
 * Response:   201 { success, subcontractor }
 *             400 a required field is missing
 */
router.post("/", subcontractorController.createSubcontractor);

/**
 * PUT /api/subcontractors/:id
 *
 * Auth:     required
 * Roles:    admin, manager
 * Response: 200 { success, subcontractor }
 *           404 no such live subcontractor in this company
 *
 * Business rule:
 * Partial by construction — omitted fields keep their stored values via the
 * factory's COALESCE. The corollary is that a banking field cannot be
 * cleared back to null through this endpoint, only overwritten.
 */
router.put("/:id", subcontractorController.updateSubcontractor);

/**
 * DELETE /api/subcontractors/:id
 *
 * Auth:     required
 * Roles:    admin, manager
 * Response: 200 { success, message }
 *           404 no such live subcontractor in this company
 *
 * A soft delete. Payments and tender assignments reference this row, so it
 * is flagged rather than removed.
 *
 * Note the consequence for the banking columns: soft-deleting a
 * subcontractor does not erase their account details, it only hides the row
 * from the register.
 */
router.delete("/:id", subcontractorController.deleteSubcontractor);

module.exports = router;