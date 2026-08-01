const express = require("express");
const cors = require("cors");

const {
  PORT,
  NODE_ENV,
  CORS_ORIGINS,
} = require("./config/env");

const {
  checkDatabaseConnection,
  closeDatabasePool,
} = require("./database/pool");

const authMiddleware = require(
  "./middleware/authMiddleware"
);

const roleMiddleware = require(
  "./middleware/roleMiddleware"
);

const errorHandler = require(
  "./middleware/errorHandler"
);

const requestLogger = require(
  "./middleware/requestLogger"
);

const companyRoutes = require(
  "./modules/companies/company.routes"
);

/*
|--------------------------------------------------------------------------
| Route imports
|--------------------------------------------------------------------------
|
| Import routes once at startup rather than calling require repeatedly
| inside app.use().
|
*/

const healthRoutes = require(
  "./modules/health/health.routes"
);

const authRoutes = require(
  "./modules/auth/auth.routes"
);

const paymentRoutes = require(
  "./modules/payments/payment.routes"
);

const workerRoutes = require(
  "./modules/workers/worker.routes"
);

const siteRoutes = require(
  "./modules/sites/site.routes"
);

const tenderRoutes = require(
  "./modules/tenders/tender.routes"
);

const tenderDetailsRoutes = require(
  "./modules/tenderDetails/tenderDetails.routes"
);

const tenderFinanceRoutes = require(
  "./modules/tenderFinance/tenderFinance.routes"
);

const tenderWorkerRoutes = require(
  "./modules/tenderWorkers/tenderWorker.routes"
);

const subcontractorRoutes = require(
  "./modules/subcontractors/subcontractor.routes"
);

const invoiceRoutes = require(
  "./modules/invoices/invoice.routes"
);

const siteLogRoutes = require(
  "./modules/siteLogs/siteLog.routes"
);

const workerAllocationRoutes = require(
  "./modules/workerMoney/workerAllocation.routes"
);

const workerExpenseRoutes = require(
  "./modules/workerMoney/workerExpense.routes"
);

const uploadRoutes = require(
  "./modules/uploads/upload.routes"
);

const dailyUpdateApprovalRoutes = require(
  "./modules/dailyUpdateApprovals/dailyUpdateApproval.routes"
);

const workerPortalRoutes = require(
  "./modules/workerPortal/workerPortal.routes"
);

const subcontractorPortalRoutes = require(
  "./modules/subcontractorPortal/subcontractorPortal.routes"
);

const app = express();

const isProduction =
  NODE_ENV === "production";

/*
|--------------------------------------------------------------------------
| Express configuration
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");

app.set(
  "trust proxy",
  isProduction ? 1 : false
);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

const corsOptions = {
  origin(origin, callback) {
    /*
     * Requests without Origin include:
     *
     * - curl
     * - Postman
     * - server-to-server requests
     * - health checks
     */
    if (!origin) {
      return callback(
        null,
        true
      );
    }

    if (
      CORS_ORIGINS.includes(
        origin
      )
    ) {
      return callback(
        null,
        true
      );
    }

    const error = new Error(
      "This origin is not allowed to access the API."
    );

    error.statusCode = 403;
    error.publicMessage =
      "This application is not allowed to access the API.";

    return callback(error);
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "X-Request-Id",
  ],

  exposedHeaders: [
    "X-Request-Id",
  ],

  credentials: false,

  maxAge: 86400,
};

app.use(
  cors(corsOptions)
);

/*
|--------------------------------------------------------------------------
| Request parsing
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit: "10mb",
    strict: true,
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
    parameterLimit: 1000,
  })
);

app.use(
  requestLogger
);

/*
|--------------------------------------------------------------------------
| Basic public endpoints
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  (req, res) => {
    return res.status(200).json({
      success: true,
      message:
        "Construction Portal API is running.",
      environment:
        NODE_ENV,
      timestamp:
        new Date().toISOString(),
      request_id:
        req.requestId || null,
    });
  }
);

app.get(
  "/api/test",
  (req, res) => {
    return res.status(200).json({
      success: true,
      message:
        "API test working.",
      timestamp:
        new Date().toISOString(),
    });
  }
);

app.use(
  "/api/health",
  healthRoutes
);

/*
|--------------------------------------------------------------------------
| Authentication routes
|--------------------------------------------------------------------------
|
| This route module contains both public and protected endpoints.
| Protected auth endpoints keep their own auth/role middleware.
|
*/

app.use(
  "/api/auth",
  authRoutes
);

/*
|--------------------------------------------------------------------------
| Standard protected routes
|--------------------------------------------------------------------------
|
| Authentication is applied once here.
|
| Do not repeat router.use(authMiddleware) inside these route files.
|
*/

app.use(
  "/api/company",
  authMiddleware,
  companyRoutes
);

app.use(
  "/api/payments",
  authMiddleware,
  paymentRoutes
);

app.use(
  "/api/workers",
  authMiddleware,
  workerRoutes
);

app.use(
  "/api/sites",
  authMiddleware,
  siteRoutes
);

app.use(
  "/api/tenders",
  authMiddleware,
  require(
    "./modules/tenders/tender.routes"
  )
);

app.use(
  "/api/tender-details",
  authMiddleware,
  require(
    "./modules/tenderDetails/tenderDetails.routes"
  )
);

app.use(
  "/api/tender-finance",
  authMiddleware,
  require(
    "./modules/tenderFinance/tenderFinance.routes"
  )
);

app.use(
  "/api/tender-workers",
  authMiddleware,
  require(
    "./modules/tenderWorkers/tenderWorker.routes"
  )
);

app.use(
  "/api/subcontractors",
  authMiddleware,
  subcontractorRoutes
);

app.use(
  "/api/invoices",
  authMiddleware,
  invoiceRoutes
);

app.use(
  "/api/site-logs",
  authMiddleware,
  siteLogRoutes
);

app.use(
  "/api/worker-allocations",
  authMiddleware,
  workerAllocationRoutes
);

app.use(
  "/api/worker-expenses",
  authMiddleware,
  workerExpenseRoutes
);

app.use(
  "/api/upload",
  authMiddleware,
  uploadRoutes
);

/*
|--------------------------------------------------------------------------
| Admin and manager routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/daily-update-approvals",
  authMiddleware,
  roleMiddleware(
    [
      "admin",
      "manager",
    ],
    {
      source: "either",
    }
  ),
  dailyUpdateApprovalRoutes
);

/*
|--------------------------------------------------------------------------
| Worker portal routes
|--------------------------------------------------------------------------
|
| Admin access is retained for support and troubleshooting.
|
*/

app.use(
  "/api/worker-portal",
  authMiddleware,
  roleMiddleware(
    [
      "admin",
      "worker",
    ],
    {
      source: "either",
    }
  ),
  workerPortalRoutes
);

/*
|--------------------------------------------------------------------------
| Subcontractor portal routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/subcontractor-portal",
  authMiddleware,
  roleMiddleware(
    [
      "admin",
      "subcontractor",
    ],
    {
      source: "either",
    }
  ),
  subcontractorPortalRoutes
);

/*
|--------------------------------------------------------------------------
| 404 handler
|--------------------------------------------------------------------------
*/

app.use(
  (req, res) => {
    return res.status(404).json({
      success: false,
      message:
        "Route not found.",
      method: req.method,
      path: req.originalUrl,
      request_id:
        req.requestId || null,
    });
  }
);

/*
|--------------------------------------------------------------------------
| Global error handler
|--------------------------------------------------------------------------
*/

app.use(errorHandler);

/*
|--------------------------------------------------------------------------
| Server startup and graceful shutdown
|--------------------------------------------------------------------------
*/

let server = null;
let shuttingDown = false;

const startServer = async () => {
  try {
    const database =
      await checkDatabaseConnection();

    console.info(
      "Database connected:",
      {
        database:
          database.database_name,
        schema:
          database.database_schema,
        user:
          database.database_user,
        serverVersion:
          database.server_version,
        databaseTime:
          database.database_time,
      }
    );

    server = app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.info(
          `Construction Portal API running on port ${PORT}`
        );

        if (
          NODE_ENV ===
          "development"
        ) {
          console.info(
            `Local API: http://127.0.0.1:${PORT}`
          );
        }
      }
    );

    server.keepAliveTimeout =
      65000;

    server.headersTimeout =
      66000;

    server.requestTimeout =
      120000;
  } catch (error) {
    console.error(
      "Backend startup failed:",
      error
    );

    process.exit(1);
  }
};

const shutdown = async (
  signal
) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.info(
    `${signal} received. Shutting down gracefully.`
  );

  const forceShutdownTimer =
    setTimeout(() => {
      console.error(
        "Graceful shutdown timed out. Forcing process exit."
      );

      process.exit(1);
    }, 15000);

  forceShutdownTimer.unref();

  try {
    if (server) {
      await new Promise(
        (
          resolve,
          reject
        ) => {
          server.close(
            (error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            }
          );
        }
      );
    }

    await closeDatabasePool();

    console.info(
      "Backend shut down successfully."
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "Graceful shutdown failed:",
      error
    );

    process.exit(1);
  }
};

process.on(
  "SIGINT",
  () =>
    shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () =>
    shutdown("SIGTERM")
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled promise rejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught exception:",
      error
    );

    shutdown(
      "uncaughtException"
    );
  }
);

startServer();

module.exports = app;