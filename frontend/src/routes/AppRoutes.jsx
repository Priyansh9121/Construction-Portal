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
import SiteOperationsPage from "../pages/SiteOperationsPage";

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
 * Protected layout for administrators only.
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
   * Shared dashboard and reporting data
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
  const homePath = getHomePath(user);

  return (
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

      {/* Projects / Tenders */}

      <Route
        path="/tenders"
        element={
          <AdminManagerLayout
            activePage="Projects"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <TendersPage />
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
            payments={payments}
            tenders={tenders}
            invoices={invoices}
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
            payments={payments}
            tenders={tenders}
            invoices={invoices}
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
            payments={payments}
            tenders={tenders}
            invoices={invoices}
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
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <WorkersPage />
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
            payments={payments}
            tenders={tenders}
            invoices={invoices}
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
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <InvoicesPage />
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
            payments={payments}
            tenders={tenders}
            invoices={invoices}
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
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <DailyUpdateApprovalsPage />
          </AdminLayout>
        }
      />

      {/* Site operations — material, labour, banking, access requests */}

      <Route
        path="/site-operations"
        element={
          <AdminManagerLayout
            activePage="Site Operations"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SiteOperationsPage />
          </AdminManagerLayout>
        }
      />

      {/* Subcontractors */}

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

      {/* Users */}

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