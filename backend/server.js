const express = require("express");
const cors = require("cors");
const path = require("path");

const { PORT } = require("./config/env");

const authMiddleware = require("./middleware/authMiddleware");
const roleMiddleware = require("./middleware/roleMiddleware");
const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestLogger);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.status(200).send("Construction Portal API is running");
});

app.use("/api/health", require("./modules/health/health.routes"));

app.get("/api/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API test working",
  });
});

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

app.use("/api/auth", require("./modules/auth/auth.routes"));

/*
|--------------------------------------------------------------------------
| Protected Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/payments",
  authMiddleware,
  require("./modules/payments/payment.routes")
);

app.use(
  "/api/workers",
  authMiddleware,
  require("./modules/workers/worker.routes")
);

app.use(
  "/api/sites",
  authMiddleware,
  require("./modules/sites/site.routes")
);

app.use(
  "/api/tenders",
  authMiddleware,
  require("./modules/tenders/tender.routes")
);

app.use(
  "/api/tender-details",
  authMiddleware,
  require("./modules/tenderDetails/tenderDetails.routes")
);

app.use(
  "/api/tender-finance",
  authMiddleware,
  require("./modules/tenderFinance/tenderFinance.routes")
);

app.use(
  "/api/tender-workers",
  authMiddleware,
  require("./modules/tenderWorkers/tenderWorker.routes")
);

app.use(
  "/api/subcontractors",
  authMiddleware,
  require("./modules/subcontractors/subcontractor.routes")
);

app.use(
  "/api/invoices",
  authMiddleware,
  require("./modules/invoices/invoice.routes")
);

app.use(
  "/api/site-logs",
  authMiddleware,
  require("./modules/siteLogs/siteLog.routes")
);

app.use(
  "/api/worker-allocations",
  authMiddleware,
  require("./modules/workerMoney/workerAllocation.routes")
);

app.use(
  "/api/worker-expenses",
  authMiddleware,
  require("./modules/workerMoney/workerExpense.routes")
);

app.use(
  "/api/upload",
  authMiddleware,
  require("./modules/uploads/upload.routes")
);

app.use(
  "/api/daily-update-approvals",
  authMiddleware,
  roleMiddleware(["admin", "manager"]),
  require("./modules/dailyUpdateApprovals/dailyUpdateApproval.routes")
);

/*
|--------------------------------------------------------------------------
| Worker Portal Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/worker-portal",
  authMiddleware,
  roleMiddleware(["admin", "worker"]),
  require("./modules/workerPortal/workerPortal.routes")
);

/*
|--------------------------------------------------------------------------
| Subcontractor Portal Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/subcontractor-portal",
  authMiddleware,
  roleMiddleware(["admin", "subcontractor"]),
  require("./modules/subcontractorPortal/subcontractorPortal.routes")
);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use(errorHandler);

/*
|--------------------------------------------------------------------------
| Server Start
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});