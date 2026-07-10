import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "../layouts/AppLayout";

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

function ProtectedLayout({
  children,
  activePage,
  user,
  payments,
  tenders,
  invoices,
}) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout
      activePage={activePage}
      user={user}
      payments={payments}
      tenders={tenders}
      invoices={invoices}
    >
      {children}
    </AppLayout>
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
            <Navigate to="/dashboard" replace />
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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/worker-portal"
        element={
          <ProtectedLayout
            activePage="Worker Portal"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <WorkerPortalPage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/subcontractor-portal"
        element={
          <ProtectedLayout
            activePage="Subcontractor Portal"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SubcontractorPortalPage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedLayout
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
              subcontractors={subcontractors}
            />
          </ProtectedLayout>
        }
      />

      <Route
        path="/payments"
        element={
          <ProtectedLayout
            activePage="Finance"
            user={user}
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
          </ProtectedLayout>
        }
      />

      <Route
        path="/workers"
        element={
          <ProtectedLayout
            activePage="Workers"
            user={user}
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
          </ProtectedLayout>
        }
      />

      <Route
        path="/worker-money"
        element={
          <ProtectedLayout
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
              fetchAllocations={fetchAllocations}
              fetchExpenses={fetchExpenses}
              updateAllocation={updateAllocation}
              deleteAllocation={deleteAllocation}
              updateExpense={updateExpense}
              deleteExpense={deleteExpense}
              approveExpense={approveExpense}
              rejectExpense={rejectExpense}
            />
          </ProtectedLayout>
        }
      />

      <Route
        path="/sites"
        element={
          <ProtectedLayout
            activePage="Sites"
            user={user}
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
          </ProtectedLayout>
        }
      />

      <Route
        path="/sites/:id"
        element={
          <ProtectedLayout
            activePage="Site Details"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SiteDetailsPage
              sites={sites}
              tenders={tenders}
              payments={payments}
            />
          </ProtectedLayout>
        }
      />

      <Route
        path="/tenders"
        element={
          <ProtectedLayout
            activePage="Tenders"
            user={user}
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
          </ProtectedLayout>
        }
      />

      <Route
        path="/tenders/:id"
        element={
          <ProtectedLayout
            activePage="Tender Details"
            user={user}
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
          </ProtectedLayout>
        }
      />

      <Route
        path="/invoices"
        element={
          <ProtectedLayout
            activePage="Invoices"
            user={user}
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
          </ProtectedLayout>
        }
      />

      <Route
        path="/daily-site-updates"
        element={
          <ProtectedLayout
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
              deleteSiteLog={deleteSiteLog}
            />
          </ProtectedLayout>
        }
      />

      <Route
        path="/daily-update-approvals"
        element={
          <ProtectedLayout
            activePage="Update Approvals"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <DailyUpdateApprovalsPage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/subcontractors"
        element={
          <ProtectedLayout
            activePage="Subcontractors"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SubcontractorsPage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedLayout
            activePage="Users"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <UsersPage />
          </ProtectedLayout>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedLayout
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
              subcontractors={subcontractors}
              siteLogs={siteLogs}
              allocations={allocations}
              expenses={expenses}
            />
          </ProtectedLayout>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedLayout
            activePage="Settings"
            user={user}
            payments={payments}
            tenders={tenders}
            invoices={invoices}
          >
            <SettingsPage user={user} logout={logout} />
          </ProtectedLayout>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default AppRoutes;