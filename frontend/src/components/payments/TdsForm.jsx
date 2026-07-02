function TdsForm({
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
          placeholder="TDS Amount"
          value={form.amount}
          onChange={onChange}
          required
        />
  
        <textarea
          name="details"
          placeholder="Details"
          value={form.details}
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
  
  export default TdsForm;