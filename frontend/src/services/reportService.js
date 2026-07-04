import { downloadCSV } from "../utils/reportHelpers";

export const exportFinanceReport = (payments) => {
  downloadCSV("finance-report.csv", payments);
};

export const exportWorkersReport = (workers) => {
  downloadCSV("workers-report.csv", workers);
};

export const exportSitesReport = (sites) => {
  downloadCSV("sites-report.csv", sites);
};

export const exportTenderReport = (tenders) => {
  downloadCSV("tenders-report.csv", tenders);
};

export const exportInvoicesReport = (invoices) => {
  downloadCSV("invoices-report.csv", invoices);
};

export const exportDailyUpdatesReport = (updates) => {
  downloadCSV("daily-updates-report.csv", updates);
};

export const exportSubcontractorReport = (subcontractors) => {
  downloadCSV("subcontractors-report.csv", subcontractors);
};