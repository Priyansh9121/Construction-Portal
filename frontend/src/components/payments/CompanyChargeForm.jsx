function CompanyChargeForm({
    form,
    onChange,
    onSubmit,
    submitLabel,
    showCancel,
    onCancel,
    tenders = [],
  }) {
    const billAmount = Number(form.amount || 0);
    const chargePercent = Number(form.interest_percent || 0);
    const chargeAmount = (billAmount * chargePercent) / 100;
  
    return (
      <form className="payment-form" onSubmit={onSubmit}>
        <select
          name="tender_id"
          value={form.tender_id}
          onChange={onChange}
        >
          <option value="">Select Tender</option>
  
          {tenders.map((tender) => (
            <option key={tender.id} value={tender.id}>
              {tender.title || `Tender ${tender.id}`}
            </option>
          ))}
        </select>
  
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
          name="interest_percent"
          type="number"
          placeholder="Charge %"
          value={form.interest_percent}
          onChange={onChange}
        />
  
        <input
          name="gst_amount"
          type="number"
          placeholder="Charge Amount"
          value={form.gst_amount || chargeAmount}
          onChange={onChange}
        />
  
        <input
          name="collected_gst"
          type="number"
          placeholder="GST Received"
          value={form.collected_gst}
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
  
  export default CompanyChargeForm;