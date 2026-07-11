  import { useMemo, useState } from "react";
  import toast from "react-hot-toast";

  import DeleteVerificationModal from "../components/DeleteVerificationModal";
  import FinanceOverview from "../components/finance/FinanceOverview";
  import FinanceWizard from "../components/finance/FinanceWizard";
  import FinanceTable from "../components/finance/FinanceTable";
  import FinanceTrendChart from "../components/charts/FinanceTrendChart";

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
    const [mainTab, setMainTab] = useState("Income");
    const activeSections = getActiveSections(mainTab);

    const [selectedSection, setSelectedSection] = useState(null);
    const [selectedChild, setSelectedChild] = useState(null);

    const [selectedTenderId, setSelectedTenderId] = useState("");
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deletingPaymentId, setDeletingPaymentId] = useState(null);
    const [editingPayment, setEditingPayment] = useState(null);

    const totals = useFinanceStatistics(payments);

    const selectedTender = useMemo(() => {
      return tenders.find((t) => String(t.id) === String(selectedTenderId));
    }, [tenders, selectedTenderId]);

    const activeSubType = selectedChild?.subType || selectedSection?.subType;

    const update = (field, value) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

    const resetForm = () => {
      setFormData({});
      setSelectedTenderId("");
    };

    const handleMainTabClick = (tab) => {
      setMainTab(tab);
    
      setSelectedSection(null);
      setSelectedChild(null);
    
      resetForm();
    
      setEditingPayment(null);
    };

    const handleSectionClick = (section) => {
      setSelectedSection(section);
    
      setSelectedChild(null);
    
      resetForm();
    
      setEditingPayment(null);
    };

    const handleChildClick = (child) => {
      setSelectedChild(child);
    
      resetForm();
    };

    const cancelEdit = () => {
      setEditingPayment(null);
    
      setSelectedSection(null);
      setSelectedChild(null);
    
      resetForm();
    };

    const startEdit = (payment) => {
      const sections = getActiveSections(payment.payment_type || "Income");

      const section =
        sections.find((item) => item.scope === payment.payment_scope) ||
        sections[0];

      const child = section?.childOptions?.find(
        (item) => item.subType === payment.payment_sub_type
      );

      setEditingPayment(payment);
      setMainTab(payment.payment_type || "Income");
      setSelectedSection(section);
      setSelectedChild(child || getDefaultChildOption(section));
      setSelectedTenderId(payment.tender_id || "");
      setFormData(mapPaymentToForm(payment));
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
      });

    const handleSubmit = async (event) => {
      event.preventDefault();
      if (!selectedSection) {
        toast.error("Please select a finance section.");
        return;
      }
      
      if (
        selectedSection.childOptions?.length > 0 &&
        !selectedChild
      ) {
        toast.error(
          "Please select Investor or Government Bill."
        );
        return;
      }

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

        if (editingPayment) {
          await updatePayment(editingPayment.id, buildPayload());
          toast.success("Finance record updated.");
        } else {
          await addPayment(buildPayload());
          toast.success("Finance record added.");
        }

        resetForm();

        setSelectedSection(null);
        setSelectedChild(null);
        setEditingPayment(null);

        if (fetchPayments) {
          await fetchPayments();
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to save record.");
      } finally {
        setSubmitting(false);
      }
    };

    const confirmDelete = async () => {
      if (!deleteTarget || deletingPaymentId !== null) {
        return;
      }
    
      const paymentId = deleteTarget.id;
    
      try {
        setDeletingPaymentId(paymentId);
    
        await deletePayment(paymentId);
    
        toast.success("Record deleted.");
        setDeleteTarget(null);
    
        // removePayment already updates local state.
        // A second fetch is unnecessary and can create extra requests.
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            "Failed to delete record."
        );
      } finally {
        setDeletingPaymentId(null);
      }
    };

    return (
      <>
        <FinanceOverview totals={totals} />

        <FinanceTrendChart payments={payments} />

        <FinanceWizard
          editingPayment={editingPayment}
          mainTab={mainTab}
          activeSections={activeSections}
          selectedSection={selectedSection}
          selectedChild={selectedChild}
          selectedTender={selectedTender}
          selectedTenderId={selectedTenderId}
          setSelectedTenderId={setSelectedTenderId}
          tenders={tenders}
          payments={payments}
          formData={formData}
          update={update}
          handleSubmit={handleSubmit}
          submitting={submitting}
          handleMainTabClick={handleMainTabClick}
          handleSectionClick={handleSectionClick}
          handleChildClick={handleChildClick}
          cancelEdit={cancelEdit}
        />

        <FinanceTable
          payments={payments}
          tenders={tenders}
          onEdit={startEdit}
          onDelete={setDeleteTarget}
        />

        <DeleteVerificationModal
          open={!!deleteTarget}
          itemName={deleteTarget?.category || "finance record"}
          onCancel={() => {
            if (deletingPaymentId === null) {
              setDeleteTarget(null);
            }
          }}
          onConfirm={confirmDelete}
          loading={deletingPaymentId !== null}
        />
      </>
    );
  }

  export default PaymentsPage;