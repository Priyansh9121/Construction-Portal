import InvestorForm from "./InvestorForm";
import GovernmentBillForm from "./GovernmentBillForm";
import OfficeIncomeForm from "./OfficeIncomeForm";
import CompanyChargeForm from "./CompanyChargeForm";
import GstReturnForm from "./GstReturnForm";
import TdsForm from "./TdsForm";

import SupervisorExpenseForm from "./SupervisorExpenseForm";
import MaterialExpenseForm from "./MaterialExpenseForm";
import LabourExpenseForm from "./LabourExpenseForm";
import OfficeExpenseForm from "./OfficeExpenseForm";

function PaymentFormRenderer({
  paymentType,
  selectedSection,
  selectedChild,
  selectedTender,
  formData,
  setFormData,
  onSubmit,
  submitting,
}) {
  if (!selectedSection) return null;

  /*
  |--------------------------------------------------------------------------
  | Tender selector
  |--------------------------------------------------------------------------
  */

  if (selectedSection.requiresTender && !selectedTender) {
    return (
      <div className="empty-selection-card">
        <h3>Select Tender</h3>

        <p>
          Please select a tender before continuing.
        </p>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | INCOME
  |--------------------------------------------------------------------------
  */

  if (paymentType === "Income") {
    switch (selectedChild?.subType || selectedSection.subType) {
      case "INVESTOR":
        return (
          <InvestorForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            submitting={submitting}
          />
        );

      case "GOVERNMENT_BILL":
        return (
          <GovernmentBillForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            submitting={submitting}
          />
        );

      case "OFFICE_INCOME":
        return (
          <OfficeIncomeForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            submitting={submitting}
          />
        );

      case "COMPANY_CHARGE":
        return (
          <CompanyChargeForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            submitting={submitting}
          />
        );

      case "GST_RETURN":
        return (
          <GstReturnForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            submitting={submitting}
          />
        );

      case "TDS":
        return (
          <TdsForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            submitting={submitting}
          />
        );

      default:
        return null;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | EXPENSE
  |--------------------------------------------------------------------------
  */

  switch (selectedChild?.subType) {
    case "SUPERVISOR":
      return (
        <SupervisorExpenseForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={onSubmit}
          submitting={submitting}
        />
      );

    case "MATERIAL":
      return (
        <MaterialExpenseForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={onSubmit}
          submitting={submitting}
        />
      );

    case "LABOUR":
      return (
        <LabourExpenseForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={onSubmit}
          submitting={submitting}
        />
      );

    case "SALARY":
    case "PF":
    case "TAX":
    case "OTHER":
      return (
        <OfficeExpenseForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={onSubmit}
          submitting={submitting}
          expenseType={selectedChild.subType}
        />
      );

    default:
      return null;
  }
}

export default PaymentFormRenderer;