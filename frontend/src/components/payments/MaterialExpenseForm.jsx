function MaterialExpenseForm({ formData, setFormData, onSubmit, submitting }) {
    const update = (field, value) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    };
  
    return (
      <form className="payment-form" onSubmit={onSubmit}>
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
  
        <textarea
          placeholder="Supplier / Bill Details"
          value={formData.details || ""}
          onChange={(e) => update("details", e.target.value)}
        />
  
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Add Material Expense"}
        </button>
      </form>
    );
  }
  
  export default MaterialExpenseForm;