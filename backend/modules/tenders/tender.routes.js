const express = require("express");

const tenderController = require("./tender.controller");

const router = express.Router();

/**
 * Tender / Project routes
 *
 * Base path example:
 * /api/tenders
 */

/**
 * GET /api/tenders
 * Get all tenders/projects with their child sites.
 */
router.get(
  "/",
  tenderController.getTenders
);

/**
 * GET /api/tenders/:id
 * Get one tender/project with all attached sites.
 */
router.get(
  "/:id",
  tenderController.getTenderById
);

/**
 * POST /api/tenders
 * Create a tender/project and its sites.
 */
router.post(
  "/",
  tenderController.createTender
);

/**
 * PUT /api/tenders/:id
 * Update a tender/project and its sites.
 */
router.put(
  "/:id",
  tenderController.updateTender
);

/**
 * DELETE /api/tenders/:id
 * Soft-delete a tender/project and its sites.
 */
router.delete(
  "/:id",
  tenderController.deleteTender
);

/**
 * PATCH /api/tenders/:id/restore
 * Restore a previously soft-deleted tender/project.
 *
 * This route is only active when restoreTender exists
 * in tender.controller.js.
 */
if (
  typeof tenderController.restoreTender ===
  "function"
) {
  router.patch(
    "/:id/restore",
    tenderController.restoreTender
  );
}

module.exports = router;