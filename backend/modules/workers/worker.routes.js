/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for /api/workers — the office's view of the worker roster.
|
| Endpoint summary:
|
|   Method Path   Auth  Roles           Validation      Controller
|   ------ ------ ----  --------------  --------------  ----------------
|   GET    /      yes   admin, manager  —               getWorkers
|   POST   /      yes   admin, manager  validateWorker  createWorker
|   PUT    /:id   yes   admin, manager  validateWorker  updateWorker
|   DELETE /:id   yes   admin, manager  —               deleteWorker
|
| Mount:
|   server.js mounts this at /api/workers behind authMiddleware AND
|   requireOffice, so neither middleware appears in this file. Adding
|   authMiddleware here again would run the token verification and the
|   user lookup twice per request.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js
|
| Depends on:
|   ./worker.controller.js              the scopedCrud-generated handlers
|   ./validations/worker.validation.js  POST and PUT only
|
| Database tables touched:
|   workers
|
| Frontend consumers:
|   frontend/src/services/workerService.js -> useWorkers.js -> WorkersPage
|
| Notes:
|   No asyncHandler wrapping here, and that is correct — createScopedCrud
|   returns handlers already wrapped. Wrapping twice would be harmless but
|   pointless.
|
|   No logActivity either, so worker changes are not written to the audit
|   trail. Consistent with the other plain registers, and different from
|   tenders and payments, which are audited.
|
|   The controller exports getWorkerById but no route mounts it, so
|   GET /api/workers/:id returns 404. The subcontractors and invoices
|   registers have the same gap; only sites routes its getById. Recorded as
|   F-10 in docs/repository-reference/findings.md.
|
*/

const express = require("express");
const router = express.Router();

const workerController = require("./worker.controller");
const validateWorker = require("./validations/worker.validation");

/**
 * GET /api/workers
 *
 * Auth:     required
 * Roles:    admin, manager (at the mount)
 * Query:    ?search= ?status= ?role= ?limit= ?offset=
 * Response: 200 { success, workers, pagination }
 *
 * Scoped to the caller's company by the factory.
 */
router.get("/", workerController.getWorkers);

/**
 * GET /api/workers/:id
 *
 * Auth:       required
 * Roles:      admin, manager (the router's mount gate)
 * Params:     :id
 * Controller: worker.getWorkerById
 * Response:   200 with the worker
 *             404 when it does not exist, or belongs to another company
 *
 * F-10. The controller has always exported this handler and the route file
 * never mounted it, so the endpoint 404'd through the catch-all rather than
 * through its own ownership check. `createScopedCrud` scopes getById by
 * company_id, so the two answers are indistinguishable from outside — which
 * is the correct behaviour and the reason mounting it changes no contract.
 */
router.get("/:id", workerController.getWorkerById);

/**
 * POST /api/workers
 *
 * Auth:       required
 * Roles:      admin, manager
 * Validation: validateWorker — name, phone, salary, role and status all
 *             required; salary must be positive
 * Response:   201 { success, worker }
 *             400 validation failed
 *
 * company_id comes from the session, never the body.
 */
router.post("/", validateWorker, workerController.createWorker);

/**
 * PUT /api/workers/:id
 *
 * Auth:       required
 * Roles:      admin, manager
 * Validation: validateWorker — the same rules as create, so this is a full
 *             replace of the required fields rather than a patch
 * Response:   200 { success, worker }
 *             400 validation failed
 *             404 no such live worker in this company
 */
router.put("/:id", validateWorker, workerController.updateWorker);

/**
 * DELETE /api/workers/:id
 *
 * Auth:     required
 * Roles:    admin, manager
 * Response: 200 { success, message }
 *           404 no such live worker in this company
 *
 * A soft delete. The row stays, flagged is_deleted, because payments,
 * allocations and expenses reference it — a hard delete would orphan the
 * money records attached to this person.
 */
router.delete("/:id", workerController.deleteWorker);

module.exports = router;