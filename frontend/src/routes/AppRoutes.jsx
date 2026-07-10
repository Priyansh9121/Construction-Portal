import { Navigate, Route, Routes } from "react-router-dom";

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
import TendersPage from "../pages/TendersPage";
import TenderDetailsPage from "../pages/TenderDetailsPage";
import SiteDetailsPage from "../pages/SiteDetailsPage";
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

function AdminManagerLayout({
  children,
  activePage,
  user,
  logout,
  payments,
  tenders,
  invoices,
}) {
  return (
    <RoleRoute
      user={user}
      allowedRoles={["admin", "manager"]}
    >
      <AppLayout
        activePage={activePage}
        user={user}
        logout={logout}
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
  user,
  logout,
  email,
  setEmail,
  password,
  setPassword,
  message,
  handleLogin,

  payments = [],
  addPayment,
  deletePayment,
  fetchPayments,

  workers = [],
  addWorker,
  deleteWorker,
  fetchWorkers,

  sites = [],
  addSite,
  deleteSite,
  fetchSites,

  tenders = [],
  addTender,
  deleteTender,
  fetchTenders,

  invoices = [],
  addInvoice,
  deleteInvoice,
  fetchInvoices,

  siteLogs = [],
  addSiteLog,
  deleteSiteLog,

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

  subcontractors = [],
}) {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={getHomePath(user)} replace />
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

      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />

      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />

      {/* Worker-only portal: no AppLayout, no admin sidebar */}
      <Route
        path="/worker-portal"
        element={
          <RoleRoute
            user={user}
            allowedRoles={["worker"]}
          >
            <WorkerPortalPage logout={logout} />
          </RoleRoute>
        }
      />

      {/* Subcontractor-only portal: no AppLayout, no admin sidebar */}
      <Route
        path="/subcontractor-portal"
        element={
          <RoleRoute
            user={user}
            allowedRoles={["subcontractor"]}
          >
            <SubcontractorPortalPage logout={logout} />
          </RoleRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <AdminManagerLayout
            activePage="Dashboard"
            user={user}
            logout={logout}
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
              subcontractors={subcontractors}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/payments"
        element={
          <AdminManagerLayout
            activePage="Finance"
            user={user}
            logout={logout}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <PaymentsPage
              payments={payments}
              addPayment={addPayment}
              deletePayment={deletePayment}
              fetchPayments={fetchPayments}
              tenders={tenders}
              sites={sites}
              workers={workers}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/workers"
        element={
          <AdminManagerLayout
            activePage="Workers"
            user={user}
            logout={logout}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <WorkersPage
              workers={workers}
              addWorker={addWorker}
              deleteWorker={deleteWorker}
              fetchWorkers={fetchWorkers}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/worker-money"
        element={
          <AdminManagerLayout
            activePage="Worker Money"
            user={user}
            logout={logout}
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
              fetchAllocations={fetchAllocations}
              fetchExpenses={fetchExpenses}
              updateAllocation={updateAllocation}
              deleteAllocation={deleteAllocation}
              updateExpense={updateExpense}
              deleteExpense={deleteExpense}
              approveExpense={approveExpense}
              rejectExpense={rejectExpense}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/sites"
        element={
          <AdminManagerLayout
            activePage="Sites"
            user={user}
            logout={logout}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SitesPage
              sites={sites}
              addSite={addSite}
              deleteSite={deleteSite}
              fetchSites={fetchSites}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/sites/:id"
        element={
          <AdminManagerLayout
            activePage="Site Details"
            user={user}
            logout={logout}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SiteDetailsPage
              sites={sites}
              tenders={tenders}
              payments={payments}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/tenders"
        element={
          <AdminManagerLayout
            activePage="Tenders"
            user={user}
            logout={logout}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <TendersPage
              tenders={tenders}
              sites={sites}
              addTender={addTender}
              deleteTender={deleteTender}
              fetchTenders={fetchTenders}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/tenders/:id"
        element={
          <AdminManagerLayout
            activePage="Tender Details"
            user={user}
            logout={logout}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <TenderDetailsPage
              payments={payments}
              tenders={tenders}
              sites={sites}
              workers={workers}
              subcontractors={subcontractors}
              fetchPayments={fetchPayments}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/invoices"
        element={
          <AdminManagerLayout
            activePage="Invoices"
            user={user}
            logout={logout}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <InvoicesPage
              invoices={invoices}
              addInvoice={addInvoice}
              deleteInvoice={deleteInvoice}
              fetchInvoices={fetchInvoices}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/daily-site-updates"
        element={
          <AdminManagerLayout
            activePage="Daily Site Updates"
            user={user}
            logout={logout}
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
              deleteSiteLog={deleteSiteLog}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/daily-update-approvals"
        element={
          <AdminManagerLayout
            activePage="Update Approvals"
            user={user}
            logout={logout}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <DailyUpdateApprovalsPage />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/subcontractors"
        element={
          <AdminManagerLayout
            activePage="Subcontractors"
            user={user}
            logout={logout}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SubcontractorsPage />
          </AdminManagerLayout>
        }
      />

      {/* Admin only */}
      <Route
        path="/users"
        element={
          <RoleRoute
            user={user}
            allowedRoles={["admin"]}
          >
            <AppLayout
              activePage="Users"
              user={user}
              logout={logout}
              payments={payments}
              tenders={tenders}
              invoices={invoices}
            >
              <UsersPage />
            </AppLayout>
          </RoleRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <AdminManagerLayout
            activePage="Reports"
            user={user}
            logout={logout}
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
              subcontractors={subcontractors}
              siteLogs={siteLogs}
              allocations={allocations}
              expenses={expenses}
            />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/settings"
        element={
          <AdminManagerLayout
            activePage="Settings"
            user={user}
            logout={logout}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SettingsPage user={user} logout={logout} />
          </AdminManagerLayout>
        }
      />

      <Route
        path="/"
        element={
          user ? (
            <Navigate to={getHomePath(user)} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="*"
        element={
          user ? (
            <Navigate to={getHomePath(user)} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default AppRoutes;