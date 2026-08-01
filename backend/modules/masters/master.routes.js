const express = require("express");

const asyncHandler = require("../../utils/asyncHandler");

const roleMiddleware = require("../../middleware/roleMiddleware");

const masterController = require("./master.controller");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Master data
|--------------------------------------------------------------------------
|
|   GET    /api/masters/investors
|   GET    /api/masters/suppliers
|   GET    /api/masters/clients
|   POST   /api/masters/:master
|   PUT    /api/masters/:master/:id
|   DELETE /api/masters/:master/:id
|
|   GET    /api/masters/investors/:id/statement
|
| The :master segment is checked against an allowlist inside the controller
| before it reaches any SQL.
|
| Reading is open to any authenticated user; writing is office-only, since
| these lists are shared reference data.
|
*/

const requireOffice = roleMiddleware(
  ["admin", "manager"],
  { source: "either" }
);

// Declared before the generic list route so it is not shadowed by
// "/:master".
router.get(
  "/investors/:id/statement",
  asyncHandler(
    masterController.getInvestorStatement
  )
);

router.get(
  "/:master",
  asyncHandler(masterController.list)
);

router.post(
  "/:master",
  requireOffice,
  asyncHandler(masterController.create)
);

router.put(
  "/:master/:id",
  requireOffice,
  asyncHandler(masterController.update)
);

router.delete(
  "/:master/:id",
  requireOffice,
  asyncHandler(
    masterController.archive
  )
);

module.exports = router;
