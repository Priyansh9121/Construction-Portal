function InvestorForm({
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
          name="investor_name"
          placeholder="Investor Name"
          value={form.investor_name}
          onChange={onChange}
          required
        />
  
        <input
          name="fd_site"
          placeholder="FD / Site"
          value={form.fd_site}
          onChange={onChange}
        />
  
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
          placeholder="Amount"
          value={form.amount}
          onChange={onChange}
          required
        />
  
        <select
          name="payment_mode"
          value={form.payment_mode}
          onChange={onChange}
        >
          <option value="Bank">Bank</option>
          <option value="Cash">Cash</option>
        </select>
  
        <input
          name="interest_percent"
          type="number"
          placeholder="Interest %"
          value={form.interest_percent}
          onChange={onChange}
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
  
  export default InvestorForm;