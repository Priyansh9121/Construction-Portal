const express = require("express");

const asyncHandler = require(
  "../../utils/asyncHandler"
);

const healthController = require(
  "./health.controller"
);

const router = express.Router();

/**
 * Lightweight process/liveness check.
 */
router.get(
  "/",
  healthController.getLiveness
);

/**
 * Database and storage readiness check.
 */
router.get(
  "/ready",
  asyncHandler(
    healthController.getReadiness
  )
);

module.exports = router;