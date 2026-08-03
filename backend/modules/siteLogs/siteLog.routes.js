/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for /api/site-logs — the office's view of daily site updates.
|
| Endpoint summary:
|
|   Method Path   Auth  Roles           Controller
|   ------ ------ ----  --------------  ---------------
|   GET    /      yes   admin, manager  getSiteLogs
|   POST   /      yes   admin, manager  createSiteLog
|   DELETE /:id   yes   admin, manager  deleteSiteLog
|
| No PUT. A daily log records what happened on a day; correcting one means
| deleting it and adding another, so the audit trail shows two acts rather
| than a silent revision.
|
| Mount:
|   server.js mounts this at /api/site-logs behind authMiddleware and
|   requireOffice.
|
|   Supervisors do not use this router. They submit updates through
|   /api/worker-portal, which routes them into the approval queue in
|   modules/dailyUpdateApprovals — so an office user creating a log here
|   bypasses approval entirely, which is the intended difference between
|   the two paths.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js
|
| Depends on:
|   ./siteLog.controller.js — hand-written, already wrapped in asyncHandler
|
| Database tables touched:
|   daily_site_logs, sites, tenders, workers, subcontractors
|
| Frontend consumers:
|   frontend/src/services/siteLogService.js -> useSiteLogs.js ->
|   DailySiteUpdatesPage.jsx, and TenderDailyProgressTab.jsx
|
| Note:
|   No logActivity on any route, so creating and deleting daily updates is
|   not written to the audit trail — even though deleteSiteLog records
|   deleted_by on the row itself.
|
*/

const express = require("express");
const router = express.Router();

const siteLogController = require("./siteLog.controller");

/**
 * GET /api/site-logs
 *
 * Query:    ?site_id= ?tender_id= ?from_date= ?to_date= ?limit= ?offset=
 * Response: 200 { success, siteLogs, pagination }
 *
 * Rows come denormalised with site, worker, subcontractor and tender names.
 */
router.get("/", siteLogController.getSiteLogs);

/**
 * POST /api/site-logs
 *
 * Body:     site_id, log_date, and one of worker_id / subcontractor_id
 * Response: 201 { success, siteLog }
 *           400 missing fields, or a future date
 *           403 backdated beyond the window by a non-admin
 *           404 the site or tender is not this company's
 *
 * Enforces the no-future and backdating-window rules. See the controller
 * for the timezone caveat on both (F-13).
 */
router.post("/", siteLogController.createSiteLog);

/**
 * DELETE /api/site-logs/:id
 *
 * Response: 200 { success, message }
 *           404 no such live log in this company
 *
 * Soft delete, recording deleted_by. No window rule applies — history may
 * be corrected at any age, only invented within the window.
 */
router.delete("/:id", siteLogController.deleteSiteLog);

module.exports = router;