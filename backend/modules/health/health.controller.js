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
  
  const applicationStartedAt =
    Date.now();
  
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
    const status =
      databaseAvailable
        ? checks.storage.status ===
          "unhealthy"
          ? "degraded"
          : "healthy"
        : "unhealthy";
  
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