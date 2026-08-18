/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The application entry point and the API's routing table. Everything a
| request passes through is assembled here, in order, and every module is
| mounted here with the authentication and role gates that guard it.
|
| This is the file to read first. The mount list below is the authoritative
| answer to "who is allowed to call what" — the individual route files
| assume the gate above them has already run.
|
| Responsibilities:
|   - Build the Express app and its middleware pipeline
|   - Terminate CORS and set security headers
|   - Mount every feature module behind the right authorisation
|   - Answer 404 for anything unmatched, and hand errors to errorHandler
|   - Verify the database on boot, then listen
|   - Shut down cleanly on a signal
|
| Middleware order (it matters, and each step depends on the last):
|
|     trust proxy        so the client IP is real behind Render's balancer
|   > cors               rejected origins never reach anything else
|   > helmet             security headers on every response, errors too
|   > apiLimiter         a flood is dropped before its body is parsed
|   > express.json       parse the body
|   > body normalisation guarantee req.body is an object
|   > requestLogger      assign a request id, time the request
|   > routes             the feature modules
|   > 404                nothing matched
|   > errorHandler       last, so it catches everything above
|
| Exports:
|   app                  the Express application, for supertest
|   app.startServer      to bind a real socket in an integration test
|
| Used by:
|   npm run dev / npm start — Render's startCommand runs this file
|   backend/tests/*.test.js — import `app` and drive it with supertest
|
| Depends on:
|   express, cors, helmet
|   config/env.js         PORT, NODE_ENV, CORS_ORIGINS
|   database/pool.js      the boot check and the shutdown close
|   middleware             auth, role, logging, rate limiting, errors
|   the .routes.js file of every feature module under modules/
|
| Frontend:
|   frontend/src/api/axiosClient.js points at this server's base URL and
|   attaches the bearer token that authMiddleware verifies.
|
| Note:
|   backend/package.json declares `"main": "index.js"`, which does not
|   exist — this file is the real entry point. Recorded as F-01 in
|   docs/repository-reference/findings.md.
|
*/

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const {
  apiLimiter,
  authLimiter,
} = require("./middleware/rateLimiter");

const {
  PORT,
  NODE_ENV,
  CORS_ORIGINS,
  reportEnvAdjustments,
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

// Removes the "X-Powered-By: Express" header. Free information for anyone
// scanning for framework-specific vulnerabilities, and of no use to a
// legitimate client.
app.disable("x-powered-by");

/*
 * Behind Render's load balancer the socket's remote address is the
 * balancer, not the user. `trust proxy: 1` tells Express to take the client
 * address from the last entry of X-Forwarded-For instead.
 *
 * This is load-bearing for rate limiting: without it every request appears
 * to come from one IP, so the first user to trip authLimiter locks out
 * everybody. It also drives req.ip in the audit trail.
 *
 * Off in development, where there is no proxy — trusting the header locally
 * would let a client set its own apparent IP and sidestep the limiter.
 */
app.set(
  "trust proxy",
  isProduction ? 1 : false
);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| CORS options
|--------------------------------------------------------------------------
|
| The frontend is deployed to Vercel on a different origin from the API on
| Render, so every browser call here is cross-origin and CORS is what makes
| it possible at all.
|
| The allow-list itself is CORS_ORIGINS in config/env.js. This object only
| decides how the list is applied.
|
*/
const corsOptions = {
  /**
   * Decides whether one origin may call the API.
   *
   * Parameters:
   * origin   - the Origin header, or undefined when there is none
   * callback - (error, allowed) in Node's usual style
   *
   * Returns:
   * Nothing; answers through the callback.
   *
   * Security:
   * An exact string match against the configured list — no wildcards, no
   * prefix matching, no regular expression. That is deliberate: a pattern
   * like /example\.com$/ would also match "evil-example.com".
   *
   * The rejection carries a `publicMessage`, which errorHandler.js uses to
   * decide the wording is safe to show a user, and statusCode 403.
   */
  origin(origin, callback) {
    /*
     * Requests without Origin include:
     *
     * - curl
     * - Postman
     * - server-to-server requests
     * - health checks
     *
     * Allowing them is not the hole it looks like. CORS is a browser
     * mechanism: it stops a page on one origin reading another origin's
     * responses. A tool that sends no Origin is not a browser and was never
     * constrained by it — blocking here would break Render's health check
     * and every curl call without protecting anything.
     *
     * Actual authorisation is authMiddleware's job, not this function's.
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

  // Every verb the API uses, plus OPTIONS for the preflight itself.
  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  // Request headers the frontend is permitted to send. Authorization
  // carries the bearer token; X-Request-Id lets a client correlate its own
  // logs with the server's.
  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "X-Request-Id",
  ],

  // Response headers JavaScript may read. Without listing it here the
  // browser hides X-Request-Id from the frontend even though it is sent,
  // which would make a user-reported error impossible to trace back.
  exposedHeaders: [
    "X-Request-Id",
  ],

  /*
   * No cookies, and none wanted. Authentication is a bearer token held by
   * the frontend and attached per request, so the browser never sends
   * credentials automatically — which means this API has no CSRF surface.
   */
  credentials: false,

  // Cache the preflight for a day, so the browser stops sending an OPTIONS
  // ahead of every mutating request.
  maxAge: 86400,
};

app.use(
  cors(corsOptions)
);

/*
|--------------------------------------------------------------------------
| Security headers
|--------------------------------------------------------------------------
|
| This is a JSON API: it returns no HTML and loads no third-party assets, so
| the content policy can be as restrictive as possible.
|
| The frontend is served separately by Vercel and needs its own headers —
| those are set in frontend/vercel.json.
|
*/

app.use(
  helmet({
    // Nothing here should ever be rendered as a document.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },

    // Tell browsers to stay on HTTPS for a year, including subdomains.
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },

    // Do not leak the API URL to third parties via the Referer header.
    referrerPolicy: {
      policy: "no-referrer",
    },

    // API responses are consumed by fetch/XHR, never embedded, so the
    // stricter cross-origin policies are safe here.
    crossOriginResourcePolicy: {
      policy: "same-site",
    },

    // Would block the frontend on a different origin from reading responses.
    crossOriginEmbedderPolicy: false,
  })
);

/*
|--------------------------------------------------------------------------
| Rate limiting
|--------------------------------------------------------------------------
|
| Applied before body parsing so a flood is rejected before the request
| body is read into memory.
|
*/

app.use(
  "/api",
  apiLimiter
);

/*
|--------------------------------------------------------------------------
| Request parsing
|--------------------------------------------------------------------------
*/

/*
 * 10mb is generous for JSON, but document metadata and the occasional
 * base64 payload push past the 100kb default. A ceiling still has to exist
 * — without one, a single request can exhaust the process's memory.
 *
 * strict: true accepts only objects and arrays at the top level. A bare
 * `"string"` or `null` is valid JSON but never something this API expects,
 * and rejecting it here spares every controller the check.
 */
app.use(
  express.json({
    limit: "10mb",
    strict: true,
  })
);

/*
 * Form-encoded bodies, for the rare non-JSON client. parameterLimit caps
 * the number of fields: the default 1000 is kept explicitly because the
 * parser's cost grows with field count, which makes an unbounded form a
 * cheap way to burn CPU.
 */
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
    parameterLimit: 1000,
  })
);

/*
|--------------------------------------------------------------------------
| Body normalisation
|--------------------------------------------------------------------------
|
| Express 5 leaves req.body undefined when a request carries no body and no
| Content-Type, rather than defaulting it to {}. Handlers that read an
| optional field — an approve endpoint reading req.body.admin_comment, for
| instance — then throw a TypeError and return 500 where they should have
| returned a normal result.
|
| Guaranteeing an object here fixes the whole class of bug in one place
| instead of requiring optional chaining at every read site.
|
*/
app.use((req, _res, next) => {
  if (
    req.body === undefined ||
    req.body === null
  ) {
    req.body = {};
  }

  next();
});

app.use(
  requestLogger
);

/*
|--------------------------------------------------------------------------
| Basic public endpoints
|--------------------------------------------------------------------------
*/

/*
 * GET /
 *
 * Auth:     none
 * Roles:    none
 * Response: 200 with the environment name and current time
 *
 * A liveness signal for anyone who opens the API's base URL in a browser
 * and needs to know whether it is up and which environment answered. The
 * real health check with its database probe is /api/health.
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

/*
 * GET /api/test
 *
 * Auth:     none
 * Roles:    none
 * Response: 200 with a fixed message
 *
 * Confirms that the /api prefix itself routes and that apiLimiter is in
 * front of it — useful when a deployment's rewrite rules are suspect,
 * because it isolates "the path reaches Express" from "the handler works".
 */
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

// authLimiter sits in front of every credential endpoint. It only counts
// failed attempts, so normal use never trips it.
app.use(
  "/api/auth",
  authLimiter,
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

/*
|--------------------------------------------------------------------------
| Office-only registers
|--------------------------------------------------------------------------
|
| Authentication alone is not authorisation. These registers hold the
| company's commercial record — tenders with their margins and client
| contacts, every payment, the worker roster, subcontractor bank details,
| invoices and the investor list.
|
| Every one of them was reachable by any authenticated account, which
| includes the labourer and subcontractor logins created for the portals.
| A worker could read company margins and client phone numbers, and could
| create payments, invoices and subcontractors outright.
|
| Workers and subcontractors have their own scoped surfaces and do not
| need these:
|
|     /api/worker-portal/*          their assignments, updates and money
|     /api/subcontractor-portal/*   their tenders and documents
|     /api/site-operations/*        shared, gated per route inside
|
| Gating at the mount means a new route added inside any of these modules
| inherits the restriction instead of having to remember it.
|
|--------------------------------------------------------------------------
| The complete mount table
|--------------------------------------------------------------------------
|
|   Path                            Auth  Roles allowed
|   ------------------------------  ----  --------------------------------
|   /                               no    everyone
|   /api/test                       no    everyone
|   /api/health                     no    everyone
|   /api/auth                       part  public login/register/reset;
|                                         protected endpoints gate
|                                         themselves inside the module
|   /api/company                    yes   any authenticated user
|   /api/payments                   yes   admin, manager
|   /api/workers                    yes   admin, manager
|   /api/sites                      yes   admin, manager
|   /api/tenders                    yes   admin, manager
|   /api/subcontractors             yes   admin, manager
|   /api/invoices                   yes   admin, manager
|   /api/site-logs                  yes   admin, manager
|   /api/masters                    yes   admin, manager
|   /api/worker-allocations         yes   admin, manager
|   /api/worker-expenses            yes   admin, manager
|   /api/daily-update-approvals     yes   admin, manager
|   /api/site-operations            yes   any authenticated; per-route
|                                         role checks inside the module
|   /api/notifications              yes   any authenticated
|   /api/activity                   yes   any authenticated
|   /api/upload                     yes   any authenticated
|   /api/worker-portal              yes   admin, worker
|   /api/subcontractor-portal       yes   admin, subcontractor
|
| Anything else falls through to the 404 handler at the foot of this file.
|
| backend/tests/roleSeparation.test.js and tenantIsolation.test.js assert
| this table, so a mount that loses its gate fails the suite rather than
| shipping.
|
*/

/**
 * The office gate: admin and manager only.
 *
 * Built once and reused across every commercial mount, so the definition of
 * "the office" lives in one place. Changing who counts as office staff is a
 * one-line edit here rather than a hunt through the mounts.
 *
 * `source: "either"` accepts the role from users.role or from
 * company_users.role. The two are normally identical; accepting either
 * means a user whose company membership grants manager is not locked out
 * because their global role still says worker. See middleware/
 * roleMiddleware.js for how the two are resolved.
 */
const requireOffice = roleMiddleware(
  [
    "admin",
    "manager",
  ],
  {
    source: "either",
  }
);

/*
 * Company profile and user management.
 *
 * Authenticated but deliberately not office-gated at the mount: every user
 * needs to read their own company's name, timezone and currency for the UI
 * to render. The endpoints that manage other users apply their own admin
 * check inside company.routes.js.
 */
app.use(
  "/api/company",
  authMiddleware,
  companyRoutes
);

app.use(
  "/api/payments",
  authMiddleware,
  requireOffice,
  paymentRoutes
);

app.use(
  "/api/workers",
  authMiddleware,
  requireOffice,
  workerRoutes
);

app.use(
  "/api/sites",
  authMiddleware,
  requireOffice,
  siteRoutes
);

/*
 * Uses the `tenderRoutes` binding imported at the top of the file. This
 * previously re-required the module inline, which left the import unused —
 * identical behaviour (both resolve to the same cached module) but a dead
 * binding that the backend linter now rejects.
 */
app.use(
  "/api/tenders",
  authMiddleware,
  requireOffice,
  tenderRoutes
);

app.use(
  "/api/subcontractors",
  authMiddleware,
  requireOffice,
  subcontractorRoutes
);

app.use(
  "/api/invoices",
  authMiddleware,
  requireOffice,
  invoiceRoutes
);

app.use(
  "/api/site-logs",
  authMiddleware,
  requireOffice,
  siteLogRoutes
);

/*
|--------------------------------------------------------------------------
| Site operations
|--------------------------------------------------------------------------
|
| Supervisor-facing site recording: material received, the labour ledger,
| the supervisor banking float, and backdated-entry access requests.
|
| Role checks are applied per route inside the module, because supervisors
| and the office share these paths with different permissions.
|
*/
app.use(
  "/api/site-operations",
  authMiddleware,
  require(
    "./modules/siteOperations/siteOperations.routes"
  )
);

/*
|--------------------------------------------------------------------------
| Master data
|--------------------------------------------------------------------------
|
| Investors, suppliers and clients. These tables existed in the database
| with no code behind them, so payments could only reference an investor by
| free-text name.
|
*/
app.use(
  "/api/masters",
  authMiddleware,
  requireOffice,
  require(
    "./modules/masters/master.routes"
  )
);

/*
|--------------------------------------------------------------------------
| Notifications and audit trail
|--------------------------------------------------------------------------
*/
/*
 * Notifications are personal, so every role has them and the mount is not
 * office-gated. Scoping is by recipient inside the module: a query filters
 * on the authenticated user's id, which is what keeps one user from reading
 * another's notifications.
 */
app.use(
  "/api/notifications",
  authMiddleware,
  require(
    "./modules/notifications/notification.routes"
  )
);

/*
 * The read side of the audit trail written by utils/activityLog.js.
 *
 * Authenticated only at the mount; the admin restriction is applied inside
 * activity.routes.js, alongside the company scoping that stops one tenant
 * reading another's history.
 */
app.use(
  "/api/activity",
  authMiddleware,
  require(
    "./modules/notifications/activity.routes"
  )
);

app.use(
  "/api/worker-allocations",
  authMiddleware,
  requireOffice,
  workerAllocationRoutes
);

app.use(
  "/api/worker-expenses",
  authMiddleware,
  requireOffice,
  workerExpenseRoutes
);

/*
 * File upload to Supabase Storage.
 *
 * Open to every authenticated role on purpose: a supervisor photographs a
 * delivery docket, a subcontractor attaches a document. The controls are
 * inside the module rather than at the mount — an allow-list of folders,
 * a size ceiling and a MIME check, all configured in config/env.js.
 */
app.use(
  "/api/upload",
  authMiddleware,
  uploadRoutes
);

/*
|--------------------------------------------------------------------------
| Admin and manager routes
|--------------------------------------------------------------------------
|
| The approval queue for supervisor daily updates. Office-only for the
| obvious reason: the people being approved must not be able to approve
| themselves.
|
| Spelled out inline rather than reusing requireOffice. The two are
| currently identical, so this is redundant — but it is also the mount where
| the role list is most likely to need to diverge, and leaving it explicit
| means that change cannot silently alter every other office mount.
|
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
| A worker reaches only this surface: their own assignments, their own daily
| updates, and their own money. Manager is deliberately absent — a manager
| has the full registers and has no reason to act through the worker portal,
| and every endpoint inside scopes to the caller's own worker record anyway.
|
| Frontend: frontend/src/pages/WorkerPortalPage.jsx.
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
|
| The mirror of the worker portal for subcontractors: the tenders they are
| assigned to and the documents attached to them. Admin is again allowed
| through for support.
|
| Frontend: frontend/src/pages/SubcontractorPortalPage.jsx.
|
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
|
| Reached only when no mount above matched. Position is the whole mechanism
| — Express tries middleware in registration order, so this must stay below
| every route and above the error handler.
|
| The response echoes the method and path, which turns "the frontend called
| the wrong URL" into a self-diagnosing error rather than a silent failure,
| and includes the request id so it can be matched to the server log.
|
| It reveals nothing: an unmatched path is unmatched for authenticated and
| anonymous callers alike, so this cannot be used to discover which
| endpoints exist.
|
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
|
| Last in the chain, which is what makes it global: Express routes an error
| to the next handler taking four arguments, and this is the only one.
| Everything asyncHandler catches ends up here.
|
| Registering it after the 404 is required. Above the routes it would never
| see an error, because nothing below it would have run yet.
|
*/

app.use(errorHandler);

/*
|--------------------------------------------------------------------------
| Server startup and graceful shutdown
|--------------------------------------------------------------------------
*/

/**
 * The HTTP server once listening, or null before startup and in tests.
 * Module-scoped so shutdown() can close the same instance startServer
 * created.
 */
let server = null;

/**
 * Guards against a second shutdown running concurrently.
 *
 * A container stopping often sends SIGTERM and then SIGINT, and an
 * uncaughtException can arrive mid-shutdown. Without this flag the pool
 * would be closed twice and the forced-exit timer set twice.
 */
let shuttingDown = false;

/**
 * Verifies the database, then binds the port.
 *
 * Purpose:
 * Ordering the two is the point. Binding first would mean the platform
 * marks the deploy healthy and starts routing traffic while the database
 * is unreachable, so users meet 500s instead of the previous version
 * staying up. Checking first turns a bad configuration into a failed
 * deploy.
 *
 * Parameters:
 * none — the port comes from config/env.js
 *
 * Returns:
 * A promise resolving once the server is listening. Nothing awaits it.
 *
 * Side effects:
 * Queries the database, binds the TCP port, sets the module-level `server`,
 * writes to the console, and exits the process on failure.
 *
 * Notes:
 * Listening on 0.0.0.0 rather than localhost is required in a container —
 * a server bound to the loopback address is unreachable from outside it.
 */
const startServer = async () => {
  try {
    /*
     * SAY WHAT THE ENVIRONMENT ACTUALLY RESOLVED TO, before anything uses it.
     *
     * The parsers in config/env.js clamp an out-of-range value toward the
     * range rather than reverting it to the default, and record every such
     * disagreement. Printing them first means a misconfigured limit announces
     * itself at boot instead of surfacing later as inexplicable behaviour --
     * which is exactly how AUTH_RATE_LIMIT_MAX=100000 silently became 10 and
     * cost a day of chasing 429s that looked like flaky tests.
     *
     * Silent when every value was used as written.
     */
    reportEnvAdjustments();

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

    /*
     * Timeouts tuned for sitting behind a load balancer.
     *
     * keepAliveTimeout must exceed the balancer's own idle timeout — 60s on
     * most platforms. If Node closes an idle connection first, the balancer
     * can hand it a request as it dies, which the client sees as a random
     * 502. Outlasting the balancer means the balancer always closes first.
     *
     * headersTimeout must in turn exceed keepAliveTimeout, or Node can time
     * out the headers of a request arriving on a connection it was about to
     * keep. Hence 66000 against 65000.
     *
     * requestTimeout caps a whole request at two minutes, which is generous
     * enough for a large upload and short enough that a stalled client
     * cannot hold a socket indefinitely.
     */
    server.keepAliveTimeout =
      65000;

    server.headersTimeout =
      66000;

    server.requestTimeout =
      120000;
  } catch (error) {
    /*
     * Exit rather than continue. A server that cannot reach its database
     * can serve nothing, and exiting non-zero is the signal the platform
     * understands: it aborts the deploy and leaves the previous release
     * running.
     */
    console.error(
      "Backend startup failed:",
      error
    );

    process.exit(1);
  }
};

/**
 * Stops accepting connections, drains the in-flight ones, closes the pool.
 *
 * Purpose:
 * A deploy or a scale-down sends SIGTERM and then kills the process. Exiting
 * immediately would sever requests mid-flight — including a payment insert
 * between its INSERT and its COMMIT. This gives that work a bounded window
 * to finish.
 *
 * Parameters:
 * signal - what triggered the shutdown; used only in the log line, so the
 *          operator can tell a deploy from a crash
 *
 * Returns:
 * Never returns. Every path ends in process.exit.
 *
 * Side effects:
 * Stops the listener, closes the database pool, exits the process — 0 on a
 * clean drain, 1 on failure or timeout.
 *
 * Business rule:
 * server.close() stops new connections but lets existing responses finish,
 * which is the difference between a graceful restart and a visible outage.
 * The pool is closed only afterwards, since a draining request still needs
 * it.
 *
 * Notes:
 * Re-entrant calls return immediately via the `shuttingDown` flag.
 */
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

  /*
   * A backstop. One request that never completes — a hung query, a client
   * that stopped reading — keeps server.close() pending forever, and the
   * platform would eventually SIGKILL us anyway, less tidily. Fifteen
   * seconds sits inside the usual 30-second grace period.
   */
  const forceShutdownTimer =
    setTimeout(() => {
      console.error(
        "Graceful shutdown timed out. Forcing process exit."
      );

      process.exit(1);
    }, 15000);

  /*
   * unref() lets the process exit while this timer is still pending. Without
   * it, a shutdown that drained in two seconds would sit idle for the
   * remaining thirteen waiting for the timer that exists only to handle the
   * case where draining never finishes.
   */
  forceShutdownTimer.unref();

  try {
    // Promisified because server.close is callback-based and the rest of
    // this function is async. The guard covers shutdown being reached
    // before startServer assigned `server`.
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

/*
|--------------------------------------------------------------------------
| Process signal handlers
|--------------------------------------------------------------------------
|
| SIGINT   Ctrl-C in a local terminal.
| SIGTERM  what a container runtime sends before stopping a service. This
|          is the one that matters in production; every deploy sends it.
|
| Both drain rather than exit, so a restart does not sever work in flight.
|
*/

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

/*
 * A promise rejected with nothing to catch it. Logged, and deliberately not
 * fatal: the usual cause here is a fire-and-forget write — an audit row or
 * a notification — and losing one of those is not a reason to drop every
 * request currently being served.
 *
 * Node's default would be to terminate the process. Overriding that is a
 * considered trade-off, not an oversight; the log line is what makes the
 * swallowed rejection findable.
 */
process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled promise rejection:",
      reason
    );
  }
);

/*
 * A synchronous throw that reached the top of the stack. Treated as fatal,
 * unlike a rejection above.
 *
 * After an uncaught exception the process state is not trustworthy — a
 * handler may have thrown halfway through mutating something — so the only
 * safe course is to stop taking new work and go down cleanly. Draining
 * first still lets requests already in flight finish.
 */
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

/*
|--------------------------------------------------------------------------
| Startup
|--------------------------------------------------------------------------
|
| Only listen when this file is the process entry point.
|
| Without this guard, `require("./server")` from a test bound the port and
| started the graceful-shutdown handlers as a side effect, which made the
| app impossible to drive with supertest. Tests import the exported `app`
| and let supertest manage the socket.
|
*/
if (require.main === module) {
  startServer();
}

module.exports = app;

// Exposed so an integration test can start and stop the real listener when
// it needs one.
module.exports.startServer = startServer;