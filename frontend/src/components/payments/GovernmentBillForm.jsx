function GovernmentBillForm({ formData, setFormData, onSubmit, submitting }) {
  const update = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const billAmount = Number(formData.amount || 0);
  const chargePercent = Number(formData.interest_percent || 0);
  const chargeAmount = (billAmount * chargePercent) / 100;

  return (
    <form className="payment-form" onSubmit={onSubmit}>
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

      <input
        type="number"
        placeholder="Company Charge Amount"
        value={formData.company_charge_amount || chargeAmount}
        onChange={(e) => update("company_charge_amount", e.target.value)}
      />

      <input
        type="number"
        placeholder="Collected GST"
        value={formData.collected_gst || ""}
        onChange={(e) => update("collected_gst", e.target.value)}
      />

      <textarea
        placeholder="Details"
        value={formData.details || ""}
        onChange={(e) => update("details", e.target.value)}
      />

      <button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Add Government Bill"}
      </button>
    </form>
  );
}

export default GovernmentBillForm;