import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import PaymentTabs from "../components/payments/PaymentTabs";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import {
  getActiveSections,
  getDefaultChildOption,
} from "../config/paymentSections";

function PaymentsPage({
  payments = [],
  tenders = [],
  addPayment,
  deletePayment,
  fetchPayments,
}) {
  const [mainTab, setMainTab] = useState("Income");
  const activeSections = getActiveSections(mainTab);

  const [selectedSection, setSelectedSection] = useState(activeSections[0]);
  const [selectedChild, setSelectedChild] = useState(
    getDefaultChildOption(activeSections[0])
  );

  const [selectedTenderId, setSelectedTenderId] = useState("");
  const [formData, setFormData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const money = (value) => `$${Number(value || 0).toFixed(2)}`;

  const selectedTender = useMemo(() => {
    return tenders.find((t) => String(t.id) === String(selectedTenderId));
  }, [tenders, selectedTenderId]);

  const activeSubType = selectedChild?.subType || selectedSection?.subType;

  const totals = useMemo(() => {
    const totalIncome = payments
      .filter((p) => p.payment_type === "Income")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const totalExpense = payments
      .filter((p) => p.payment_type === "Expense")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const gstTotal = payments
      .filter((p) => p.payment_sub_type === "GOVERNMENT_BILL")
      .reduce((sum, p) => sum + Number(p.gst_amount || 0), 0);

    const gstReturned = payments
      .filter((p) => p.payment_sub_type === "GST_RETURN")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const companyChargeTotal = payments
      .filter((p) => p.payment_sub_type === "COMPANY_CHARGE")
      .reduce((sum, p) => sum + Number(p.gst_amount || p.amount || 0), 0);

    const companyChargePaid = payments
      .filter((p) => p.payment_sub_type === "COMPANY_CHARGE_PAYMENT")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      gstTotal,
      gstReturned,
      gstPending: gstTotal - gstReturned,
      companyChargeTotal,
      companyChargePaid,
      companyChargePending: companyChargeTotal - companyChargePaid,
      recordCount: payments.length,
    };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return payments.filter((payment) => {
      const matchesFilter =
        filterType === "all" || payment.payment_type === filterType;

      const tender = tenders.find(
        (t) => Number(t.id) === Number(payment.tender_id)
      );

      const matchesSearch =
        payment.payment_type?.toLowerCase().includes(search) ||
        payment.payment_scope?.toLowerCase().includes(search) ||
        payment.payment_sub_type?.toLowerCase().includes(search) ||
        payment.category?.toLowerCase().includes(search) ||
        payment.investor_name?.toLowerCase().includes(search) ||
        payment.worker_name?.toLowerCase().includes(search) ||
        payment.material_name?.toLowerCase().includes(search) ||
        payment.details?.toLowerCase().includes(search) ||
        tender?.title?.toLowerCase().includes(search) ||
        tender?.tender_name?.toLowerCase().includes(search) ||
        String(payment.amount || "").includes(search);

      return matchesFilter && matchesSearch;
    });
  }, [payments, searchTerm, filterType, tenders]);

  const update = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData({});
  };

  const handleMainTabClick = (tab) => {
    const sections = getActiveSections(tab);
    const firstSection = sections[0];

    setMainTab(tab);
    setSelectedSection(firstSection);
    setSelectedChild(getDefaultChildOption(firstSection));
    setSelectedTenderId("");
    resetForm();
  };

  const handleSectionClick = (section) => {
    setSelectedSection(section);
    setSelectedChild(getDefaultChildOption(section));
    setSelectedTenderId("");
    resetForm();
  };

  const handleChildClick = (child) => {
    setSelectedChild(child);
    resetForm();
  };

  const buildPayload = () => {
    let gstAmount = Number(formData.gst_amount || 0);

    if (activeSubType === "COMPANY_CHARGE") {
      const amount = Number(formData.amount || 0);
      const percent = Number(formData.interest_percent || 0);
      gstAmount = Number(formData.gst_amount || (amount * percent) / 100);
    }

    return {
      company_id: null,
      payment_type: mainTab,
      payment_scope: selectedSection.scope,
      payment_sub_type: activeSubType,
      category: selectedChild?.label || selectedSection.label,

      tender_id: selectedSection.requiresTender ? selectedTenderId : null,
      site_id: selectedTender?.site_id || null,

      amount: Number(formData.amount || 0),
      payment_date: formData.payment_date,

      gst_amount: gstAmount,
      collected_gst: Number(formData.collected_gst || 0),
      payment_mode: formData.payment_mode || null,

      description: formData.details || "",
      details: formData.details || "",

      investor_name: formData.investor_name || null,
      fd_site: formData.fd_site || null,

      worker_name: formData.worker_name || null,
      material_name: formData.material_name || null,
      quantity: Number(formData.quantity || 0),

      interest_percent: Number(formData.interest_percent || 0),
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (selectedSection.requiresTender && !selectedTenderId) {
      toast.error("Please select tender first.");
      return;
    }

    if (!formData.payment_date) {
      toast.error("Date is required.");
      return;
    }

    if (!Number(formData.amount || 0)) {
      toast.error("Amount is required.");
      return;
    }

    try {
      setSubmitting(true);

      await addPayment(buildPayload());

      toast.success("Finance record added.");
      resetForm();

      if (fetchPayments) {
        await fetchPayments();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add record.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deletePayment(deleteTarget.id);
      toast.success("Record deleted.");
      setDeleteTarget(null);

      if (fetchPayments) {
        await fetchPayments();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete record.");
    }
  };

  const renderTenderSelector = () => {
    if (!selectedSection?.requiresTender) return null;

    return (
      <div className="payment-step-box">
        <label>Select Tender</label>

        <select
          value={selectedTenderId}
          onChange={(event) => setSelectedTenderId(event.target.value)}
        >
          <option value="">Select Tender</option>

          {tenders.map((tender) => (
            <option key={tender.id} value={tender.id}>
              {tender.title || tender.tender_name || tender.name || `Tender ${tender.id}`}
              {tender.status ? ` - ${tender.status}` : ""}
            </option>
          ))}
        </select>

        {tenders.length === 0 && (
          <small className="text-danger">
            No tenders found. Check AppRoutes and App.jsx props.
          </small>
        )}
      </div>
    );
  };

  const renderTenderSummary = () => {
    if (!selectedTender) return null;

    const tenderPayments = payments.filter(
      (p) => Number(p.tender_id) === Number(selectedTender.id)
    );

    const tenderIncome = tenderPayments
      .filter((p) => p.payment_type === "Income")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const tenderExpense = tenderPayments
      .filter((p) => p.payment_type === "Expense")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return (
      <div className="payment-tender-summary">
        <h3>{selectedTender.title || selectedTender.tender_name}</h3>

        <div className="summary-cards">
          <div className="card">
            <p>Status</p>
            <h2>{selectedTender.status || "-"}</h2>
          </div>

          <div className="card">
            <p>Tender Value</p>
            <h2>{money(selectedTender.estimated_value)}</h2>
          </div>

          <div className="card">
            <p>Tender Income</p>
            <h2>{money(tenderIncome)}</h2>
          </div>

          <div className="card">
            <p>Tender Expense</p>
            <h2>{money(tenderExpense)}</h2>
          </div>
        </div>
      </div>
    );
  };

  const renderForm = () => {
    if (selectedSection.requiresTender && !selectedTenderId) {
      return (
        <div className="empty-table-message">
          Select tender first, then enter finance details.
        </div>
      );
    }

    if (activeSubType === "INVESTOR") {
      return (
        <>
          <input
            placeholder="Investor Name / કોણે પૈસા આપ્યા?"
            value={formData.investor_name || ""}
            onChange={(e) => update("investor_name", e.target.value)}
            required
          />

          <input
            placeholder="FD / Site"
            value={formData.fd_site || ""}
            onChange={(e) => update("fd_site", e.target.value)}
          />

          <input
            type="date"
            value={formData.payment_date || ""}
            onChange={(e) => update("payment_date", e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="Amount"
            value={formData.amount || ""}
            onChange={(e) => update("amount", e.target.value)}
            required
          />

          <select
            value={formData.payment_mode || "Bank"}
            onChange={(e) => update("payment_mode", e.target.value)}
          >
            <option value="Bank">Bank</option>
            <option value="Cash">Cash</option>
          </select>

          <input
            type="number"
            placeholder="Interest %"
            value={formData.interest_percent || ""}
            onChange={(e) => update("interest_percent", e.target.value)}
          />
        </>
      );
    }

    if (activeSubType === "GOVERNMENT_BILL") {
      const billAmount = Number(formData.amount || 0);
      const companyPercent = Number(formData.interest_percent || 0);
      const companyCharge = (billAmount * companyPercent) / 100;

      return (
        <>
          <input
            type="date"
            value={formData.payment_date || ""}
            onChange={(e) => update("payment_date", e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="Government Bill Amount"
            value={formData.amount || ""}
            onChange={(e) => update("amount", e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="GST Amount"
            value={formData.gst_amount || ""}
            onChange={(e) => update("gst_amount", e.target.value)}
          />

          <input
            type="number"
            placeholder="Company Charge %"
            value={formData.interest_percent || ""}
            onChange={(e) => update("interest_percent", e.target.value)}
          />

          <div className="form-preview-total">
            Company Charge Preview: {money(companyCharge)}
          </div>

          <input
            type="number"
            placeholder="Collected GST"
            value={formData.collected_gst || ""}
            onChange={(e) => update("collected_gst", e.target.value)}
          />
        </>
      );
    }

    if (activeSubType === "COMPANY_CHARGE") {
      const amount = Number(formData.amount || 0);
      const percent = Number(formData.interest_percent || 0);
      const charge = (amount * percent) / 100;

      return (
        <>
          <input
            type="date"
            value={formData.payment_date || ""}
            onChange={(e) => update("payment_date", e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="Bill Amount"
            value={formData.amount || ""}
            onChange={(e) => update("amount", e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="Company Charge %"
            value={formData.interest_percent || ""}
            onChange={(e) => update("interest_percent", e.target.value)}
          />

          <input
            type="number"
            placeholder="Company Charge Amount"
            value={formData.gst_amount || charge}
            onChange={(e) => update("gst_amount", e.target.value)}
          />
        </>
      );
    }

    if (activeSubType === "GST_RETURN" || activeSubType === "TDS") {
      return (
        <>
          <input
            type="date"
            value={formData.payment_date || ""}
            onChange={(e) => update("payment_date", e.target.value)}
            required
          />

          <input
            type="number"
            placeholder={`${activeSubType} Amount`}
            value={formData.amount || ""}
            onChange={(e) => update("amount", e.target.value)}
            required
          />
        </>
      );
    }

    if (activeSubType === "MATERIAL") {
      return (
        <>
          <input
            placeholder="Material Name"
            value={formData.material_name || ""}
            onChange={(e) => update("material_name", e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="Quantity"
            value={formData.quantity || ""}
            onChange={(e) => update("quantity", e.target.value)}
          />

          <input
            type="date"
            value={formData.payment_date || ""}
            onChange={(e) => update("payment_date", e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="Amount"
            value={formData.amount || ""}
            onChange={(e) => update("amount", e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="GST Amount"
            value={formData.gst_amount || ""}
            onChange={(e) => update("gst_amount", e.target.value)}
          />
        </>
      );
    }

    return (
      <>
        <input
          placeholder={`${selectedChild?.label || selectedSection.label} Name / Category`}
          value={formData.worker_name || ""}
          onChange={(e) => update("worker_name", e.target.value)}
          required
        />

        <input
          type="date"
          value={formData.payment_date || ""}
          onChange={(e) => update("payment_date", e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Amount"
          value={formData.amount || ""}
          onChange={(e) => update("amount", e.target.value)}
          required
        />
      </>
    );
  };

  return (
    <>
      <section className="cards dashboard-cards">
        <div className="card">
          <p>Total Income</p>
          <h2>{money(totals.totalIncome)}</h2>
        </div>

        <div className="card">
          <p>Total Expense</p>
          <h2>{money(totals.totalExpense)}</h2>
        </div>

        <div className="card">
          <p>Balance</p>
          <h2>{money(totals.balance)}</h2>
        </div>

        <div className="card highlight-warning">
          <p>Baki GST</p>
          <h2>{money(totals.gstPending)}</h2>
        </div>

        <div className="card highlight-danger">
          <p>Baki Company Charge</p>
          <h2>{money(totals.companyChargePending)}</h2>
        </div>

        <div className="card">
          <p>Total Records</p>
          <h2>{totals.recordCount}</h2>
        </div>
      </section>

      <section className="panel finance-wizard-panel">
        <h2>Add Finance Record</h2>

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

        {renderTenderSelector()}
        {renderTenderSummary()}

        <div className="payment-step-box">
          <h3>
            {mainTab} → {selectedSection?.label}
            {selectedChild ? ` → ${selectedChild.label}` : ""}
          </h3>

          <form className="payment-form" onSubmit={handleSubmit}>
            {renderForm()}

            <textarea
              placeholder="Details"
              value={formData.details || ""}
              onChange={(e) => update("details", e.target.value)}
            />

            <button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Add Finance Record"}
            </button>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="section-title-row">
          <h2>Finance Records</h2>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
        </div>

        <input
          className="search-input"
          placeholder="Search by tender, investor, material, amount..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Scope</th>
                <th>Sub Type</th>
                <th>Name</th>
                <th>Tender</th>
                <th>Amount</th>
                <th>GST</th>
                <th>Mode</th>
                <th>Details</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredPayments.map((payment) => {
                const tender = tenders.find(
                  (t) => Number(t.id) === Number(payment.tender_id)
                );

                return (
                  <tr key={payment.id}>
                    <td>{payment.payment_date?.slice(0, 10)}</td>
                    <td>{payment.payment_type}</td>
                    <td>{payment.payment_scope || "-"}</td>
                    <td>{payment.payment_sub_type || "-"}</td>
                    <td>
                      {payment.investor_name ||
                        payment.worker_name ||
                        payment.material_name ||
                        payment.category ||
                        "-"}
                    </td>
                    <td>{tender?.title || tender?.tender_name || "-"}</td>
                    <td>{money(payment.amount)}</td>
                    <td>{money(payment.gst_amount)}</td>
                    <td>{payment.payment_mode || "-"}</td>
                    <td>{payment.details || payment.description || "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => setDeleteTarget(payment)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan="11" className="empty-table-message">
                    No finance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={deleteTarget?.category || "finance record"}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

export default PaymentsPage;