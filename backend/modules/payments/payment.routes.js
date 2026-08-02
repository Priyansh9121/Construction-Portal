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

// GET /api/payments/hierarchy — the Add Payment tree
router.get(
  "/hierarchy",
  asyncHandler(
    paymentController.getHierarchy
  )
);

// GET /api/payments/summary
router.get(
  "/summary",
  asyncHandler(
    paymentController.getSummary
  )
);

// GET /api/payments/investor-interest
router.get(
  "/investor-interest",
  asyncHandler(
    paymentController.getInvestorInterest
  )
);

// GET /api/payments
router.get(
  "/",
  asyncHandler(
    paymentController.getPayments
  )
);

// POST /api/payments
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

// PUT /api/payments/:id
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

// DELETE /api/payments/:id
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
