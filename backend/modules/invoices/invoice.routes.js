/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for /api/invoices.
|
| Endpoint summary:
|
|   Method Path   Auth  Roles           Controller
|   ------ ------ ----  --------------  ---------------
|   GET    /      yes   admin, manager  getInvoices
|   POST   /      yes   admin, manager  createInvoice
|   PUT    /:id   yes   admin, manager  updateInvoice
|   DELETE /:id   yes   admin, manager  deleteInvoice
|
| Mount:
|   server.js mounts this at /api/invoices behind authMiddleware and
|   requireOffice — invoices are commercial records, so neither workers nor
|   subcontractors can reach them.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js
|
| Depends on:
|   ./invoice.controller.js — handlers pre-wrapped in asyncHandler
|
| Database tables touched:
|   invoices, and tenders for the reference check
|
| Frontend consumers:
|   frontend/src/services/invoiceService.js -> useInvoices.js ->
|   InvoicesPage.jsx, and the tender Finance tab
|
| Notes:
|   No validation middleware and no logActivity, matching the other plain
|   registers. Requiredness comes from the factory config alone
|   (invoice_number and amount).
|
|   getInvoiceById is exported but not mounted — F-10.
|
*/

const express = require("express");

const router = express.Router();

const invoiceController = require("./invoice.controller");

/**
 * GET /api/invoices
 *
 * Auth:     required
 * Roles:    admin, manager
 * Query:    ?search= ?status= ?tender_id= ?limit= ?offset=
 * Response: 200 { success, invoices, pagination }
 *
 * ?tender_id= is how a tender's Finance tab lists only its own invoices.
 */
router.get("/", invoiceController.getInvoices);

/**
 * POST /api/invoices
 *
 * Auth:       required
 * Roles:      admin, manager
 * Body:       invoice_number, amount, and optionally status and tender_id
 * Validation: invoice_number and amount required; tender_id, if given,
 *             must belong to the caller's company
 * Response:   201 { success, invoice }
 *             400 a required field is missing
 *             404 the tender is not this company's
 *
 * Business rule:
 * status defaults to "pending" when omitted — unlike the workers register,
 * where an equivalent default is unreachable because validation demands the
 * field (F-11). Here there is no validation middleware, so the default
 * genuinely applies.
 */
router.post("/", invoiceController.createInvoice);

/**
 * PUT /api/invoices/:id
 *
 * Auth:     required
 * Roles:    admin, manager
 * Response: 200 { success, invoice }
 *           404 no such live invoice in this company, or a tender_id that
 *               is not this company's
 *
 * The endpoint that marks an invoice paid, since status is an ordinary
 * writable column rather than a dedicated transition.
 */
router.put("/:id", invoiceController.updateInvoice);

/**
 * DELETE /api/invoices/:id
 *
 * Auth:     required
 * Roles:    admin, manager
 * Response: 200 { success, message }
 *           404 no such live invoice in this company
 *
 * Soft, like the other registers — a billing record that has been acted on
 * should remain findable rather than vanish.
 */
router.delete("/:id", invoiceController.deleteInvoice);

module.exports = router;