function LabourExpenseForm({ formData, setFormData, onSubmit, submitting }) {
    const update = (field, value) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    };
  
    return (
      <form className="payment-form" onSubmit={onSubmit}>
        <input
          placeholder="Labour Name / Group"
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
  
        <textarea
          placeholder="Work / Payment Details"
          value={formData.details || ""}
          onChange={(e) => update("details", e.target.value)}
        />
  
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Add Labour Expense"}
        </button>
      </form>
    );
  }
  
  export default LabourExpenseForm;