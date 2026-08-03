/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for /api/payments — the company's money ledger. Every rupee
| in and out is recorded through these seven endpoints.
|
| Endpoint summary:
|
|   Method Path                Roles           Audited  Controller
|   ------ ------------------- --------------  -------  ------------------
|   GET    /hierarchy          admin, manager  no       getHierarchy
|   GET    /summary            admin, manager  no       getSummary
|   GET    /investor-interest  admin, manager  no       getInvestorInterest
|   GET    /                   admin, manager  no       getPayments
|   POST   /                   admin, manager  create   createPayment
|   PUT    /:id                admin, manager  update   updatePayment
|   DELETE /:id                admin, manager  delete   deletePayment
|
| Mount:
|   server.js mounts this at /api/payments behind authMiddleware AND
|   requireOffice, which is why neither appears in this file. Workers and
|   subcontractors cannot reach any of it — the ledger is the company's
|   commercial record.
|
| ROUTE ORDERING:
|   The three literal GET paths are declared before "/:id". Express matches
|   in declaration order and "/:id" matches any single segment, so
|   /summary would otherwise be read as a payment whose id is "summary".
|   The existing comment says so; a new literal route must go above the
|   parameter routes.
|
| Auditing:
|   All three mutations are audited under the "payments" module. This is
|   the most consistently audited module in the codebase, and rightly so —
|   these rows are the financial record, and "who changed this figure" is
|   the question the audit trail exists to answer.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js
|
| Depends on:
|   ./payment.controller.js
|   utils/asyncHandler.js
|   utils/activityLog.js
|
| Database tables touched (through the controller):
|   payments, plus tenders, sites, workers, subcontractors and investors
|   for the joins and ownership checks
|
| Frontend consumers:
|   frontend/src/services/paymentService.js -> usePayments.js,
|   usePaymentManager.js, usePaymentSections.js -> PaymentsPage.jsx and
|   the finance components
|
| Note:
|   /hierarchy serves the Add Payment tree from payment.hierarchy.js, so
|   the frontend renders the form from the server's definition rather than
|   keeping its own copy. That is deliberate — the two cannot drift.
|
*/

const express = require("express");

const asyncHandler = require("../../utils/asyncHandler");

const paymentController = require("./payment.controller");

const {
  logActivity,
  ACTIVITY_ACTIONS,
} = require("../../utils/activityLog");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Payments
|--------------------------------------------------------------------------
|
| Authentication is applied once in server.js.
|
| The static paths are declared before "/:id" so that /summary and
| /hierarchy are not captured by the parameter route.
|
*/

/**
 * GET /api/payments/hierarchy — the Add Payment tree.
 *
 * Auth:     required; office-only at the mount
 * Response: 200 with the direction -> scope -> sub-type structure
 *
 * Served from payment.hierarchy.js, the server-side source of truth. The
 * frontend builds the Add Payment form from this rather than hard-coding
 * the options, so the form and the validation in payment.service.js can
 * never disagree about which combinations are legal.
 *
 * Static, so it is declared above "/:id".
 */
router.get(
  "/hierarchy",
  asyncHandler(
    paymentController.getHierarchy
  )
);

/**
 * GET /api/payments/summary
 *
 * Auth:     required; office-only
 * Response: 200 with aggregate income, expense and balance figures
 *
 * Backs the dashboard and the Payments page headline cards.
 */
router.get(
  "/summary",
  asyncHandler(
    paymentController.getSummary
  )
);

/**
 * GET /api/payments/investor-interest
 *
 * Auth:     required; office-only
 * Response: 200 with interest accrued across investor payments
 *
 * Computed live through calculateInterest rather than stored, so the
 * figures are correct as of the moment of the request. Related to the
 * per-investor statement at /api/masters/investors/:id/statement, which
 * uses the same calculation.
 */
router.get(
  "/investor-interest",
  asyncHandler(
    paymentController.getInvestorInterest
  )
);

/**
 * GET /api/payments — the ledger.
 *
 * Auth:     required; office-only
 * Query:    filtering by direction, scope, sub-type, tender, date range
 * Response: 200 { success, payments, pagination }
 *
 * Declared after the three literal paths and before "/:id"; the ordering
 * of "/" against "/:id" does not matter, but keeping it here preserves
 * the read-then-write grouping.
 */
router.get(
  "/",
  asyncHandler(
    paymentController.getPayments
  )
);

/**
 * POST /api/payments
 *
 * Auth:     required; office-only
 * Audited:  payments / create
 * Body:     payment_direction, payment_date, payment_scope,
 *           payment_sub_type, amount, plus the fields the sub-type
 *           requires (see REQUIRED_BY_SUB_TYPE)
 * Response: 201 { success, payment }
 *           400 with every validation error at once
 *
 * Business rule:
 * Money figures are RECALCULATED server-side by buildPaymentRecord rather
 * than taken from the body, so a stale or edited client cannot decide what
 * is recorded.
 */
router.post(
  "/",
  logActivity(
    "payments",
    ACTIVITY_ACTIONS.CREATE
  ),
  asyncHandler(
    paymentController.createPayment
  )
);

/**
 * PUT /api/payments/:id
 *
 * Auth:     required; office-only
 * Audited:  payments / update
 * Response: 200 { success, payment }
 *           400 validation failed
 *           404 no such live payment in this company
 *
 * Recalculates the derived figures on every update, for the same reason
 * create does.
 */
router.put(
  "/:id",
  logActivity(
    "payments",
    ACTIVITY_ACTIONS.UPDATE
  ),
  asyncHandler(
    paymentController.updatePayment
  )
);

/**
 * DELETE /api/payments/:id
 *
 * Auth:     required; office-only
 * Audited:  payments / delete
 * Response: 200 { success, message }
 *           404 no such live payment in this company
 *
 * Soft. A deleted payment stays in the table so the audit trail and any
 * report already produced from it remain explicable.
 */
router.delete(
  "/:id",
  logActivity(
    "payments",
    ACTIVITY_ACTIONS.DELETE
  ),
  asyncHandler(
    paymentController.deletePayment
  )
);

module.exports = router;
