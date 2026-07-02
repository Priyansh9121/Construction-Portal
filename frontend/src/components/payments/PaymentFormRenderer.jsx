import InvestorForm from "./InvestorForm";
import GovernmentBillForm from "./GovernmentBillForm";
import GstReturnForm from "./GstReturnForm";
import TdsForm from "./TdsForm";
import CompanyChargeForm from "./CompanyChargeForm";
import SiteMaterialForm from "./SiteMaterialForm";
import SimpleExpenseForm from "./SimpleExpenseForm";

function PaymentFormRenderer({
  activeSection,
  editingPayment,
  addForm,
  editForm,
  handleAddChange,
  handleEditChange,
  handleAddPaymentSubmit,
  handleUpdatePayment,
  cancelEdit,
  tenders,
  sites,
}) {
  const commonProps = {
    form: editingPayment ? editForm : addForm,
    onChange: editingPayment ? handleEditChange : handleAddChange,
    onSubmit: editingPayment ? handleUpdatePayment : handleAddPaymentSubmit,
    submitLabel: editingPayment ? "Save Changes" : "Add Payment",
    showCancel: !!editingPayment,
    onCancel: cancelEdit,
  };

  if (activeSection.subType === "INVESTOR") {
    return <InvestorForm {...commonProps} />;
  }

  if (activeSection.subType === "GOVERNMENT_BILL") {
    return <GovernmentBillForm {...commonProps} />;
  }

  if (activeSection.subType === "GST_RETURN") {
    return <GstReturnForm {...commonProps} />;
  }

  if (activeSection.subType === "TDS") {
    return <TdsForm {...commonProps} />;
  }

  if (activeSection.subType === "COMPANY_CHARGE") {
    return <CompanyChargeForm {...commonProps} tenders={tenders} />;
  }

  if (activeSection.subType === "MATERIAL") {
    return (
      <SiteMaterialForm
        {...commonProps}
        tenders={tenders}
        sites={sites}
      />
    );
  }

  return <SimpleExpenseForm {...commonProps} />;
}

export default PaymentFormRenderer;