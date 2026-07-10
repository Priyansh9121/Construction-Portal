import { useState } from "react";
import FinanceSummaryCards from "../finance/FinanceSummaryCards";
import FinanceRecordsTable from "../finance/FinanceRecordsTable";
import { usePaymentManager } from "../../hooks/usePaymentManager";
import DocumentExportButtons from "../export/DocumentExportButtons";
import { formatCurrency } from "../../utils/currency";
import {
  exportLedgerExcel,
  exportLedgerPDF,
} from "../../utils/ledgerExportHelpers";

function TenderFinanceTab({
  payments = [],
  tenderId,
  tender,
  subcontractors = [],
  startEditPayment,
  setDeleteTarget,
}) {
  const [ledgerExportOpen, setLedgerExportOpen] = useState(false);
  const [billType, setBillType] = useState("government-bill");

  const { filteredPayments, summary } = usePaymentManager({
    payments,
    tenderId,
  });

  const tenderTitle =
    tender?.title ||
    tender?.tender_name ||
    `Tender ${tenderId || tender?.id || ""}`;

  const [subletForm, setSubletForm] = useState({
    subcontractorName: subcontractors?.[0]?.full_name || "",
    originalWorkAmount: tender?.estimated_value || "",
    subletTaxableValue: Number(tender?.estimated_value || 0) * 0.92,
    agencyPercent: 0.03,
    extTimeLimit: 0,
    withheld: 0,
    subletWithheld: 0,
    costOfBillFine: 0,
    gstHold18: 0,
    loanAmount: 0,
  });

  const [govtForm, setGovtForm] = useState({
    departmentName: "Government Department",
    taxableAmount: tender?.estimated_value || "",
    withheld: 0,
  });

  const money = formatCurrency;

  const updateSublet = (field, value) => {
    setSubletForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateGovt = (field, value) => {
    setGovtForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const exportLedgerAsPDF = () => {
    exportLedgerPDF({
      filename: `tender-ledger-${tenderId}`,
      title: `${tenderTitle} Ledger`,
      records: filteredPayments,
    });

    setLedgerExportOpen(false);
  };

  const exportLedgerAsExcel = () => {
    exportLedgerExcel({
      filename: `tender-ledger-${tenderId}`,
      title: `${tenderTitle} Ledger`,
      records: filteredPayments,
    });

    setLedgerExportOpen(false);
  };

  const subletBillData = {
    packageNo: tenderTitle,
    billDate: new Date().toISOString().slice(0, 10),
    siteName: tender?.site_name || "",
    ...subletForm,
  };

  const governmentBillData = {
    tenderName: tenderTitle,
    billDate: new Date().toISOString().slice(0, 10),
    siteName: tender?.site_name || "",
    ...govtForm,
  };

  const selectedBillData =
    billType === "government-bill" ? governmentBillData : subletBillData;

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Tender Finance Export Centre</h2>
            <p className="muted-text">
              Generate tender ledger, government bill and sublet bill reports.
            </p>
          </div>

          <div className="report-actions">
            <div className="export-menu">
              <button
                type="button"
                className="export-menu-button"
                onClick={() => setLedgerExportOpen((current) => !current)}
              >
                Export Ledger ▾
              </button>

              {ledgerExportOpen && (
                <div className="export-menu-dropdown">
                  <button type="button" onClick={exportLedgerAsPDF}>
                    📄 Ledger PDF
                  </button>

                  <button type="button" onClick={exportLedgerAsExcel}>
                    📊 Ledger Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <section className="summary-cards">
          <div className="card">
            <p>Finance Records</p>
            <h2>{filteredPayments.length}</h2>
          </div>

          <div className="card">
            <p>Total Income</p>
            <h2>{money(summary.totalIncome)}</h2>
          </div>

          <div className="card">
            <p>Total Expense</p>
            <h2>{money(summary.totalExpense)}</h2>
          </div>

          <div
            className={
              Number(summary.netProfit || 0) >= 0
                ? "card highlight-success"
                : "card highlight-danger"
            }
          >
            <p>Net Profit</p>
            <h2>{money(summary.netProfit)}</h2>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Construction Bill Export</h2>
            <p className="muted-text">
              Select bill type, edit values and export professional PDF/Excel.
            </p>
          </div>

          <DocumentExportButtons type={billType} data={selectedBillData} />
        </div>

        <div className="tabs">
          <button
            type="button"
            className={billType === "government-bill" ? "active-tab" : ""}
            onClick={() => setBillType("government-bill")}
          >
            Government Bill
          </button>

          <button
            type="button"
            className={billType === "sublet-bill" ? "active-tab" : ""}
            onClick={() => setBillType("sublet-bill")}
          >
            Sublet Bill
          </button>
        </div>

        {billType === "government-bill" ? (
          <div className="payment-form">
            <input
              placeholder="Department Name"
              value={govtForm.departmentName}
              onChange={(e) => updateGovt("departmentName", e.target.value)}
            />

            <input
              type="number"
              placeholder="Taxable Work Amount"
              value={govtForm.taxableAmount}
              onChange={(e) => updateGovt("taxableAmount", e.target.value)}
            />

            <input
              type="number"
              placeholder="Withheld Amount"
              value={govtForm.withheld}
              onChange={(e) => updateGovt("withheld", e.target.value)}
            />

            <p className="form-preview-total">
              GST 18% Preview: {money(Number(govtForm.taxableAmount || 0) * 0.18)}
            </p>
          </div>
        ) : (
          <div className="payment-form">
            <input
              placeholder="Subcontractor Name"
              value={subletForm.subcontractorName}
              onChange={(e) =>
                updateSublet("subcontractorName", e.target.value)
              }
            />

            <div className="form-grid">
              <input
                type="number"
                placeholder="Original Work Amount"
                value={subletForm.originalWorkAmount}
                onChange={(e) =>
                  updateSublet("originalWorkAmount", e.target.value)
                }
              />

              <input
                type="number"
                placeholder="Sublet Taxable Value"
                value={subletForm.subletTaxableValue}
                onChange={(e) =>
                  updateSublet("subletTaxableValue", e.target.value)
                }
              />

              <input
                type="number"
                step="0.01"
                placeholder="Agency % as decimal, example 0.03"
                value={subletForm.agencyPercent}
                onChange={(e) => updateSublet("agencyPercent", e.target.value)}
              />

              <input
                type="number"
                placeholder="Extension Time Limit"
                value={subletForm.extTimeLimit}
                onChange={(e) => updateSublet("extTimeLimit", e.target.value)}
              />
            </div>

            <div className="form-grid">
              <input
                type="number"
                placeholder="Department Withheld"
                value={subletForm.withheld}
                onChange={(e) => updateSublet("withheld", e.target.value)}
              />

              <input
                type="number"
                placeholder="Sublet Withheld"
                value={subletForm.subletWithheld}
                onChange={(e) => updateSublet("subletWithheld", e.target.value)}
              />

              <input
                type="number"
                placeholder="Cost of Bill Fine"
                value={subletForm.costOfBillFine}
                onChange={(e) => updateSublet("costOfBillFine", e.target.value)}
              />

              <input
                type="number"
                placeholder="GST Hold"
                value={subletForm.gstHold18}
                onChange={(e) => updateSublet("gstHold18", e.target.value)}
              />

              <input
                type="number"
                placeholder="Loan / Advance"
                value={subletForm.loanAmount}
                onChange={(e) => updateSublet("loanAmount", e.target.value)}
              />
            </div>

            <p className="form-preview-total">
              Sublet GST 18% Preview:{" "}
              {money(Number(subletForm.subletTaxableValue || 0) * 0.18)}
            </p>
          </div>
        )}
      </section>

      <FinanceSummaryCards summary={summary} />

      <FinanceRecordsTable
        title="Tender Finance Records"
        payments={filteredPayments}
        onEdit={startEditPayment}
        onDelete={(payment) =>
          setDeleteTarget({
            type: "payment",
            item: payment,
          })
        }
      />
    </>
  );
}

export default TenderFinanceTab;