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


function AppRoutes(props) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" />} />

      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <DashboardPage payments={props.payments} workers={props.workers} />
          </AppLayout>
        }
      />

      <Route
        path="/payments"
        element={
          <AppLayout>
            <PaymentsPage
              payments={props.payments}
              addPayment={props.addPayment}
              deletePayment={props.deletePayment}
            />
          </AppLayout>
        }
      />

      <Route
        path="/workers"
        element={
          <AppLayout>
            <WorkersPage
              workers={props.workers}
              addWorker={props.addWorker}
              deleteWorker={props.deleteWorker}
            />
          </AppLayout>
        }
      />

      <Route
        path="/subcontractors"
        element={
          <AppLayout>
            <SubcontractorsPage />
          </AppLayout>
        }
      />

      <Route
        path="/subcontractors"
        element={
          <AppLayout>
            <SubcontractorsPage />
          </AppLayout>
        }
      />

      <Route
        path="/worker-money"
        element={
          <AppLayout>
            <WorkerMoneyPage
              workers={props.workers}
              allocations={props.allocations}
              expenses={props.expenses}
              addAllocation={props.addAllocation}
              addExpense={props.addExpense}
            />
          </AppLayout>
        }
      />

      <Route
        path="/sites"
        element={
          <AppLayout>
            <SitesPage
              sites={props.sites}
              addSite={props.addSite}
              deleteSite={props.deleteSite}
            />
          </AppLayout>
        }
      />

      <Route
        path="/tenders"
        element={
          <AppLayout>
            <TendersPage
              tenders={props.tenders}
              addTender={props.addTender}
              deleteTender={props.deleteTender}
            />
          </AppLayout>
        }
      />

      <Route
        path="/tenders/:id"
        element={
          <AppLayout>
            <TenderDetailsPage />
          </AppLayout>
        }
      />

      <Route
        path="/invoices"
        element={
          <AppLayout>
            <InvoicesPage
              invoices={props.invoices}
              addInvoice={props.addInvoice}
              deleteInvoice={props.deleteInvoice}
            />
          </AppLayout>
        }
      />

      <Route
        path="/daily-site-updates"
        element={
          <AppLayout>
            <DailySiteUpdatesPage
              sites={props.sites}
              workers={props.workers}
              siteLogs={props.siteLogs}
              addSiteLog={props.addSiteLog}
            />
          </AppLayout>
        }
      />

      <Route
        path="/reports"
        element={
          <AppLayout>
            <ReportsPage
              payments={props.payments}
              workers={props.workers}
              sites={props.sites}
              tenders={props.tenders}
              invoices={props.invoices}
            />
          </AppLayout>
        }
      />

      <Route
        path="/settings"
        element={
          <AppLayout>
            <SettingsPage />
          </AppLayout>
        }
      />
    </Routes>

    
  );
}

export default AppRoutes;