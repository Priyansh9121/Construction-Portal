function InvestorForm({ formData, setFormData, onSubmit, submitting }) {
  const update = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form className="payment-form" onSubmit={onSubmit}>
      <input
        placeholder="Investor Name"
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

      <textarea
        placeholder="Details"
        value={formData.details || ""}
        onChange={(e) => update("details", e.target.value)}
      />

      <button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Add Investor Payment"}
      </button>
    </form>
  );
}

export default InvestorForm;