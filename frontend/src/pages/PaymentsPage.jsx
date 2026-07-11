import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";
import FinanceOverview from "../components/finance/FinanceOverview";
import FinanceWizard from "../components/finance/FinanceWizard";
import FinanceTable from "../components/finance/FinanceTable";
import FinanceTrendChart from "../components/charts/FinanceTrendChart";

import { useAuth } from "../contexts/AuthContext";

import {
  getActiveSections,
  getDefaultChildOption,
} from "../config/paymentSections";

import { updatePayment } from "../services/paymentService";
import useFinanceStatistics from "../hooks/useFinanceStatistics";

import {
  buildFinancePayload,
  mapPaymentToForm,
} from "../utils/financeHelper";

function PaymentsPage({
  payments = [],
  tenders = [],
  addPayment,
  deletePayment,
  fetchPayments,
}) {
  const { user } = useAuth();

  const [mainTab, setMainTab] = useState("Income");
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);
  const [selectedTenderId, setSelectedTenderId] = useState("");
  const [formData, setFormData] = useState({});

  const [editingPayment, setEditingPayment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);

  const activeSections = useMemo(
    () => getActiveSections(mainTab),
    [mainTab]
  );

  const totals = useFinanceStatistics(payments);

  const selectedTender = useMemo(
    () =>
      tenders.find(
        (tender) =>
          String(tender.id) === String(selectedTenderId)
      ),
    [tenders, selectedTenderId]
  );

  const activeSubType =
    selectedChild?.subType ||
    selectedSection?.subType ||
    null;

  const update = (field, value) => {
    setFormData((previousForm) => ({
      ...previousForm,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData({});
    setSelectedTenderId("");
  };

  const resetWizard = () => {
    resetForm();
    setSelectedSection(null);
    setSelectedChild(null);
    setEditingPayment(null);
  };

  const handleMainTabClick = (tab) => {
    if (submitting) return;

    setMainTab(tab);
    resetWizard();
  };

  const handleSectionClick = (section) => {
    if (submitting) return;

    setSelectedSection(section);
    setSelectedChild(null);
    setSelectedTenderId("");
    setFormData({});
    setEditingPayment(null);
  };

  const handleChildClick = (child) => {
    if (submitting) return;

    setSelectedChild(child);
    setSelectedTenderId("");
    setFormData({});
  };

  const cancelEdit = () => {
    if (submitting) return;

    resetWizard();
  };

  const startEdit = (payment) => {
    if (submitting || deletingPaymentId !== null) {
      return;
    }

    const paymentType =
      payment.payment_type || "Income";

    const sections =
      getActiveSections(paymentType);

    const section =
      sections.find(
        (item) =>
          item.scope === payment.payment_scope
      ) ||
      sections.find(
        (item) =>
          item.subType === payment.payment_sub_type
      ) ||
      null;

    const child =
      section?.childOptions?.find(
        (item) =>
          item.subType === payment.payment_sub_type
      ) || null;

    setEditingPayment(payment);
    setMainTab(paymentType);
    setSelectedSection(section);

    setSelectedChild(
      child ||
        (section?.childOptions?.length
          ? getDefaultChildOption(section)
          : null)
    );

    setSelectedTenderId(
      payment.tender_id
        ? String(payment.tender_id)
        : ""
    );

    setFormData(
      mapPaymentToForm(payment)
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const buildPayload = () =>
    buildFinancePayload({
      formData,
      mainTab,
      selectedSection,
      selectedChild,
      selectedTender,
      selectedTenderId,
      activeSubType,
      companyId: user?.company_id,
    });

  const validateFinanceForm = () => {
    if (!selectedSection) {
      toast.error(
        "Please select a finance section."
      );

      return false;
    }

    const hasChildOptions =
      Array.isArray(
        selectedSection.childOptions
      ) &&
      selectedSection.childOptions.length > 0;

    if (
      hasChildOptions &&
      !selectedChild
    ) {
      toast.error(
        "Please select Investor or Government Bill."
      );

      return false;
    }

    if (
      selectedSection.requiresTender &&
      !selectedTenderId
    ) {
      toast.error(
        "Please select a tender first."
      );

      return false;
    }

    if (!formData.payment_date) {
      toast.error("Date is required.");
      return false;
    }

    const amount = Number(
      formData.amount || 0
    );

    if (amount <= 0) {
      toast.error(
        "Amount must be greater than zero."
      );

      return false;
    }

    if (
      activeSubType === "INVESTOR" &&
      !String(
        formData.investor_name || ""
      ).trim()
    ) {
      toast.error(
        "Investor name is required."
      );

      return false;
    }

    if (
      activeSubType === "MATERIAL" &&
      !String(
        formData.material_name || ""
      ).trim()
    ) {
      toast.error(
        "Material name is required."
      );

      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!validateFinanceForm()) {
      return;
    }

    try {
      setSubmitting(true);

      const payload = buildPayload();

      if (editingPayment) {
        await updatePayment(
          editingPayment.id,
          payload
        );

        toast.success(
          "Finance record updated successfully."
        );
      } else {
        if (typeof addPayment !== "function") {
          throw new Error(
            "Add payment function is unavailable."
          );
        }

        await addPayment(payload);

        toast.success(
          "Finance record added successfully."
        );
      }

      resetWizard();

      if (
        typeof fetchPayments === "function"
      ) {
        await fetchPayments();
      }
    } catch (error) {
      console.error(
        "Failed to save finance record:",
        error.response?.data || error
      );

      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to save finance record."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (
      !deleteTarget ||
      deletingPaymentId !== null
    ) {
      return;
    }

    if (
      typeof deletePayment !== "function"
    ) {
      toast.error(
        "Delete payment function is unavailable."
      );

      return;
    }

    const paymentId = deleteTarget.id;

    try {
      setDeletingPaymentId(paymentId);

      await deletePayment(paymentId);

      if (
        editingPayment?.id === paymentId
      ) {
        resetWizard();
      }

      setDeleteTarget(null);

      toast.success(
        "Finance record deleted successfully."
      );
    } catch (error) {
      console.error(
        "Failed to delete finance record:",
        error.response?.data || error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to delete finance record."
      );
    } finally {
      setDeletingPaymentId(null);
    }
  };

  return (
    <>
      <FinanceOverview totals={totals} />

      <FinanceTrendChart
        payments={payments}
      />

      <FinanceWizard
        editingPayment={editingPayment}
        mainTab={mainTab}
        activeSections={activeSections}
        selectedSection={selectedSection}
        selectedChild={selectedChild}
        selectedTender={selectedTender}
        selectedTenderId={selectedTenderId}
        setSelectedTenderId={
          setSelectedTenderId
        }
        tenders={tenders}
        payments={payments}
        formData={formData}
        update={update}
        handleSubmit={handleSubmit}
        submitting={submitting}
        handleMainTabClick={
          handleMainTabClick
        }
        handleSectionClick={
          handleSectionClick
        }
        handleChildClick={
          handleChildClick
        }
        cancelEdit={cancelEdit}
      />

      <FinanceTable
        payments={payments}
        tenders={tenders}
        onEdit={startEdit}
        onDelete={(payment) => {
          if (
            deletingPaymentId === null
          ) {
            setDeleteTarget(payment);
          }
        }}
      />

      <DeleteVerificationModal
        open={Boolean(deleteTarget)}
        itemName={
          deleteTarget?.category ||
          deleteTarget?.payment_sub_type ||
          "finance record"
        }
        onCancel={() => {
          if (
            deletingPaymentId === null
          ) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={confirmDelete}
        loading={
          deletingPaymentId !== null
        }
      />
    </>
  );
}

export default PaymentsPage;