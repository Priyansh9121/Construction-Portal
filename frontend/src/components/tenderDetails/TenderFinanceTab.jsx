import {
  useMemo,
  useState,
} from "react";

import FinanceSummaryCards from "../finance/FinanceSummaryCards";
import FinanceRecordsTable from "../finance/FinanceRecordsTable";

import {
  usePaymentManager,
} from "../../hooks/usePaymentManager";

import DocumentExportButtons from "../export/DocumentExportButtons";

import {
  formatCurrency,
} from "../../utils/currency";

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
  const [
    ledgerExportOpen,
    setLedgerExportOpen,
  ] = useState(false);

  const [
    billType,
    setBillType,
  ] = useState(
    "government-bill"
  );

  const {
    filteredPayments,
    summary,
  } = usePaymentManager({
    payments,
    tenderId,
  });

  const money =
    formatCurrency;

  const tenderTitle =
    tender?.title ||
    tender?.tender_name ||
    `Tender ${
      tenderId ||
      tender?.id ||
      ""
    }`;

  const tenderSites =
    useMemo(() => {
      if (
        !Array.isArray(
          tender?.sites
        )
      ) {
        return [];
      }

      return tender.sites.filter(
        (site) =>
          site &&
          !site.is_deleted
      );
    }, [tender]);

  const siteNames =
    useMemo(
      () =>
        tenderSites
          .map(
            (site) =>
              site.site_name
          )
          .filter(Boolean),
      [tenderSites]
    );

  const siteAddresses =
    useMemo(
      () =>
        tenderSites
          .map(
            (site) =>
              site.address
          )
          .filter(Boolean),
      [tenderSites]
    );

  const projectSiteName =
    siteNames.length > 0
      ? siteNames.join(", ")
      : "Multiple Sites";

  const projectSiteAddress =
    siteAddresses.length > 0
      ? siteAddresses.join(" | ")
      : "";

  const [
    selectedSiteId,
    setSelectedSiteId,
  ] = useState("");

  const selectedSite =
    useMemo(() => {
      if (!selectedSiteId) {
        return null;
      }

      return (
        tenderSites.find(
          (site) =>
            Number(site.id) ===
            Number(selectedSiteId)
        ) || null
      );
    }, [
      selectedSiteId,
      tenderSites,
    ]);

  const exportSiteName =
    selectedSite?.site_name ||
    projectSiteName;

  const exportSiteAddress =
    selectedSite?.address ||
    projectSiteAddress;

  const defaultSubcontractorName =
    subcontractors?.[0]
      ?.full_name ||
    subcontractors?.[0]
      ?.subcontractor_name ||
    subcontractors?.[0]
      ?.business_name ||
    "";

  const [
    subletForm,
    setSubletForm,
  ] = useState({
    subcontractorName:
      defaultSubcontractorName,

    originalWorkAmount:
      tender?.estimated_value ||
      "",

    subletTaxableValue:
      Number(
        tender?.estimated_value ||
          0
      ) * 0.92,

    agencyPercent: 0.03,
    extTimeLimit: 0,
    withheld: 0,
    subletWithheld: 0,
    costOfBillFine: 0,
    gstHold18: 0,
    loanAmount: 0,
  });

  const [
    govtForm,
    setGovtForm,
  ] = useState({
    departmentName:
      "Government Department",

    taxableAmount:
      tender?.estimated_value ||
      "",

    withheld: 0,
  });

  const updateSublet = (
    field,
    value
  ) => {
    setSubletForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  };

  const updateGovt = (
    field,
    value
  ) => {
    setGovtForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  };

  const exportLedgerAsPDF =
    () => {
      exportLedgerPDF({
        filename:
          `tender-ledger-${tenderId}`,

        title:
          `${tenderTitle} Ledger`,

        records:
          filteredPayments,
      });

      setLedgerExportOpen(
        false
      );
    };

  const exportLedgerAsExcel =
    () => {
      exportLedgerExcel({
        filename:
          `tender-ledger-${tenderId}`,

        title:
          `${tenderTitle} Ledger`,

        records:
          filteredPayments,
      });

      setLedgerExportOpen(
        false
      );
    };

  const billDate =
    new Date()
      .toISOString()
      .slice(0, 10);

  const subletBillData = {
    packageNo:
      tenderTitle,

    tenderName:
      tenderTitle,

    billDate,

    siteName:
      exportSiteName,

    siteAddress:
      exportSiteAddress,

    siteCount:
      tenderSites.length,

    projectSites:
      tenderSites.map(
        (site) => ({
          id: site.id,
          siteName:
            site.site_name ||
            "",
          address:
            site.address ||
            "",
          siteType:
            site.site_type ||
            "",
          status:
            site.status ||
            "",
          progressPercent:
            Number(
              site.progress_percent ||
                0
            ),
        })
      ),

    ...subletForm,
  };

  const governmentBillData = {
    tenderName:
      tenderTitle,

    projectName:
      tenderTitle,

    billDate,

    siteName:
      exportSiteName,

    siteAddress:
      exportSiteAddress,

    siteCount:
      tenderSites.length,

    projectSites:
      tenderSites.map(
        (site) => ({
          id: site.id,
          siteName:
            site.site_name ||
            "",
          address:
            site.address ||
            "",
          siteType:
            site.site_type ||
            "",
          status:
            site.status ||
            "",
          progressPercent:
            Number(
              site.progress_percent ||
                0
            ),
        })
      ),

    ...govtForm,
  };

  const selectedBillData =
    billType ===
    "government-bill"
      ? governmentBillData
      : subletBillData;

  const governmentGstPreview =
    Number(
      govtForm.taxableAmount ||
        0
    ) * 0.18;

  const subletGstPreview =
    Number(
      subletForm.subletTaxableValue ||
        0
    ) * 0.18;

  const subletAgencyPreview =
    Number(
      subletForm.subletTaxableValue ||
        0
    ) *
    Number(
      subletForm.agencyPercent ||
        0
    );

  const subletNetPreview =
    Number(
      subletForm.subletTaxableValue ||
        0
    ) +
    subletGstPreview -
    Number(
      subletForm.withheld ||
        0
    ) -
    Number(
      subletForm.subletWithheld ||
        0
    ) -
    Number(
      subletForm.costOfBillFine ||
        0
    ) -
    Number(
      subletForm.gstHold18 ||
        0
    ) -
    Number(
      subletForm.loanAmount ||
        0
    ) -
    subletAgencyPreview;

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Tender Finance Export Centre
            </h2>

            <p className="muted-text">
              Generate tender ledger,
              government bill and sublet
              bill reports across all
              project sites.
            </p>
          </div>

          <div className="report-actions">
            <div className="export-menu">
              <button
                type="button"
                className="export-menu-button"
                onClick={() =>
                  setLedgerExportOpen(
                    (current) =>
                      !current
                  )
                }
              >
                Export Ledger ▾
              </button>

              {ledgerExportOpen && (
                <div className="export-menu-dropdown">
                  <button
                    type="button"
                    onClick={
                      exportLedgerAsPDF
                    }
                  >
                    📄 Ledger PDF
                  </button>

                  <button
                    type="button"
                    onClick={
                      exportLedgerAsExcel
                    }
                  >
                    📊 Ledger Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <section className="summary-cards">
          <div className="card">
            <p>
              Finance Records
            </p>

            <h2>
              {
                filteredPayments.length
              }
            </h2>
          </div>

          <div className="card">
            <p>Total Income</p>

            <h2>
              {money(
                summary.totalIncome
              )}
            </h2>
          </div>

          <div className="card">
            <p>Total Expense</p>

            <h2>
              {money(
                summary.totalExpense
              )}
            </h2>
          </div>

          <div
            className={
              Number(
                summary.netProfit ||
                  0
              ) >= 0
                ? "card highlight-success"
                : "card highlight-danger"
            }
          >
            <p>Net Profit</p>

            <h2>
              {money(
                summary.netProfit
              )}
            </h2>
          </div>

          <div className="card">
            <p>Project Sites</p>

            <h2>
              {tenderSites.length}
            </h2>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Construction Bill Export
            </h2>

            <p className="muted-text">
              Select the bill type,
              optionally choose one site,
              edit values and export a
              professional PDF or Excel
              file.
            </p>
          </div>

          <DocumentExportButtons
            type={billType}
            data={
              selectedBillData
            }
          />
        </div>

        <div className="payment-form">
          <label>
            Export Scope / Site

            <select
              value={
                selectedSiteId
              }
              onChange={(event) =>
                setSelectedSiteId(
                  event.target.value
                )
              }
            >
              <option value="">
                All Project Sites
              </option>

              {tenderSites.map(
                (site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.site_name ||
                      `Site ${site.id}`}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="form-preview-total">
            Export Site:{" "}
            {exportSiteName}

            {exportSiteAddress
              ? ` | ${exportSiteAddress}`
              : ""}
          </div>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={
              billType ===
              "government-bill"
                ? "active-tab"
                : ""
            }
            onClick={() =>
              setBillType(
                "government-bill"
              )
            }
          >
            Government Bill
          </button>

          <button
            type="button"
            className={
              billType ===
              "sublet-bill"
                ? "active-tab"
                : ""
            }
            onClick={() =>
              setBillType(
                "sublet-bill"
              )
            }
          >
            Sublet Bill
          </button>
        </div>

        {billType ===
        "government-bill" ? (
          <div className="payment-form">
            <input
              placeholder="Department Name"
              value={
                govtForm.departmentName
              }
              onChange={(event) =>
                updateGovt(
                  "departmentName",
                  event.target.value
                )
              }
            />

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Taxable Work Amount"
              value={
                govtForm.taxableAmount
              }
              onChange={(event) =>
                updateGovt(
                  "taxableAmount",
                  event.target.value
                )
              }
            />

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Withheld Amount"
              value={
                govtForm.withheld
              }
              onChange={(event) =>
                updateGovt(
                  "withheld",
                  event.target.value
                )
              }
            />

            <p className="form-preview-total">
              GST 18% Preview:{" "}
              {money(
                governmentGstPreview
              )}
            </p>

            <p className="form-preview-total">
              Estimated Payable After
              Withholding:{" "}
              {money(
                Number(
                  govtForm.taxableAmount ||
                    0
                ) +
                  governmentGstPreview -
                  Number(
                    govtForm.withheld ||
                      0
                  )
              )}
            </p>
          </div>
        ) : (
          <div className="payment-form">
            <input
              placeholder="Subcontractor Name"
              value={
                subletForm.subcontractorName
              }
              onChange={(event) =>
                updateSublet(
                  "subcontractorName",
                  event.target.value
                )
              }
            />

            <div className="form-grid">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Original Work Amount"
                value={
                  subletForm.originalWorkAmount
                }
                onChange={(event) =>
                  updateSublet(
                    "originalWorkAmount",
                    event.target.value
                  )
                }
              />

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Sublet Taxable Value"
                value={
                  subletForm.subletTaxableValue
                }
                onChange={(event) =>
                  updateSublet(
                    "subletTaxableValue",
                    event.target.value
                  )
                }
              />

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Agency % as decimal, example 0.03"
                value={
                  subletForm.agencyPercent
                }
                onChange={(event) =>
                  updateSublet(
                    "agencyPercent",
                    event.target.value
                  )
                }
              />

              <input
                type="number"
                min="0"
                step="1"
                placeholder="Extension Time Limit"
                value={
                  subletForm.extTimeLimit
                }
                onChange={(event) =>
                  updateSublet(
                    "extTimeLimit",
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-grid">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Department Withheld"
                value={
                  subletForm.withheld
                }
                onChange={(event) =>
                  updateSublet(
                    "withheld",
                    event.target.value
                  )
                }
              />

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Sublet Withheld"
                value={
                  subletForm.subletWithheld
                }
                onChange={(event) =>
                  updateSublet(
                    "subletWithheld",
                    event.target.value
                  )
                }
              />

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Cost of Bill Fine"
                value={
                  subletForm.costOfBillFine
                }
                onChange={(event) =>
                  updateSublet(
                    "costOfBillFine",
                    event.target.value
                  )
                }
              />

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="GST Hold"
                value={
                  subletForm.gstHold18
                }
                onChange={(event) =>
                  updateSublet(
                    "gstHold18",
                    event.target.value
                  )
                }
              />

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Loan / Advance"
                value={
                  subletForm.loanAmount
                }
                onChange={(event) =>
                  updateSublet(
                    "loanAmount",
                    event.target.value
                  )
                }
              />
            </div>

            <p className="form-preview-total">
              Sublet GST 18% Preview:{" "}
              {money(
                subletGstPreview
              )}
            </p>

            <p className="form-preview-total">
              Agency Charge Preview:{" "}
              {money(
                subletAgencyPreview
              )}
            </p>

            <p className="form-preview-total">
              Estimated Net Payable:{" "}
              {money(
                subletNetPreview
              )}
            </p>
          </div>
        )}
      </section>

      <FinanceSummaryCards
        summary={summary}
      />

      <FinanceRecordsTable
        title="Tender Finance Records"
        payments={
          filteredPayments
        }
        onEdit={
          startEditPayment
        }
        onDelete={(
          payment
        ) =>
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