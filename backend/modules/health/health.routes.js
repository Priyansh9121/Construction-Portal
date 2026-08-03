/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The two health endpoints, mounted at /api/health.
|
| Endpoints:
|
|   Method Path    Auth  Roles  Controller
|   ------ ------- ----  -----  --------------------------
|   GET    /       no    —      health.getLiveness
|   GET    /ready  no    —      health.getReadiness
|
| Both are public. A platform probe or an uptime monitor has no credential
| to present, so requiring one would defeat the purpose — which is also why
| the controller is careful about what it says. See its header.
|
| Exports:
|   an Express router
|
| Used by:
|   backend/server.js, mounted at /api/health with no authMiddleware
|
| Depends on:
|   ./health.controller.js
|   utils/asyncHandler.js — on /ready only
|
| Note:
|   getLiveness is deliberately NOT wrapped in asyncHandler. It is
|   synchronous and does no I/O, so there is no promise to catch; wrapping
|   it would add a layer to the one endpoint that most needs to stay
|   trivial. getReadiness is async and is wrapped.
|
*/

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
 *
 * GET /api/health
 *
 * Auth:      none
 * Response:  200 always, with uptime and environment
 *
 * The platform's restart signal. Performs no I/O, so it cannot report a
 * dependency failure — that is /ready's job.
 */
router.get(
  "/",
  healthController.getLiveness
);

/**
 * Database and storage readiness check.
 *
 * GET /api/health/ready
 *
 * Auth:      none
 * Response:  200 healthy or degraded
 *            503 unhealthy — the database is unreachable
 *
 * The traffic-routing signal, and the endpoint to check first when the
 * application is up but misbehaving.
 */
router.get(
  "/ready",
  asyncHandler(
    healthController.getReadiness
  )
);

module.exports = router;