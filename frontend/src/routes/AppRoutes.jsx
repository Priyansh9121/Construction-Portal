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
import SiteDetailsPage from "../pages/SiteDetailsPage";

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
}

function AppRoutes(props) {
  return (
    <Routes>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/login"
        element={
          props.user ? (
            <Navigate to="/dashboard" />
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
        element={<Navigate to={props.user ? "/dashboard" : "/login"} />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <DashboardPage
                payments={props.payments}
                workers={props.workers}
                sites={props.sites}
                tenders={props.tenders}
                invoices={props.invoices}
                subcontractors={[]}
              />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/payments"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <PaymentsPage
                payments={props.payments}
                addPayment={props.addPayment}
                deletePayment={props.deletePayment}
              />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/workers"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <WorkersPage
                workers={props.workers}
                addWorker={props.addWorker}
                deleteWorker={props.deleteWorker}
              />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/subcontractors"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <SubcontractorsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/worker-money"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <WorkerMoneyPage
                workers={props.workers}
                allocations={props.allocations}
                expenses={props.expenses}
                addAllocation={props.addAllocation}
                addExpense={props.addExpense}
              />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/sites"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <SitesPage
                sites={props.sites}
                addSite={props.addSite}
                deleteSite={props.deleteSite}
              />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/sites/:id"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <SiteDetailsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tenders"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <TendersPage
                tenders={props.tenders}
                sites={props.sites}
                addTender={props.addTender}
                deleteTender={props.deleteTender}
              />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tenders/:id"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <TenderDetailsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/invoices"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <InvoicesPage
                invoices={props.invoices}
                addInvoice={props.addInvoice}
                deleteInvoice={props.deleteInvoice}
              />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/daily-site-updates"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <DailySiteUpdatesPage
                sites={props.sites}
                workers={props.workers}
                siteLogs={props.siteLogs}
                addSiteLog={props.addSiteLog}
              />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <ReportsPage
                payments={props.payments}
                workers={props.workers}
                sites={props.sites}
                tenders={props.tenders}
                invoices={props.invoices}
              />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute user={props.user}>
            {props.user?.role === "admin" ? (
              <AppLayout user={props.user}>
                <UsersPage />
              </AppLayout>
            ) : (
              <Navigate to="/dashboard" />
            )}
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute user={props.user}>
            <AppLayout user={props.user}>
              <SettingsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default AppRoutes;