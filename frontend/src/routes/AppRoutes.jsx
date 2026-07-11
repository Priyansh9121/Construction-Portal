import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppLayout from "../layouts/AppLayout";
import RoleRoute from "./RoleRoute";

import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";

import DashboardPage from "../pages/DashboardPage";
import PaymentsPage from "../pages/PaymentsPage";
import WorkersPage from "../pages/WorkersPage";
import WorkerMoneyPage from "../pages/WorkerMoneyPage";
import SitesPage from "../pages/SitesPage";
import SiteDetailsPage from "../pages/SiteDetailsPage";
import TendersPage from "../pages/TendersPage";
import TenderDetailsPage from "../pages/TenderDetailsPage";
import InvoicesPage from "../pages/InvoicesPage";
import DailySiteUpdatesPage from "../pages/DailySiteUpdatesPage";
import DailyUpdateApprovalsPage from "../pages/DailyUpdateApprovalsPage";
import SubcontractorsPage from "../pages/SubcontractorsPage";
import UsersPage from "../pages/UsersPage";
import ReportsPage from "../pages/ReportsPage";
import SettingsPage from "../pages/SettingsPage";

import WorkerPortalPage from "../pages/WorkerPortalPage";
import SubcontractorPortalPage from "../pages/SubcontractorPortalPage";

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
 * Shared protected layout for administrators and managers.
 */
function AdminManagerLayout({
  children,
  activePage,
  user,
  payments = [],
  tenders = [],
  invoices = [],
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
        payments={payments}
        tenders={tenders}
        invoices={invoices}
      >
        {children}
      </AppLayout>
    </RoleRoute>
  );
}

/**
 * Shared protected layout for administrator-only pages.
 */
function AdminLayout({
  children,
  activePage,
  user,
  payments = [],
  tenders = [],
  invoices = [],
}) {
  return (
    <RoleRoute
      user={user}
      allowedRoles={["admin"]}
    >
      <AppLayout
        activePage={activePage}
        user={user}
        payments={payments}
        tenders={tenders}
        invoices={invoices}
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
   * Shared dashboard/report data
   */
  workers = [],
  sites = [],
  tenders = [],
  invoices = [],

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
}) {
  const homePath =
    getHomePath(user);

  return (
    <Routes>
      {/* Public authentication routes */}

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

      {/* Worker-only portal */}

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

      {/* Subcontractor-only portal */}

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
            payments={payments}
            tenders={tenders}
            invoices={invoices}
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

      {/* Finance */}

      <Route
        path="/payments"
        element={
          <AdminManagerLayout
            activePage="Finance"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <PaymentsPage
              payments={payments}
              tenders={tenders}
              addPayment={addPayment}
              deletePayment={
                deletePayment
              }
              fetchPayments={
                fetchPayments
              }
            />
          </AdminManagerLayout>
        }
      />

      {/* Workers - page owns useWorkers */}

      <Route
        path="/workers"
        element={
          <AdminManagerLayout
            activePage="Workers"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <WorkersPage />
          </AdminManagerLayout>
        }
      />

      {/* Worker money still uses shared App data */}

      <Route
        path="/worker-money"
        element={
          <AdminManagerLayout
            activePage="Worker Money"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <WorkerMoneyPage
              workers={workers}
              allocations={allocations}
              expenses={expenses}
              addAllocation={
                addAllocation
              }
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
              rejectExpense={
                rejectExpense
              }
            />
          </AdminManagerLayout>
        }
      />

      {/* Sites - page owns useSites */}

      <Route
        path="/sites"
        element={
          <AdminManagerLayout
            activePage="Sites"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SitesPage />
          </AdminManagerLayout>
        }
      />

      {/* Site details loads its own site and finance data */}

      <Route
        path="/sites/:id"
        element={
          <AdminManagerLayout
            activePage="Site Details"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SiteDetailsPage />
          </AdminManagerLayout>
        }
      />

      {/* Tenders - page owns useTenders and useSites */}

      <Route
        path="/tenders"
        element={
          <AdminManagerLayout
            activePage="Tenders"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <TendersPage />
          </AdminManagerLayout>
        }
      />

      {/* Tender details loads its own records */}

      <Route
        path="/tenders/:id"
        element={
          <AdminManagerLayout
            activePage="Tender Details"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <TenderDetailsPage />
          </AdminManagerLayout>
        }
      />

      {/* Invoices - page owns useInvoices */}

      <Route
        path="/invoices"
        element={
          <AdminManagerLayout
            activePage="Invoices"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <InvoicesPage />
          </AdminManagerLayout>
        }
      />

      {/* Daily site updates */}

      <Route
        path="/daily-site-updates"
        element={
          <AdminManagerLayout
            activePage="Daily Site Updates"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <DailySiteUpdatesPage
              sites={sites}
              tenders={tenders}
              workers={workers}
              siteLogs={siteLogs}
              addSiteLog={
                addSiteLog
              }
              deleteSiteLog={
                deleteSiteLog
              }
            />
          </AdminManagerLayout>
        }
      />

      {/* Daily approvals are admin-only */}

      <Route
        path="/daily-update-approvals"
        element={
          <AdminLayout
            activePage="Update Approvals"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <DailyUpdateApprovalsPage />
          </AdminLayout>
        }
      />

      {/* Subcontractors page loads its own records */}

      <Route
        path="/subcontractors"
        element={
          <AdminManagerLayout
            activePage="Subcontractors"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SubcontractorsPage />
          </AdminManagerLayout>
        }
      />

      {/* User management is admin-only */}

      <Route
        path="/users"
        element={
          <AdminLayout
            activePage="Users"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <UsersPage />
          </AdminLayout>
        }
      />

      {/* Reports */}

      <Route
        path="/reports"
        element={
          <AdminManagerLayout
            activePage="Reports"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
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
            payments={payments}
            tenders={tenders}
            invoices={invoices}
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
  );
}

export default AppRoutes;