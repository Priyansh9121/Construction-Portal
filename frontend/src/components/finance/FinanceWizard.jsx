import PaymentTabs from "../payments/PaymentTabs";
import TenderSummaryCard from "./TenderSummaryCard";
import { money } from "../../utils/financeHelper";

function FinanceWizard({
  editingPayment,
  mainTab,
  activeSections,
  selectedSection,
  selectedChild,
  selectedTender,
  selectedTenderId,
  setSelectedTenderId,
  tenders,
  payments,
  formData,
  update,
  handleSubmit,
  submitting,
  handleMainTabClick,
  handleSectionClick,
  handleChildClick,
  cancelEdit,
}) {
  const activeSubType =
    selectedChild?.subType ||
    selectedSection?.subType ||
    null;

  const amount = Number(formData.amount || 0);
  const gst18 = (amount * 18) / 100;
  const company2 = (amount * 2) / 100;

  const hasChildOptions =
    Array.isArray(selectedSection?.childOptions) &&
    selectedSection.childOptions.length > 0;

  const childSelectionRequired =
    hasChildOptions && !selectedChild;

  const autoGST18 = () => {
    update("gst_amount", gst18.toFixed(2));
  };

  const autoCompany2 = () => {
    update("interest_percent", 2);
    update("gst_amount", company2.toFixed(2));
  };

  const Field = ({ label, children }) => (
    <label>
      {label}
      {children}
    </label>
  );

  const renderTenderSelector = () => {
    // Do not show Step 2 until a finance section is selected.
    if (!selectedSection) return null;

    // For Personal Tender, wait until Investor or Government Bill is chosen.
    if (childSelectionRequired) return null;

    if (!selectedSection.requiresTender) return null;

    return (
      <section className="panel">
        <div className="form-section-title">
          <h3>Step 2 — Select Tender</h3>

          <p className="muted-text">
            This finance record will be linked to a tender for
            reporting and ledger export.
          </p>
        </div>

        <div className="form-grid">
          <Field label="Tender">
            <select
              value={selectedTenderId}
              onChange={(event) =>
                setSelectedTenderId(event.target.value)
              }
              required
            >
              <option value="">Select Tender</option>

              {tenders.map((tender) => (
                <option
                  key={tender.id}
                  value={tender.id}
                >
                  {tender.title ||
                    tender.tender_name ||
                    `Tender ${tender.id}`}

                  {tender.status
                    ? ` - ${tender.status}`
                    : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>
    );
  };

  const renderCommonFooter = () => (
    <>
      <Field label="Details / Notes">
        <textarea
          placeholder="Add bill number, supplier details, site reference, approval notes..."
          value={formData.details || ""}
          onChange={(event) =>
            update("details", event.target.value)
          }
        />
      </Field>

      <div className="form-actions">
        <button
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Saving..."
            : editingPayment
              ? "Update Finance Record"
              : "Add Finance Record"}
        </button>

        {editingPayment && (
          <button
            type="button"
            className="secondary-btn"
            onClick={cancelEdit}
            disabled={submitting}
          >
            Cancel Edit
          </button>
        )}
      </div>
    </>
  );

  const renderIncomeInvestor = () => (
    <>
      <div className="form-grid">
        <Field label="Investor Name">
          <input
            placeholder="Investor name"
            value={formData.investor_name || ""}
            onChange={(event) =>
              update(
                "investor_name",
                event.target.value
              )
            }
            required
          />
        </Field>

        <Field label="FD / Site Reference">
          <input
            placeholder="FD / Site"
            value={formData.fd_site || ""}
            onChange={(event) =>
              update("fd_site", event.target.value)
            }
          />
        </Field>

        <Field label="Payment Date">
          <input
            type="date"
            value={formData.payment_date || ""}
            onChange={(event) =>
              update(
                "payment_date",
                event.target.value
              )
            }
            required
          />
        </Field>

        <Field label="Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={formData.amount || ""}
            onChange={(event) =>
              update("amount", event.target.value)
            }
            required
          />
        </Field>

        <Field label="Payment Mode">
          <select
            value={formData.payment_mode || "Bank"}
            onChange={(event) =>
              update(
                "payment_mode",
                event.target.value
              )
            }
          >
            <option value="Bank">Bank</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
            <option value="UPI">UPI</option>
          </select>
        </Field>

        <Field label="Interest %">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Interest %"
            value={formData.interest_percent || ""}
            onChange={(event) =>
              update(
                "interest_percent",
                event.target.value
              )
            }
          />
        </Field>
      </div>

      <p className="form-preview-total">
        Interest Preview:{" "}
        {money(
          (amount *
            Number(
              formData.interest_percent || 0
            )) /
            100
        )}
      </p>
    </>
  );

  const renderGovernmentBill = () => (
    <>
      <div className="form-grid">
        <Field label="Bill Date">
          <input
            type="date"
            value={formData.payment_date || ""}
            onChange={(event) =>
              update(
                "payment_date",
                event.target.value
              )
            }
            required
          />
        </Field>

        <Field label="Government Bill Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Bill amount"
            value={formData.amount || ""}
            onChange={(event) =>
              update("amount", event.target.value)
            }
            required
          />
        </Field>

        <Field label="GST Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="GST amount"
            value={formData.gst_amount || ""}
            onChange={(event) =>
              update(
                "gst_amount",
                event.target.value
              )
            }
          />
        </Field>

        <Field label="Company Charge %">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Company charge %"
            value={
              formData.interest_percent || ""
            }
            onChange={(event) =>
              update(
                "interest_percent",
                event.target.value
              )
            }
          />
        </Field>

        <Field label="Collected GST">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Collected GST"
            value={formData.collected_gst || ""}
            onChange={(event) =>
              update(
                "collected_gst",
                event.target.value
              )
            }
          />
        </Field>

        <Field label="Payment Mode">
          <select
            value={formData.payment_mode || "Bank"}
            onChange={(event) =>
              update(
                "payment_mode",
                event.target.value
              )
            }
          >
            <option value="Bank">Bank</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
            <option value="UPI">UPI</option>
          </select>
        </Field>
      </div>

      <div className="report-actions">
        <button
          type="button"
          className="secondary-btn"
          onClick={autoGST18}
        >
          Auto GST 18%
        </button>

        <button
          type="button"
          className="secondary-btn"
          onClick={autoCompany2}
        >
          Auto Company Charge 2%
        </button>
      </div>

      <p className="form-preview-total">
        GST Preview: {money(gst18)} | Company
        Charge 2% Preview: {money(company2)}
      </p>
    </>
  );

  const renderCompanyCharge = () => (
    <>
      <div className="form-grid">
        <Field label="Date">
          <input
            type="date"
            value={formData.payment_date || ""}
            onChange={(event) =>
              update(
                "payment_date",
                event.target.value
              )
            }
            required
          />
        </Field>

        <Field label="Bill Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Bill amount"
            value={formData.amount || ""}
            onChange={(event) =>
              update("amount", event.target.value)
            }
            required
          />
        </Field>

        <Field label="Company Charge %">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Company charge %"
            value={
              formData.interest_percent || ""
            }
            onChange={(event) =>
              update(
                "interest_percent",
                event.target.value
              )
            }
          />
        </Field>

        <Field label="Company Charge Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Charge amount"
            value={formData.gst_amount || ""}
            onChange={(event) =>
              update(
                "gst_amount",
                event.target.value
              )
            }
          />
        </Field>
      </div>

      <button
        type="button"
        className="secondary-btn"
        onClick={autoCompany2}
      >
        Auto Company Charge 2%
      </button>

      <p className="form-preview-total">
        Company Charge Preview:{" "}
        {money(
          (amount *
            Number(
              formData.interest_percent || 0
            )) /
            100
        )}
      </p>
    </>
  );

  const renderSimpleAmount = (label) => (
    <div className="form-grid">
      <Field label={`${label} Date`}>
        <input
          type="date"
          value={formData.payment_date || ""}
          onChange={(event) =>
            update(
              "payment_date",
              event.target.value
            )
          }
          required
        />
      </Field>

      <Field label={`${label} Amount`}>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder={`${label} amount`}
          value={formData.amount || ""}
          onChange={(event) =>
            update("amount", event.target.value)
          }
          required
        />
      </Field>

      <Field label="Payment Mode">
        <select
          value={formData.payment_mode || "Bank"}
          onChange={(event) =>
            update(
              "payment_mode",
              event.target.value
            )
          }
        >
          <option value="Bank">Bank</option>
          <option value="Cash">Cash</option>
          <option value="Cheque">Cheque</option>
          <option value="UPI">UPI</option>
        </select>
      </Field>
    </div>
  );

  const renderMaterialExpense = () => (
    <>
      <div className="form-grid">
        <Field label="Material Name">
          <input
            placeholder="Material name"
            value={formData.material_name || ""}
            onChange={(event) =>
              update(
                "material_name",
                event.target.value
              )
            }
            required
          />
        </Field>

        <Field label="Quantity">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Quantity"
            value={formData.quantity || ""}
            onChange={(event) =>
              update(
                "quantity",
                event.target.value
              )
            }
          />
        </Field>

        <Field label="Payment Date">
          <input
            type="date"
            value={formData.payment_date || ""}
            onChange={(event) =>
              update(
                "payment_date",
                event.target.value
              )
            }
            required
          />
        </Field>

        <Field label="Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={formData.amount || ""}
            onChange={(event) =>
              update("amount", event.target.value)
            }
            required
          />
        </Field>

        <Field label="GST Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="GST amount"
            value={formData.gst_amount || ""}
            onChange={(event) =>
              update(
                "gst_amount",
                event.target.value
              )
            }
          />
        </Field>

        <Field label="Payment Mode">
          <select
            value={formData.payment_mode || "Bank"}
            onChange={(event) =>
              update(
                "payment_mode",
                event.target.value
              )
            }
          >
            <option value="Bank">Bank</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
            <option value="UPI">UPI</option>
          </select>
        </Field>
      </div>

      <button
        type="button"
        className="secondary-btn"
        onClick={autoGST18}
      >
        Auto GST 18%
      </button>

      <p className="form-preview-total">
        GST Preview: {money(gst18)}
      </p>
    </>
  );

  const renderNameAmountExpense = () => {
    const financeLabel =
      selectedChild?.label ||
      selectedSection?.label ||
      "Finance";

    return (
      <div className="form-grid">
        <Field label={`${financeLabel} Name`}>
          <input
            placeholder="Name / Category"
            value={formData.worker_name || ""}
            onChange={(event) =>
              update(
                "worker_name",
                event.target.value
              )
            }
            required
          />
        </Field>

        <Field label="Payment Date">
          <input
            type="date"
            value={formData.payment_date || ""}
            onChange={(event) =>
              update(
                "payment_date",
                event.target.value
              )
            }
            required
          />
        </Field>

        <Field label="Amount">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={formData.amount || ""}
            onChange={(event) =>
              update("amount", event.target.value)
            }
            required
          />
        </Field>

        <Field label="Payment Mode">
          <select
            value={formData.payment_mode || "Bank"}
            onChange={(event) =>
              update(
                "payment_mode",
                event.target.value
              )
            }
          >
            <option value="Bank">Bank</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
            <option value="UPI">UPI</option>
          </select>
        </Field>
      </div>
    );
  };

  const renderFormFields = () => {
    if (!selectedSection) {
      return (
        <div className="empty-table-message">
          Select a finance section to continue.
        </div>
      );
    }

    if (childSelectionRequired) {
      return (
        <div className="empty-table-message">
          Select Investor or Government Bill to
          continue.
        </div>
      );
    }

    if (
      selectedSection.requiresTender &&
      !selectedTenderId
    ) {
      return (
        <div className="empty-table-message">
          Select a tender first, then enter finance
          details.
        </div>
      );
    }

    if (activeSubType === "INVESTOR") {
      return renderIncomeInvestor();
    }

    if (activeSubType === "GOVERNMENT_BILL") {
      return renderGovernmentBill();
    }

    if (activeSubType === "COMPANY_CHARGE") {
      return renderCompanyCharge();
    }

    if (activeSubType === "GST_RETURN") {
      return renderSimpleAmount("GST Return");
    }

    if (activeSubType === "TDS") {
      return renderSimpleAmount("TDS");
    }

    if (activeSubType === "MATERIAL") {
      return renderMaterialExpense();
    }

    return renderNameAmountExpense();
  };

  const canShowTenderSummary =
    Boolean(selectedSection) &&
    !childSelectionRequired &&
    Boolean(selectedTender);

  const canShowDetails =
    Boolean(selectedSection) &&
    !childSelectionRequired;

  return (
    <section className="finance-wizard-panel">
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              {editingPayment
                ? "Edit Finance Record"
                : "Add Finance Record"}
            </h2>

            <p className="muted-text">
              Step-by-step finance entry with tender
              linking, live previews and automatic
              calculations.
            </p>
          </div>

          <span
            className={
              mainTab === "Income"
                ? "badge green"
                : "badge yellow"
            }
          >
            {mainTab}
          </span>
        </div>

        <div className="form-section-title">
          <h3>Step 1 — Choose Finance Type</h3>

          <p className="muted-text">
            Select Income or Expense, then choose the
            correct finance section.
          </p>
        </div>

        <PaymentTabs
          mainTab={mainTab}
          activeSections={activeSections}
          sectionTab={selectedSection?.key}
          childTab={selectedChild?.key}
          selectedSection={selectedSection}
          onMainTabClick={handleMainTabClick}
          onSectionClick={handleSectionClick}
          onChildClick={handleChildClick}
        />
      </section>

      {renderTenderSelector()}

      {canShowTenderSummary && (
        <TenderSummaryCard
          selectedTender={selectedTender}
          payments={payments}
        />
      )}

      {canShowDetails && (
        <section className="panel">
          <div className="form-section-title">
            <h3>
              {selectedSection.requiresTender
                ? "Step 3 — Enter Details"
                : "Step 2 — Enter Details"}
            </h3>

            <p className="muted-text">
              {mainTab}

              {selectedSection
                ? ` → ${selectedSection.label}`
                : ""}

              {selectedChild
                ? ` → ${selectedChild.label}`
                : ""}
            </p>
          </div>

          <form
            className="payment-form"
            onSubmit={handleSubmit}
          >
            {renderFormFields()}

            {(!selectedSection.requiresTender ||
              selectedTenderId) &&
              !childSelectionRequired && (
                renderCommonFooter()
              )}
          </form>
        </section>
      )}
    </section>
  );
}

export default FinanceWizard;