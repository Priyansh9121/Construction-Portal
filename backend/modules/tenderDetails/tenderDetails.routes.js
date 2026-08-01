const express = require("express");

const asyncHandler = require(
  "../../utils/asyncHandler"
);

const tenderController = require(
  "../tenders/tender.controller"
);

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Temporary Tender Details compatibility route
|--------------------------------------------------------------------------
|
| Existing frontend:
| GET /api/tender-details/:id
|
| Preferred endpoint:
| GET /api/tenders/:id/details
|
| Authentication is already applied in server.js.
|
*/

router.get(
  "/:id",
  asyncHandler(
    tenderController.getTenderDetails
  )
);

module.exports = router;