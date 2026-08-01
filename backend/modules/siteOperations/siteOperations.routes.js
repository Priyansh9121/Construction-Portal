const express = require("express");

const asyncHandler = require("../../utils/asyncHandler");

const roleMiddleware = require("../../middleware/roleMiddleware");

const materialController = require("./material.controller");
const labourController = require("./labour.controller");
const bankingController = require("./banking.controller");
const accessRequestController = require("./accessRequest.controller");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Site operations
|--------------------------------------------------------------------------
|
| The supervisor-facing surface described in the site notebook: material
| received on site, the labour ledger, the supervisor's banking float, and
| the access requests that let a late entry through.
|
| Authentication is applied once in server.js. These routes add role checks
| only where the action is reserved for the office.
|
*/

const requireOffice = roleMiddleware(
  ["admin", "manager"],
  { source: "either" }
);

/*
|--------------------------------------------------------------------------
| Materials
|--------------------------------------------------------------------------
*/

// GET /api/site-operations/materials/catalog
router.get(
  "/materials/catalog",
  asyncHandler(
    materialController.getCatalog
  )
);

// GET /api/site-operations/materials/summary
router.get(
  "/materials/summary",
  asyncHandler(
    materialController.getSummary
  )
);

// GET /api/site-operations/materials
router.get(
  "/materials",
  asyncHandler(
    materialController.getEntries
  )
);

// POST /api/site-operations/materials
router.post(
  "/materials",
  asyncHandler(
    materialController.createEntry
  )
);

// DELETE /api/site-operations/materials/:id
router.delete(
  "/materials/:id",
  asyncHandler(
    materialController.deleteEntry
  )
);

// Approval is the office's call, not the supervisor's.
router.post(
  "/materials/:id/approve",
  requireOffice,
  asyncHandler(
    materialController.approveEntry
  )
);

router.post(
  "/materials/:id/reject",
  requireOffice,
  asyncHandler(
    materialController.rejectEntry
  )
);

/*
|--------------------------------------------------------------------------
| Labour
|--------------------------------------------------------------------------
*/

// GET /api/site-operations/labour/categories
router.get(
  "/labour/categories",
  asyncHandler(
    labourController.getCategories
  )
);

// GET /api/site-operations/labour
router.get(
  "/labour",
  asyncHandler(
    labourController.getLabour
  )
);

// POST /api/site-operations/labour
router.post(
  "/labour",
  asyncHandler(
    labourController.createLabour
  )
);

// GET /api/site-operations/labour/:id/ledger
router.get(
  "/labour/:id/ledger",
  asyncHandler(
    labourController.getLedger
  )
);

// POST /api/site-operations/labour/:id/entries
router.post(
  "/labour/:id/entries",
  asyncHandler(
    labourController.createWorkEntry
  )
);

// PUT /api/site-operations/labour/:id
router.put(
  "/labour/:id",
  asyncHandler(
    labourController.updateLabour
  )
);

// DELETE /api/site-operations/labour/:id
router.delete(
  "/labour/:id",
  asyncHandler(
    labourController.deleteLabour
  )
);

/*
|--------------------------------------------------------------------------
| Banking
|--------------------------------------------------------------------------
*/

// GET /api/site-operations/banking/summary
router.get(
  "/banking/summary",
  asyncHandler(
    bankingController.getSummary
  )
);

// GET /api/site-operations/banking/receipts
router.get(
  "/banking/receipts",
  asyncHandler(
    bankingController.getReceipts
  )
);

// Issuing funds to a supervisor is an office action — a supervisor
// recording their own incoming money would defeat the reconciliation.
router.post(
  "/banking/receipts",
  requireOffice,
  asyncHandler(
    bankingController.createReceipt
  )
);

// GET /api/site-operations/banking/expenses
router.get(
  "/banking/expenses",
  asyncHandler(
    bankingController.getExpenses
  )
);

// POST /api/site-operations/banking/expenses
router.post(
  "/banking/expenses",
  asyncHandler(
    bankingController.createExpense
  )
);

router.post(
  "/banking/expenses/:id/approve",
  requireOffice,
  asyncHandler(
    bankingController.approveExpense
  )
);

router.post(
  "/banking/expenses/:id/reject",
  requireOffice,
  asyncHandler(
    bankingController.rejectExpense
  )
);

/*
|--------------------------------------------------------------------------
| Access requests
|--------------------------------------------------------------------------
*/

// GET /api/site-operations/access-requests
router.get(
  "/access-requests",
  asyncHandler(
    accessRequestController.getRequests
  )
);

// POST /api/site-operations/access-requests
router.post(
  "/access-requests",
  asyncHandler(
    accessRequestController.createRequest
  )
);

router.post(
  "/access-requests/:id/grant",
  requireOffice,
  asyncHandler(
    accessRequestController.grantRequest
  )
);

router.post(
  "/access-requests/:id/deny",
  requireOffice,
  asyncHandler(
    accessRequestController.denyRequest
  )
);

module.exports = router;
