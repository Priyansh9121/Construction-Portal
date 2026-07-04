import { useMemo, useState } from "react";

import FinanceSummaryCards from "../components/finance/FinanceSummaryCards";
import FinanceRecordsTable from "../components/finance/FinanceRecordsTable";
import { usePaymentManager } from "../hooks/usePaymentManager";

import {
  exportFinanceReport,
  exportWorkersReport,
  exportSitesReport,
  exportTenderReport,
  exportInvoicesReport,
  exportDailyUpdatesReport,
  exportSubcontractorReport,
} from "../services/reportService";

function ReportsPage({
  payments = [],
  workers = [],
  sites = [],
  tenders = [],
  invoices = [],
}) {
  const [reportType, setReportType] = useState("Overview");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const money = (value) => `$${Number(value || 0).toFixed(2)}`;

  const inDateRange = (dateValue) => {
    if (!dateValue) return true;

    const date = new Date(dateValue);

    if (fromDate && date < new Date(fromDate)) return false;
    if (toDate && date > new Date(toDate)) return false;

    return true;
  };

  const dateFilteredPayments = useMemo(() => {
    return payments.filter((payment) =>
      inDateRange(payment.payment_date || payment.created_at)
    );
  }, [payments, fromDate, toDate]);

  const { filteredPayments, summary } = usePaymentManager({
    payments: dateFilteredPayments,
  });

  const gstPayments = filteredPayments.filter((p) =>
    ["GOVERNMENT_BILL", "GST_RETURN"].includes(p.payment_sub_type)
  );

  const companyChargePayments = filteredPayments.filter((p) =>
    ["COMPANY_CHARGE", "COMPANY_CHARGE_PAYMENT"].includes(p.payment_sub_type)
  );

  const investorPayments = filteredPayments.filter(
    (p) => p.payment_sub_type === "INVESTOR"
  );

  const labourPayments = filteredPayments.filter(
    (p) => p.payment_sub_type === "LABOUR"
  );

  const tenderProfitRows = tenders.map((tender) => {
    const tenderPayments = filteredPayments.filter(
      (p) => String(p.tender_id) === String(tender.id)
    );

    const income = tenderPayments
      .filter((p) => p.payment_type === "Income")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const expense = tenderPayments
      .filter((p) => p.payment_type === "Expense")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      id: tender.id,
      name: tender.title,
      income,
      expense,
      profit: income - expense,
    };
  });

  const siteProfitRows = sites.map((site) => {
    const sitePayments = filteredPayments.filter(
      (p) => String(p.site_id) === String(site.id)
    );

    const income = sitePayments
      .filter((p) => p.payment_type === "Income")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const expense = sitePayments
      .filter((p) => p.payment_type === "Expense")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      id: site.id,
      name: site.site_name,
      income,
      expense,
      profit: income - expense,
    };
  });

  const exportCSV = () => {
    const rows = [
      ["Report", reportType],
      ["From", fromDate || "All"],
      ["To", toDate || "All"],
      [],
      ["Metric", "Amount"],
      ["Total Income", summary.totalIncome],
      ["Total Expense", summary.totalExpense],
      ["Net Profit", summary.netProfit],
      ["GST Total", summary.gstTotal],
      ["GST Returned", summary.gstReturned],
      ["GST Pending", summary.gstLeft],
      ["Company Charge Total", summary.companyChargeTotal],
      ["Company Charge Paid", summary.companyChargePaid],
      ["Company Charge Pending", summary.companyChargeLeft],
    ];

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportType.toLowerCase().replaceAll(" ", "-")}-report.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Reports are generated from Payments as the single source.</p>
        </div>

        <div className="report-actions">
          <button className="primary-btn" type="button" onClick={exportCSV}>
            Export Current Report
          </button>

          <button type="button" onClick={() => exportFinanceReport(filteredPayments)}>
            Export Finance
          </button>

          <button type="button" onClick={() => exportWorkersReport(workers)}>
            Export Workers
          </button>

          <button type="button" onClick={() => exportSitesReport(sites)}>
            Export Sites
          </button>

          <button type="button" onClick={() => exportTenderReport(tenders)}>
            Export Tenders
          </button>

          <button type="button" onClick={() => exportInvoicesReport(invoices)}>
            Export Invoices
          </button>
        </div>
      </div>

      <section className="panel">
        <h2>Report Filters</h2>

        <div className="form-grid">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="Overview">Overview</option>
            <option value="GST">GST</option>
            <option value="Company Charge">Company Charge</option>
            <option value="Investor">Investor</option>
            <option value="Tender Profit">Tender Profit</option>
            <option value="Site Profit">Site Profit</option>
            <option value="Labour">Labour</option>
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </section>

      {reportType === "Overview" && (
        <>
          <FinanceSummaryCards summary={summary} />

          <FinanceRecordsTable
            title="All Finance Records"
            payments={filteredPayments}
          />
        </>
      )}

      {reportType === "GST" && (
        <>
          <FinanceSummaryCards summary={summary} />

          <FinanceRecordsTable
            title="GST Report"
            payments={gstPayments}
          />
        </>
      )}

      {reportType === "Company Charge" && (
        <>
          <FinanceSummaryCards summary={summary} />

          <FinanceRecordsTable
            title="Company Charge Report"
            payments={companyChargePayments}
          />
        </>
      )}

      {reportType === "Investor" && (
        <>
          <section className="cards">
            <div className="card">
              <p>Total Investor Amount</p>
              <h2>
                {money(
                  investorPayments.reduce(
                    (sum, p) => sum + Number(p.amount || 0),
                    0
                  )
                )}
              </h2>
            </div>

            <div className="card">
              <p>Investor Records</p>
              <h2>{investorPayments.length}</h2>
            </div>
          </section>

          <FinanceRecordsTable
            title="Investor Report"
            payments={investorPayments}
          />
        </>
      )}

      {reportType === "Labour" && (
        <>
          <section className="cards">
            <div className="card">
              <p>Total Labour Cost</p>
              <h2>
                {money(
                  labourPayments.reduce(
                    (sum, p) => sum + Number(p.amount || 0),
                    0
                  )
                )}
              </h2>
            </div>

            <div className="card">
              <p>Labour Records</p>
              <h2>{labourPayments.length}</h2>
            </div>
          </section>

          <FinanceRecordsTable
            title="Labour Report"
            payments={labourPayments}
          />
        </>
      )}

      {reportType === "Tender Profit" && (
        <section className="panel">
          <h2>Tender Profit Report</h2>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Tender</th>
                  <th>Income</th>
                  <th>Expense</th>
                  <th>Profit</th>
                </tr>
              </thead>

              <tbody>
                {tenderProfitRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{money(row.income)}</td>
                    <td>{money(row.expense)}</td>
                    <td>{money(row.profit)}</td>
                  </tr>
                ))}

                {tenderProfitRows.length === 0 && (
                  <tr>
                    <td colSpan="4">No tender data found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {reportType === "Site Profit" && (
        <section className="panel">
          <h2>Site Profit Report</h2>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Income</th>
                  <th>Expense</th>
                  <th>Profit</th>
                </tr>
              </thead>

              <tbody>
                {siteProfitRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{money(row.income)}</td>
                    <td>{money(row.expense)}</td>
                    <td>{money(row.profit)}</td>
                  </tr>
                ))}

                {siteProfitRows.length === 0 && (
                  <tr>
                    <td colSpan="4">No site data found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="payment-grid">
        <div className="panel">
          <h2>Work Summary</h2>

          <table>
            <tbody>
              <tr>
                <td>Total Workers</td>
                <td className="number-cell">{workers.length}</td>
              </tr>
              <tr>
                <td>Total Sites</td>
                <td className="number-cell">{sites.length}</td>
              </tr>
              <tr>
                <td>Total Tenders</td>
                <td className="number-cell">{tenders.length}</td>
              </tr>
              <tr>
                <td>Total Invoices</td>
                <td className="number-cell">{invoices.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default ReportsPage;