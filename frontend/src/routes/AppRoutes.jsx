/**
 * File purpose:
 * The frontend routing table. Maps every URL to a page, and wraps each in
 * the role guard and layout it needs.
 *
 * Responsibilities:
 * - Declare the public routes (login, register, password reset)
 * - Declare the protected routes, each behind RoleRoute
 * - Wrap protected pages in AppLayout
 * - Pass the shared data from App.jsx down to the pages that expect it
 *
 * Route groups:
 * - Public          /login, /register, /forgot-password, /reset-password
 * - Office          dashboard, payments, tenders, workers, invoices,
 *                   subcontractors, reports, masters, activity, users
 * - Site operations shared between office and supervisors
 * - Worker portal   /worker-portal, worker role
 * - Subcontractor   /subcontractor-portal, subcontractor role
 *
 * Connected to:
 * - Rendered by App.jsx
 * - Uses RoleRoute for guarding and AppLayout for the shell
 * - Mirrors the backend's mount table in server.js; the two should agree
 *   about which roles reach which area, though the backend is the one that
 *   enforces it
 *
 * Important notes:
 * - The role lists here are a UI convenience. RoleRoute decides which
 *   screen renders; roleMiddleware on the backend decides what data comes
 *   back. A mismatch shows as a page that loads and then fails its
 *   requests, which is the safe direction.
 * - Each role has a different landing page — see getHomePath in
 *   RoleRoute.jsx — so "/" means something different per role.
 */

import {
  lazy,
  Suspense,
} from "react";

import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppLayout from "../layouts/AppLayout";
import RoleRoute from "./RoleRoute";

/*
|--------------------------------------------------------------------------
| Page loading
|--------------------------------------------------------------------------
|
| Login and the four public auth screens are imported eagerly: they are the
| first thing an unauthenticated visitor sees, and code-splitting them would
| add a network round trip to the one render that must be fastest.
|
| Every authenticated page is lazy. They were all in the single entry chunk,
| which is why it reached ~1.9 MB — a labourer opening the worker portal was
| downloading the settings screen, the reports screen and three PDF/XLSX
| export libraries they can never reach.
|
| Each lazy() call becomes its own chunk, fetched when its route first
| renders. <Suspense> below supplies the fallback while that happens.
*/

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";

const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const PaymentsPage = lazy(() => import("../pages/PaymentsPage"));
const WorkersPage = lazy(() => import("../pages/WorkersPage"));
const WorkerMoneyPage = lazy(() => import("../pages/WorkerMoneyPage"));
const TendersPage = lazy(() => import("../pages/TendersPage"));
const TenderDetailsPage = lazy(() => import("../pages/TenderDetailsPage"));
const InvoicesPage = lazy(() => import("../pages/InvoicesPage"));
const DailySiteUpdatesPage = lazy(() => import("../pages/DailySiteUpdatesPage"));
const DailyUpdateApprovalsPage = lazy(() => import("../pages/DailyUpdateApprovalsPage"));
const SubcontractorsPage = lazy(() => import("../pages/SubcontractorsPage"));
const UsersPage = lazy(() => import("../pages/UsersPage"));
const ReportsPage = lazy(() => import("../pages/ReportsPage"));
const MastersPage = lazy(() => import("../pages/MastersPage"));
const ActivityPage = lazy(() => import("../pages/ActivityPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));

const WorkerPortalPage = lazy(() => import("../pages/WorkerPortalPage"));
const SubcontractorPortalPage = lazy(() => import("../pages/SubcontractorPortalPage"));
const SiteOperationsPage = lazy(() => import("../pages/SiteOperationsPage"));

function getRole(user) {
  return String(user?.role || "")
    .trim()
    .toLowerCase();
}

function getHomePath(user) {
  const role = getRole(user);

  if (role === "worker") {
    return "/worker-portal";
  }

  if (role === "subcontractor") {
    return "/subcontractor-portal";
  }

  return "/dashboard";
}

/**
 * Protected layout for administrators and managers.
 */
function AdminManagerLayout({
  children,
  activePage,
  user,
}) {
  return (
    <RoleRoute
      user={user}
      allowedRoles={[
        "admin",
        "manager",
      ]}
    >
      <AppLayout
        activePage={activePage}
        user={user}
      >
        {children}
      </AppLayout>
    </RoleRoute>
  );
}

/**
 * Protected layout for Site Operations.
 *
 * Admin, manager AND worker — the last of those deliberately.
 *
 * §1.15 has the supervisor writing down the names of the labourers working
 * under him, and those labourers are `labour` rows with no login. So the
 * people holding `worker` logins ARE the supervisors; there is no separate
 * role missing from the model.
 *
 * The backend has always encoded that: every recording endpoint in
 * `modules/siteOperations` is open to any authenticated caller, and only
 * approve/reject carry `requireOffice`. Until 2026-08-19 this router was
 * the only thing that disagreed, and it silently redirected supervisors to
 * `/worker-portal` — which is why every site-operations table in
 * production holds zero rows.
 *
 * They are NOT promoted to `manager` to achieve this. `WINDOW_EXEMPT_ROLES`
 * is `["admin", "manager"]`, so promoting them would exempt exactly the
 * people §1.13's two-day entry window exists to constrain — the same inert
 * composition, rebuilt on purpose.
 *
 * `/daily-site-updates` was briefly wrapped in this too and has been put
 * back behind AdminManagerLayout. That screen writes `daily_site_logs`
 * directly, while a supervisor's update goes to `daily_update_approvals`
 * via `/worker-portal` and only becomes a site log once the office approves
 * it (dailyUpdateApproval.controller.js:301). Admitting them here would
 * have handed them a way around their own approval step — the opposite of
 * the segregation the approve control exists for.
 */
function SiteWorkLayout({
  children,
  activePage,
  user,
}) {
  return (
    <RoleRoute
      user={user}
      allowedRoles={[
        "admin",
        "manager",
        "worker",
      ]}
    >
      <AppLayout
        activePage={activePage}
        user={user}
      >
        {children}
      </AppLayout>
    </RoleRoute>
  );
}

/**
 * Protected layout for administrators only.
 */
function AdminLayout({
  children,
  activePage,
  user,
}) {
  return (
    <RoleRoute
      user={user}
      allowedRoles={["admin"]}
    >
      <AppLayout
        activePage={activePage}
        user={user}
      >
        {children}
      </AppLayout>
    </RoleRoute>
  );
}

function AppRoutes({
  /*
   * Authentication
   */
  user,
  logout,
  email,
  setEmail,
  password,
  setPassword,
  message,
  handleLogin,

  /*
   * Finance
   */
  payments = [],
  addPayment,
  deletePayment,
  fetchPayments,

  /*
   * Shared dashboard and reporting data
   */
  workers = [],
  sites = [],
  tenders = [],
  invoices = [],

  /*
   * Tender register. These come from the same App.jsx hook instance that
   * produces `tenders` above, so creating or deleting on TendersPage
   * updates the list every other page reads.
   */
  addTender,
  removeTender,
  fetchTenders,

  /*
   * Worker and invoice registers. Same reasoning as the tender register
   * above: one hook instance in App.jsx, so a create or delete on the
   * register page is visible to Dashboard and Reports without a reload.
   */
  addWorker,
  removeWorker,
  fetchWorkers,

  addInvoice,
  removeInvoice,
  fetchInvoices,

  /*
   * Daily site updates
   */
  siteLogs = [],
  addSiteLog,
  deleteSiteLog,

  /*
   * Worker money
   */
  allocations = [],
  expenses = [],
  addAllocation,
  addExpense,
  fetchAllocations,
  fetchExpenses,
  updateAllocation,
  deleteAllocation,
  updateExpense,
  deleteExpense,
  approveExpense,
  rejectExpense,
  approveAllocation,
  rejectAllocation,
}) {
  const homePath = getHomePath(user);

  return (
    /*
     * Every authenticated page is lazy, so a route change can suspend while
     * its chunk downloads. Without a boundary here React throws instead of
     * waiting. The fallback is deliberately plain — it is visible for a
     * fraction of a second on a normal connection, and a spinner that
     * flashes is worse than a word that does not.
     */
    <Suspense
      fallback={
        <div className="page-loading">
          Loading...
        </div>
      }
    >
    <Routes>
      {/* Authentication */}

      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to={homePath}
              replace
            />
          ) : (
            <LoginPage
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              message={message}
              handleLogin={handleLogin}
            />
          )
        }
      />

      <Route
        path="/register"
        element={
          user ? (
            <Navigate
              to={homePath}
              replace
            />
          ) : (
            <RegisterPage />
          )
        }
      />

      <Route
        path="/forgot-password"
        element={
          user ? (
            <Navigate
              to={homePath}
              replace
            />
          ) : (
            <ForgotPasswordPage />
          )
        }
      />

      <Route
        path="/reset-password"
        element={
          user ? (
            <Navigate
              to={homePath}
              replace
            />
          ) : (
            <ResetPasswordPage />
          )
        }
      />

      {/* Worker portal */}

      <Route
        path="/worker-portal"
        element={
          <RoleRoute
            user={user}
            allowedRoles={["worker"]}
          >
            <WorkerPortalPage
              logout={logout}
            />
          </RoleRoute>
        }
      />

      {/* Subcontractor portal */}

      <Route
        path="/subcontractor-portal"
        element={
          <RoleRoute
            user={user}
            allowedRoles={[
              "subcontractor",
            ]}
          >
            <SubcontractorPortalPage
              logout={logout}
            />
          </RoleRoute>
        }
      />

      {/* Dashboard */}

      <Route
        path="/dashboard"
        element={
          <AdminManagerLayout
            activePage="Dashboard"
            user={user}
          >
            <DashboardPage
              payments={payments}
              workers={workers}
              sites={sites}
              tenders={tenders}
              invoices={invoices}
            />
          </AdminManagerLayout>
        }
      />

      {/* Projects / Tenders */}

      <Route
        path="/tenders"
        element={
          <AdminManagerLayout
            activePage="Tenders"
            user={user}
          >
            <TendersPage
              tenders={tenders}
              addTender={addTender}
              removeTender={
                removeTender
              }
              fetchTenders={
                fetchTenders
              }
            />
          </AdminManagerLayout>
        }
      />

      {/* Optional cleaner project URL */}

      <Route
        path="/projects"
        element={
          <Navigate
            to="/tenders"
            replace
          />
        }
      />

      {/* Tender Details contains all project tabs:
          Overview
          Sites
          Finance
          Workers
          Materials
          Subcontractors
          Documents
          Invoices
          Daily Updates
      */}

      <Route
        path="/tenders/:id"
        element={
          <AdminManagerLayout
            activePage="Project Details"
            user={user}
          >
            <TenderDetailsPage />
          </AdminManagerLayout>
        }
      />

      {/* Optional cleaner project details URL */}

      <Route
        path="/projects/:id"
        element={
          <AdminManagerLayout
            activePage="Project Details"
            user={user}
          >
            <TenderDetailsPage />
          </AdminManagerLayout>
        }
      />

      {/*
       * Old site page compatibility.
       *
       * Sites are no longer independently created.
       * Site management now happens inside TenderDetailsPage.
       */}

      <Route
        path="/sites"
        element={
          <Navigate
            to="/tenders"
            replace
          />
        }
      />

      <Route
        path="/sites/:id"
        element={
          <Navigate
            to="/tenders"
            replace
          />
        }
      />

      {/* Finance */}

      <Route
        path="/payments"
        element={
          <AdminManagerLayout
            activePage="Finance"
            user={user}
          >
            <PaymentsPage
              payments={payments}
              tenders={tenders}
              addPayment={addPayment}
              deletePayment={deletePayment}
              fetchPayments={fetchPayments}
            />
          </AdminManagerLayout>
        }
      />

      {/* Workers */}

      <Route
        path="/workers"
        element={
          <AdminManagerLayout
            activePage="Workers"
            user={user}
          >
            <WorkersPage
              workers={workers}
              addWorker={addWorker}
              removeWorker={
                removeWorker
              }
              fetchWorkers={
                fetchWorkers
              }
            />
          </AdminManagerLayout>
        }
      />

      {/* Worker money */}

      <Route
        path="/worker-money"
        element={
          <AdminManagerLayout
            activePage="Worker Money"
            user={user}
          >
            <WorkerMoneyPage
              workers={workers}
              allocations={allocations}
              expenses={expenses}
              addAllocation={addAllocation}
              addExpense={addExpense}
              fetchAllocations={
                fetchAllocations
              }
              fetchExpenses={
                fetchExpenses
              }
              updateAllocation={
                updateAllocation
              }
              deleteAllocation={
                deleteAllocation
              }
              updateExpense={
                updateExpense
              }
              deleteExpense={
                deleteExpense
              }
              approveExpense={
                approveExpense
              }
              approveAllocation={
                approveAllocation
              }
              rejectAllocation={
                rejectAllocation
              }
              rejectExpense={
                rejectExpense
              }
            />
          </AdminManagerLayout>
        }
      />

      {/* Invoices */}

      <Route
        path="/invoices"
        element={
          <AdminManagerLayout
            activePage="Invoices"
            user={user}
          >
            <InvoicesPage
              invoices={invoices}
              addInvoice={addInvoice}
              removeInvoice={
                removeInvoice
              }
              fetchInvoices={
                fetchInvoices
              }
            />
          </AdminManagerLayout>
        }
      />

      {/* Daily site updates remain site-specific */}

      <Route
        path="/daily-site-updates"
        element={
          <AdminManagerLayout
            activePage="Daily Site Updates"
            user={user}
          >
            <DailySiteUpdatesPage
              sites={sites}
              tenders={tenders}
              workers={workers}
              siteLogs={siteLogs}
              addSiteLog={addSiteLog}
              deleteSiteLog={
                deleteSiteLog
              }
            />
          </AdminManagerLayout>
        }
      />

      {/* Daily update approvals */}

      <Route
        path="/daily-update-approvals"
        element={
          <AdminLayout
            activePage="Update Approvals"
            user={user}
          >
            <DailyUpdateApprovalsPage />
          </AdminLayout>
        }
      />

      {/* Site operations — material, labour, banking, access requests */}

      <Route
        path="/site-operations"
        element={
          <SiteWorkLayout
            activePage="Site Operations"
            user={user}
          >
            <SiteOperationsPage />
          </SiteWorkLayout>
        }
      />

      {/* Subcontractors */}

      <Route
        path="/subcontractors"
        element={
          <AdminManagerLayout
            activePage="Subcontractors"
            user={user}
          >
            <SubcontractorsPage />
          </AdminManagerLayout>
        }
      />

      {/* Users */}

      <Route
        path="/users"
        element={
          <AdminLayout
            activePage="Users"
            user={user}
          >
            <UsersPage />
          </AdminLayout>
        }
      />

      {/* Master data — investors, suppliers, clients */}

      <Route
        path="/masters"
        element={
          <AdminManagerLayout
            activePage="Master Data"
            user={user}
          >
            <MastersPage />
          </AdminManagerLayout>
        }
      />

      {/* Audit trail — office only, same as the API */}

      <Route
        path="/activity"
        element={
          <AdminManagerLayout
            activePage="Activity Log"
            user={user}
          >
            <ActivityPage />
          </AdminManagerLayout>
        }
      />

      {/* Reports */}

      <Route
        path="/reports"
        element={
          <AdminManagerLayout
            activePage="Reports"
            user={user}
          >
            <ReportsPage
              payments={payments}
              workers={workers}
              sites={sites}
              tenders={tenders}
              invoices={invoices}
              siteLogs={siteLogs}
              allocations={allocations}
              expenses={expenses}
            />
          </AdminManagerLayout>
        }
      />

      {/* Settings */}

      <Route
        path="/settings"
        element={
          <AdminManagerLayout
            activePage="Settings"
            user={user}
          >
            <SettingsPage />
          </AdminManagerLayout>
        }
      />

      {/* Root */}

      <Route
        path="/"
        element={
          user ? (
            <Navigate
              to={homePath}
              replace
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      {/* Unknown routes */}

      <Route
        path="*"
        element={
          user ? (
            <Navigate
              to={homePath}
              replace
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />
    </Routes>
    </Suspense>
  );
}

export default AppRoutes;