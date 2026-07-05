function OfficeIncomeForm({ formData, setFormData, onSubmit, submitting }) {
    const update = (field, value) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    };
  
    return (
      <form className="payment-form" onSubmit={onSubmit}>
        <input
          placeholder="Source / Name"
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
  
        <select
          value={formData.payment_mode || "Bank"}
          onChange={(e) => update("payment_mode", e.target.value)}
        >
          <option value="Bank">Bank</option>
          <option value="Cash">Cash</option>
        </select>
  
        <textarea
          placeholder="Details"
          value={formData.details || ""}
          onChange={(e) => update("details", e.target.value)}
        />
  
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Add Office Income"}
        </button>
      </form>
    );
  }
  
  export default OfficeIncomeForm;