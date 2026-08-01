const express = require("express");

const asyncHandler = require(
  "../../utils/asyncHandler"
);

const roleMiddleware = require(
  "../../middleware/roleMiddleware"
);

const tenderController = require(
  "../tenders/tender.controller"
);

const router = express.Router();

const requireTenderManagement =
  roleMiddleware(
    ["admin", "manager"],
    {
      source: "either",
    }
  );

/*
|--------------------------------------------------------------------------
| Temporary Tender Worker compatibility routes
|--------------------------------------------------------------------------
|
| Existing endpoints:
|
| GET    /api/tender-workers/:tenderId
| POST   /api/tender-workers
| PUT    /api/tender-workers/:id
| DELETE /api/tender-workers/:id
|
| Preferred endpoints:
|
| GET    /api/tenders/:id/workers
| POST   /api/tenders/:id/workers
| PUT    /api/tenders/:id/workers/:assignmentId
| DELETE /api/tenders/:id/workers/:assignmentId
|
| Authentication is already applied in server.js.
|
*/

/**
 * GET /api/tender-workers/:tenderId
 */
router.get(
  "/:tenderId",
  (req, res, next) => {
    req.params.id =
      req.params.tenderId;

    next();
  },
  asyncHandler(
    tenderController.getWorkers
  )
);

/**
 * POST /api/tender-workers
 *
 * Existing body must contain:
 *
 * tender_id
 * worker_id
 * site_id
 */
router.post(
  "/",
  requireTenderManagement,
  (req, res, next) => {
    req.params.id =
      req.body.tender_id;

    next();
  },
  asyncHandler(
    tenderController.assignWorker
  )
);

/**
 * PUT /api/tender-workers/:id
 *
 * Existing body must contain tender_id.
 */
router.put(
  "/:id",
  requireTenderManagement,
  (req, res, next) => {
    const assignmentId =
      req.params.id;

    req.params.id =
      req.body.tender_id;

    req.params.assignmentId =
      assignmentId;

    next();
  },
  asyncHandler(
    tenderController.updateWorker
  )
);

/**
 * DELETE /api/tender-workers/:id
 *
 * Supply tender_id in the body or query string.
 */
router.delete(
  "/:id",
  requireTenderManagement,
  (req, res, next) => {
    const assignmentId =
      req.params.id;

    const tenderId =
      req.body?.tender_id ||
      req.query?.tender_id;

    req.params.id =
      tenderId;

    req.params.assignmentId =
      assignmentId;

    next();
  },
  asyncHandler(
    tenderController.removeWorker
  )
);

module.exports = router;