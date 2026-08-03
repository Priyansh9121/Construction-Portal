/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The two health probes the hosting platform and any external monitor call.
|
| They answer deliberately different questions:
|
|   liveness   "is this process alive?" — no I/O at all
|   readiness  "can this process actually serve requests?" — checks the
|              database, and storage if configured
|
| The distinction matters operationally. A liveness probe that touched the
| database would report the container as dead during a brief database blip,
| and the platform would restart a perfectly healthy process — repeatedly,
| making the outage worse. Liveness answers only for the process; readiness
| decides whether traffic should be sent.
|
| Responsibilities:
|   - Report process liveness and uptime with no external calls
|   - Probe PostgreSQL, and Supabase Storage when it is configured
|   - Distinguish healthy, degraded and unhealthy
|   - Return 503 only when the API genuinely cannot serve
|
| Exports:
|   getLiveness   GET /api/health
|   getReadiness  GET /api/health/ready
|
| Used by:
|   ./health.routes.js, mounted by server.js at /api/health
|
| Depends on:
|   config/env.js       NODE_ENV, STORAGE_CONFIGURED
|   database/pool.js    checkDatabaseConnection
|   config/supabase.js  checkStorageConnection
|
| Database tables touched:
|   none. checkDatabaseConnection runs a metadata query, not a table read.
|
| Security:
|   Both endpoints are UNAUTHENTICATED — a probe cannot hold a credential.
|   That constrains what they may say. The readiness response names the
|   database, schema, server version and storage bucket, which is more
|   detail than an anonymous caller strictly needs, though it identifies no
|   user or tenant data. Underlying error messages are deliberately NOT
|   echoed: failures are logged server-side and reported to the caller as a
|   flat "Database connection failed."
|
| Note:
|   These sit under /api and are therefore counted by apiLimiter. A monitor
|   polling faster than that budget will eventually be rate-limited.
|
*/

const {
    NODE_ENV,
    STORAGE_CONFIGURED,
  } = require("../../config/env");
  
  const {
    checkDatabaseConnection,
  } = require("../../database/pool");
  
  const {
    checkStorageConnection,
  } = require("../../config/supabase");
  
  /*
   * Captured once when this module is first required, which is during
   * server startup — so it is effectively the process start time.
   *
   * Uptime is the quickest way to spot a crash loop: a service that keeps
   * reporting a few seconds of uptime is restarting, even though every
   * individual probe looks healthy.
   */
  const applicationStartedAt =
    Date.now();

  /**
   * Whole seconds since this process started.
   *
   * Parameters:
   * none
   *
   * Returns:
   * A non-negative integer.
   *
   * Notes:
   * Derived from Date.now() rather than process.uptime() so it measures
   * from when the application loaded rather than when Node began, which is
   * the more useful figure when diagnosing slow starts.
   */
  const getUptimeSeconds = () =>
    Math.floor(
      (Date.now() -
        applicationStartedAt) /
        1000
    );
  
  /**
   * GET /api/health
   *
   * Lightweight liveness check.
   *
   * This confirms the Node.js process is running. It deliberately
   * performs no external database or storage requests.
   *
   * Purpose:
   * The probe a platform calls every few seconds to decide whether to
   * restart the container.
   *
   * Parameters:
   * req - Express request; only requestId is read
   * res - Express response
   *
   * Returns:
   * Always 200 { success, status, service, environment, uptime_seconds,
   * timestamp, request_id }. If the process cannot answer at all, the
   * absence of a response is itself the signal.
   *
   * Side effects:
   * None. No database, no storage, no awaits — which is why it is
   * synchronous and why health.routes.js does not wrap it in asyncHandler.
   *
   * Business rule:
   * Never reports unhealthy. Anything that would make it do so would also
   * prevent it from responding. Use /ready for a probe that can fail.
   *
   * Performance:
   * Constant time, no I/O. Safe to poll aggressively, subject to
   * apiLimiter.
   */
  exports.getLiveness = (
    req,
    res
  ) => {
    return res.status(200).json({
      success: true,
      status: "healthy",
      service:
        "construction-portal-api",
      environment: NODE_ENV,
      uptime_seconds:
        getUptimeSeconds(),
      timestamp:
        new Date().toISOString(),
      request_id:
        req.requestId || null,
    });
  };
  
  /**
   * GET /api/health/ready
   *
   * Readiness check:
   *
   * - PostgreSQL is mandatory.
   * - Supabase Storage is reported separately.
   * - Unconfigured storage does not make the API unavailable.
   *
   * Purpose:
   * Decides whether this instance should receive traffic. Called by the
   * platform's readiness probe and by external uptime monitoring.
   *
   * Parameters:
   * req - Express request
   * res - Express response
   *
   * Returns:
   * 200 { success: true, status: "healthy" }   everything works
   * 200 { success: true, status: "degraded" }  database fine, storage not
   * 503 { success: false, status: "unhealthy" } database unreachable
   *
   * Side effects:
   * One database round trip, plus one storage round trip when storage is
   * configured. Logs the underlying error server-side on failure.
   *
   * Business rules:
   * - PostgreSQL is mandatory. Almost nothing in the product works without
   *   it, so its failure means 503 and the platform stops routing here.
   * - Storage is optional. Uploads break, but tenders, payments and every
   *   register still read and write — so an unhealthy bucket is "degraded",
   *   not "down". Taking the whole API out of service over it would turn a
   *   partial outage into a total one.
   * - Storage that is not configured at all is reported as
   *   "not_configured", which is a normal state locally and not a fault.
   *
   * Error handling:
   * Each probe is wrapped separately, so a storage failure cannot mask the
   * database result. Neither throws — a readiness endpoint that 500s tells
   * the operator nothing about which dependency broke.
   *
   * Security:
   * Error messages are logged with the request id but never returned. The
   * caller sees a flat "connection failed"; a raw driver error would leak
   * the host, port and sometimes credentials to an unauthenticated caller.
   *
   * Performance:
   * The two probes are sequential rather than parallel. Not worth
   * optimising — this endpoint is called by monitors, not users, and
   * sequential keeps the failure attribution simple.
   */
  exports.getReadiness = async (
    req,
    res
  ) => {
    const checks = {
      database: {
        status: "checking",
      },
  
      storage: {
        status:
          STORAGE_CONFIGURED
            ? "checking"
            : "not_configured",
      },
    };
  
    let databaseAvailable =
      false;
  
    try {
      const database =
        await checkDatabaseConnection();
  
      databaseAvailable = true;
  
      checks.database = {
        status: "healthy",
        database:
          database.database_name,
        schema:
          database.database_schema,
        server_version:
          database.server_version,
      };
    } catch (error) {
      checks.database = {
        status: "unhealthy",
        message:
          "Database connection failed.",
      };
  
      console.error(
        "Health check database failure:",
        {
          requestId:
            req.requestId ||
            null,
          message:
            error.message,
          code:
            error.code || null,
        }
      );
    }
  
    if (STORAGE_CONFIGURED) {
      try {
        const storage =
          await checkStorageConnection();
  
        checks.storage = {
          status:
            storage.available
              ? "healthy"
              : "unhealthy",
  
          configured:
            storage.configured,
  
          available:
            storage.available,
  
          bucket:
            storage.bucket ||
            null,
        };
      } catch (error) {
        checks.storage = {
          status: "unhealthy",
          configured: true,
          available: false,
          message:
            "Storage connection failed.",
        };
  
        console.error(
          "Health check storage failure:",
          {
            requestId:
              req.requestId ||
              null,
            message:
              error.message,
          }
        );
      }
    }
  
    /*
     * PostgreSQL is required for nearly every application feature.
     * Storage is optional because the portal can still serve normal
     * records when uploads are temporarily unavailable.
     */
    /*
     * Nested ternary, read as:
     *
     *   database down            -> unhealthy
     *   database up, storage bad -> degraded
     *   otherwise                -> healthy
     *
     * Note that "not_configured" storage is not "unhealthy", so a
     * deployment without Supabase reports healthy rather than degraded.
     */
    const status =
      databaseAvailable
        ? checks.storage.status ===
          "unhealthy"
          ? "degraded"
          : "healthy"
        : "unhealthy";
  
    /*
     * Only the database decides the status code. Degraded still returns
     * 200, because the platform reads the code alone — a 503 for a storage
     * fault would pull a mostly-working instance out of the load balancer
     * and could take the service down over broken uploads.
     *
     * The `status` field carries the nuance for a human or a monitor
     * reading the body.
     */
    const statusCode =
      databaseAvailable
        ? 200
        : 503;
  
    return res
      .status(statusCode)
      .json({
        success:
          databaseAvailable,
  
        status,
  
        service:
          "construction-portal-api",
  
        environment:
          NODE_ENV,
  
        uptime_seconds:
          getUptimeSeconds(),
  
        checks,
  
        timestamp:
          new Date()
            .toISOString(),
  
        request_id:
          req.requestId ||
          null,
      });
  };