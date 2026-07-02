function GovernmentBillForm({
    form,
    onChange,
    onSubmit,
    submitLabel,
    showCancel,
    onCancel,
  }) {
    return (
      <form className="payment-form" onSubmit={onSubmit}>
        <input
          name="payment_date"
          type="date"
          value={form.payment_date}
          onChange={onChange}
          required
        />
  
        <input
          name="amount"
          type="number"
          placeholder="Bill Amount"
          value={form.amount}
          onChange={onChange}
          required
        />
  
        <input
          name="gst_amount"
          type="number"
          placeholder="GST Amount"
          value={form.gst_amount}
          onChange={onChange}
        />
  
        <input
          name="collected_gst"
          type="number"
          placeholder="Collected GST"
          value={form.collected_gst}
          onChange={onChange}
        />
  
        <button type="submit">{submitLabel}</button>
  
        {showCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </form>
    );
  }
  
  export default GovernmentBillForm;