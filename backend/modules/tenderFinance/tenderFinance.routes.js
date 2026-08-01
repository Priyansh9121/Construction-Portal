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
| Temporary Tender Finance compatibility routes
|--------------------------------------------------------------------------
|
| These routes preserve the current frontend API while forwarding all
| operations to the unified Tender controller.
|
| Preferred endpoints:
|
| GET    /api/tenders/:id/finance
| GET    /api/tenders/:id/finance/summary
| POST   /api/tenders/:id/finance
| PUT    /api/tenders/:id/finance/:financeId
| DELETE /api/tenders/:id/finance/:financeId
|
| Authentication is already applied in server.js.
|
*/

/*
|--------------------------------------------------------------------------
| Parameter adapters
|--------------------------------------------------------------------------
|
| Old routes use tenderId and id.
| The unified controller expects id and financeId.
|
*/

const mapTenderId = (
  req,
  res,
  next
) => {
  req.params.id =
    req.params.tenderId;

  next();
};

const mapFinancePayloadTenderId = (
  req,
  res,
  next
) => {
  req.params.id =
    req.body.tender_id;

  next();
};

const mapFinanceRecordIds = (
  req,
  res,
  next
) => {
  req.params.financeId =
    req.params.id;

  req.params.id =
    req.body.tender_id;

  next();
};

/*
|--------------------------------------------------------------------------
| Existing finance reads
|--------------------------------------------------------------------------
*/

/**
 * GET /api/tender-finance/tender/:tenderId
 */
router.get(
  "/tender/:tenderId",
  mapTenderId,
  asyncHandler(
    tenderController.getFinanceRecords
  )
);

/**
 * GET /api/tender-finance/summary/:tenderId
 */
router.get(
  "/summary/:tenderId",
  mapTenderId,
  asyncHandler(
    tenderController.getFinanceSummary
  )
);

/*
|--------------------------------------------------------------------------
| Existing finance writes
|--------------------------------------------------------------------------
*/

/**
 * POST /api/tender-finance
 *
 * Existing request body must contain tender_id.
 */
router.post(
  "/",
  requireTenderManagement,
  mapFinancePayloadTenderId,
  asyncHandler(
    tenderController.createFinanceRecord
  )
);

/**
 * PUT /api/tender-finance/:id
 *
 * Existing request body must contain tender_id.
 */
router.put(
  "/:id",
  requireTenderManagement,
  mapFinanceRecordIds,
  asyncHandler(
    tenderController.updateFinanceRecord
  )
);

/**
 * DELETE /api/tender-finance/:id
 *
 * The old delete request must provide tender_id either:
 *
 * - in the request body; or
 * - as ?tender_id=123
 */
router.delete(
  "/:id",
  requireTenderManagement,
  (req, res, next) => {
    const financeId =
      req.params.id;

    const tenderId =
      req.body?.tender_id ||
      req.query?.tender_id;

    req.params.id =
      tenderId;

    req.params.financeId =
      financeId;

    next();
  },
  asyncHandler(
    tenderController.deleteFinanceRecord
  )
);

module.exports = router;