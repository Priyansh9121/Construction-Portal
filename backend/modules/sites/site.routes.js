/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The URL map for /api/sites — the office's register of work locations.
|
| Endpoint summary:
|
|   Method Path   Auth  Roles           Controller
|   ------ ------ ----  --------------  --------------
|   GET    /      yes   admin, manager  getSites
|   POST   /      yes   admin, manager  createSite
|   GET    /:id   yes   admin, manager  getSiteById
|   PUT    /:id   yes   admin, manager  updateSite
|   DELETE /:id   yes   admin, manager  deleteSite
|
| Mount:
|   server.js mounts this at /api/sites behind authMiddleware and
|   requireOffice.
|
|   Note the division of labour with site operations: the office defines
|   sites here, while supervisors record activity against them through
|   /api/site-operations. A supervisor cannot create or edit a site.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js
|
| Depends on:
|   ./site.controller.js — hand-written, and already wrapped in
|   asyncHandler there, so nothing is wrapped again here
|
| Database tables touched:
|   sites, tenders, daily_site_logs, payments
|
| Frontend consumers:
|   frontend/src/services/siteService.js -> useSites.js, and
|   TenderSitesTab.jsx on a tender detail page
|
| Note:
|   The only register that mounts its getById — see F-10 for the three that
|   do not. No logActivity on any route, consistent with the other
|   registers.
|
*/

const express = require("express");
const router = express.Router();

const siteController = require("./site.controller");

/**
 * GET /api/sites
 *
 * Query:    ?tender_id= ?status= ?site_type= ?limit= ?offset=
 * Response: 200 { success, sites, pagination }
 *
 * Each row includes tender_title, so the list renders without a follow-up
 * request per site.
 */
router.get("/", siteController.getSites);

/**
 * POST /api/sites
 *
 * Body:     site_type, site_name, address required
 * Response: 201 { success, site }
 *           400 a required field is missing
 *           404 the tender_id is not this company's
 */
router.post("/", siteController.createSite);

/**
 * GET /api/sites/:id
 *
 * Response: 200 { success, site, tenders }
 *           404 no such live site in this company
 *
 * Declared AFTER POST / but before PUT and DELETE. Ordering is harmless
 * here — "/" and "/:id" cannot both match the same path — but "/:id" would
 * shadow a literal sibling such as "/summary" if one were ever added, so a
 * new static route must go above this line.
 */
router.get("/:id", siteController.getSiteById);

/**
 * PUT /api/sites/:id
 *
 * Body:     site_type, site_name, address required
 * Response: 200 { success, site }
 *           404 no such live site in this company
 *
 * tender_id is not updatable — a site cannot be moved between tenders.
 */
router.put("/:id", siteController.updateSite);

/**
 * DELETE /api/sites/:id
 *
 * Response: 200 { success, message }
 *           404 no such live site in this company
 *           409 daily updates or payments still reference this site
 *
 * The 409 is the notable one: this is the only register that refuses to
 * delete a record still in use rather than soft-deleting it regardless.
 */
router.delete("/:id", siteController.deleteSite);

module.exports = router;