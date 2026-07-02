import { useEffect, useState } from "react";
import DeleteVerificationModal from "../components/DeleteVerificationModal";
import { updatePayment } from "../services/paymentService";
import { getTenders } from "../services/tenderService";
import { getSites } from "../services/siteService";

import {
  getActiveSections,
  getDefaultSectionKey,
} from "../config/paymentSections";

import { calculatePaymentSummary } from "../utils/paymentCalculations";
import { buildPaymentPayload } from "../utils/paymentHelpers";

import PaymentSummaryCards from "../components/payments/PaymentSummaryCards";
import PaymentTabs from "../components/payments/PaymentTabs";
import PaymentFormRenderer from "../components/payments/PaymentFormRenderer";
import PaymentRecordsTable from "../components/payments/PaymentRecordsTable";

function PaymentsPage({ payments, addPayment, deletePayment, fetchPayments }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [tenders, setTenders] = useState([]);
  const [sites, setSites] = useState([]);

  const [mainTab, setMainTab] = useState("Income");
  const [sectionTab, setSectionTab] = useState("PERSONAL_INVESTOR");

  const activeSections = getActiveSections(mainTab);

  const activeSection =
    activeSections.find((section) => section.key === sectionTab) ||
    activeSections[0];

  const getEmptyForm = () => ({
    payment_type: mainTab,
    payment_scope: activeSection.scope,
    payment_sub_type: activeSection.subType,
    category: activeSection.label,
    amount: "",
    payment_date: "",
    description: "",
    tender_id: "",
    site_id: "",
    material_name: "",
    quantity: "",
    gst_amount: "",
    collected_gst: "",
    payment_mode: "Bank",
    details: "",
    worker_name: "",
    investor_name: "",
    interest_percent: "",
    fd_site: "",
  });

  const [addForm, setAddForm] = useState(getEmptyForm);
  const [editForm, setEditForm] = useState(getEmptyForm);

  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const tenderData = await getTenders();
        const siteData = await getSites();

        setTenders(tenderData || []);
        setSites(siteData || []);
      } catch (error) {
        console.error("Payment dropdown data error:", error);
      }
    };

    loadDropdownData();
  }, []);

  useEffect(() => {
    setAddForm(getEmptyForm());
    setEditingPayment(null);
  }, [mainTab, sectionTab]);

  const summary = calculatePaymentSummary(payments);

  const filteredPayments = payments.filter((payment) => {
    const search = searchTerm.toLowerCase();

    const matchesSection =
      payment.payment_type === mainTab &&
      payment.payment_scope === activeSection.scope &&
      payment.payment_sub_type === activeSection.subType;

    const matchesSearch =
      payment.category?.toLowerCase().includes(search) ||
      payment.payment_sub_type?.toLowerCase().includes(search) ||
      payment.description?.toLowerCase().includes(search) ||
      payment.details?.toLowerCase().includes(search) ||
      payment.investor_name?.toLowerCase().includes(search) ||
      payment.worker_name?.toLowerCase().includes(search) ||
      payment.material_name?.toLowerCase().includes(search) ||
      payment.payment_date?.toLowerCase().includes(search) ||
      String(payment.amount || "").includes(search);

    return matchesSection && matchesSearch;
  });

  const handleMainTabClick = (tab) => {
    setMainTab(tab);
    setSectionTab(getDefaultSectionKey(tab));
  };

  const handleSectionClick = (section) => {
    setSectionTab(section.key);
  };

  const handleAddChange = (event) => {
    const { name, value } = event.target;

    setAddForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddPaymentSubmit = async (event) => {
    event.preventDefault();

    try {
      await addPayment(buildPaymentPayload(addForm));

      if (fetchPayments) {
        await fetchPayments();
      }

      setAddForm(getEmptyForm());
    } catch (error) {
      console.error("Add payment error:", error);
      alert(error.response?.data?.message || "Failed to add payment");
    }
  };

  const startEdit = (payment) => {
    setEditingPayment(payment);

    setEditForm({
      payment_type: payment.payment_type || mainTab,
      payment_scope: payment.payment_scope || activeSection.scope,
      payment_sub_type: payment.payment_sub_type || activeSection.subType,
      category: payment.category || activeSection.label,
      amount: payment.amount || "",
      payment_date: payment.payment_date
        ? payment.payment_date.slice(0, 10)
        : "",
      description: payment.description || "",
      tender_id: payment.tender_id || "",
      site_id: payment.site_id || "",
      material_name: payment.material_name || "",
      quantity: payment.quantity || "",
      gst_amount: payment.gst_amount || "",
      collected_gst: payment.collected_gst || "",
      payment_mode: payment.payment_mode || "Bank",
      details: payment.details || "",
      worker_name: payment.worker_name || "",
      investor_name: payment.investor_name || "",
      interest_percent: payment.interest_percent || "",
      fd_site: payment.fd_site || "",
    });
  };

  const cancelEdit = () => {
    setEditingPayment(null);
    setEditForm(getEmptyForm());
  };

  const handleUpdatePayment = async (event) => {
    event.preventDefault();

    if (!editingPayment) return;

    try {
      await updatePayment(editingPayment.id, buildPaymentPayload(editForm));

      if (fetchPayments) {
        await fetchPayments();
      }

      cancelEdit();
    } catch (error) {
      console.error("Update payment error:", error);
      alert(error.response?.data?.message || "Failed to update payment");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deletePayment(deleteTarget.id);

    if (fetchPayments) {
      await fetchPayments();
    }

    setDeleteTarget(null);
  };

  return (
    <>
      <PaymentSummaryCards summary={summary} />

      <PaymentTabs
        mainTab={mainTab}
        activeSections={activeSections}
        sectionTab={sectionTab}
        onMainTabClick={handleMainTabClick}
        onSectionClick={handleSectionClick}
      />

      <section className="payment-grid">
        <div className="panel">
          <h2>
            {editingPayment ? "Edit" : "Add"} {activeSection.label}
          </h2>

          <PaymentFormRenderer
            activeSection={activeSection}
            editingPayment={editingPayment}
            addForm={addForm}
            editForm={editForm}
            handleAddChange={handleAddChange}
            handleEditChange={handleEditChange}
            handleAddPaymentSubmit={handleAddPaymentSubmit}
            handleUpdatePayment={handleUpdatePayment}
            cancelEdit={cancelEdit}
            tenders={tenders}
            sites={sites}
          />
        </div>

        <PaymentRecordsTable
          activeSection={activeSection}
          payments={filteredPayments}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sites={sites}
          tenders={tenders}
          startEdit={startEdit}
          setDeleteTarget={setDeleteTarget}
        />
      </section>

      <DeleteVerificationModal
        open={!!deleteTarget}
        itemName={deleteTarget?.category || "payment"}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export default PaymentsPage;