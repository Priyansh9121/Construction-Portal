import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "../layouts/AppLayout";

import DashboardPage from "../pages/DashboardPage";
import PaymentsPage from "../pages/PaymentsPage";
import WorkersPage from "../pages/WorkersPage";
import WorkerMoneyPage from "../pages/WorkerMoneyPage";
import SitesPage from "../pages/SitesPage";
import TendersPage from "../pages/TendersPage";
import InvoicesPage from "../pages/InvoicesPage";
import DailySiteUpdatesPage from "../pages/DailySiteUpdatesPage";
import ReportsPage from "../pages/ReportsPage";
import SettingsPage from "../pages/SettingsPage";
import TenderDetailsPage from "../pages/TenderDetailsPage";
import SubcontractorsPage from "../pages/SubcontractorsPage";
import UsersPage from "../pages/UsersPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import SiteDetailsPage from "../pages/SiteDetailsPage";
import WorkerPortalPage from "../pages/WorkerPortalPage";
import SubcontractorPortalPage from "../pages/SubcontractorPortalPage";
import DailyUpdateApprovalsPage from "../pages/DailyUpdateApprovalsPage";

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" />;
  return children;
}

function RoleRoute({ user, allowedRoles, children }) {
  if (!user) return <Navigate to="/login" />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

function Layout({ props, children }) {
  return (
    <AppLayout
      user={props.user}
      payments={props.payments}
      tenders={props.tenders}
      invoices={props.invoices}
    >
      {children}
    </AppLayout>
  );
}

function AppRoutes(props) {
  const defaultRedirect =
    props.user?.role === "worker"
      ? "/worker-portal"
      : props.user?.role === "subcontractor"
      ? "/subcontractor-portal"
      : "/dashboard";

  return (
    <Routes>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/register"
        element={props.user ? <Navigate to={defaultRedirect} /> : <RegisterPage />}
      />

      <Route
        path="/login"
        element={
          props.user ? (
            <Navigate to={defaultRedirect} />
          ) : (
            <LoginPage
              email={props.email}
              setEmail={props.setEmail}
              password={props.password}
              setPassword={props.setPassword}
              message={props.message}
              handleLogin={props.handleLogin}
            />
          )
        }
      />

      <Route
        path="/"
        element={props.user ? <Navigate to={defaultRedirect} /> : <Navigate to="/login" />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <DashboardPage
                payments={props.payments}
                workers={props.workers}
                sites={props.sites}
                tenders={props.tenders}
                invoices={props.invoices}
                subcontractors={props.subcontractors || []}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/payments"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <PaymentsPage
                payments={props.payments}
                addPayment={props.addPayment}
                deletePayment={props.deletePayment}
                fetchPayments={props.fetchPayments}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/workers"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <WorkersPage
                workers={props.workers}
                addWorker={props.addWorker}
                deleteWorker={props.deleteWorker}
                fetchWorkers={props.fetchWorkers}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/worker-money"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <WorkerMoneyPage
                workers={props.workers}
                allocations={props.allocations}
                expenses={props.expenses}
                addAllocation={props.addAllocation}
                addExpense={props.addExpense}
                fetchAllocations={props.fetchAllocations}
                fetchExpenses={props.fetchExpenses}
                updateAllocation={props.updateAllocation}
                deleteAllocation={props.deleteAllocation}
                updateExpense={props.updateExpense}
                deleteExpense={props.deleteExpense}
                approveExpense={props.approveExpense}
                rejectExpense={props.rejectExpense}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/subcontractors"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <SubcontractorsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/sites"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <SitesPage
                sites={props.sites}
                addSite={props.addSite}
                deleteSite={props.deleteSite}
                fetchSites={props.fetchSites}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/sites/:id"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <SiteDetailsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tenders"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <TendersPage
                tenders={props.tenders}
                sites={props.sites}
                addTender={props.addTender}
                deleteTender={props.deleteTender}
                fetchTenders={props.fetchTenders}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tenders/:id"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <TenderDetailsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/invoices"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <InvoicesPage
                invoices={props.invoices}
                addInvoice={props.addInvoice}
                deleteInvoice={props.deleteInvoice}
                fetchInvoices={props.fetchInvoices}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/daily-site-updates"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <DailySiteUpdatesPage
                sites={props.sites}
                tenders={props.tenders}
                workers={props.workers}
                siteLogs={props.siteLogs}
                addSiteLog={props.addSiteLog}
                deleteSiteLog={props.deleteSiteLog}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/daily-update-approvals"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <DailyUpdateApprovalsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <ReportsPage
                payments={props.payments}
                workers={props.workers}
                sites={props.sites}
                tenders={props.tenders}
                invoices={props.invoices}
              />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute user={props.user}>
            {props.user?.role === "admin" ? (
              <Layout props={props}>
                <UsersPage />
              </Layout>
            ) : (
              <Navigate to="/dashboard" />
            )}
          </ProtectedRoute>
        }
      />

      <Route
        path="/worker-portal"
        element={
          <RoleRoute user={props.user} allowedRoles={["admin", "worker"]}>
            <WorkerPortalPage logout={props.logout} />
          </RoleRoute>
        }
      />

      <Route
        path="/subcontractor-portal"
        element={
          <RoleRoute user={props.user} allowedRoles={["admin", "subcontractor"]}>
            <SubcontractorPortalPage logout={props.logout} />
          </RoleRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute user={props.user}>
            <Layout props={props}>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default AppRoutes;