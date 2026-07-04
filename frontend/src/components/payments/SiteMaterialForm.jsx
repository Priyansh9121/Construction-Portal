function SiteMaterialForm({
  form,
  onChange,
  onSubmit,
  submitLabel,
  showCancel,
  onCancel,
  tenders = [],
  sites = [],
}) {
  return (
    <form className="payment-form" onSubmit={onSubmit}>
      <select name="site_id" value={form.site_id} onChange={onChange}>
        <option value="">Select Site</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.site_name}
          </option>
        ))}
      </select>

      <select name="tender_id" value={form.tender_id} onChange={onChange}>
        <option value="">Select Tender</option>
        {tenders.map((tender) => (
          <option key={tender.id} value={tender.id}>
            {tender.title}
          </option>
        ))}
      </select>

      <input
        name="material_name"
        placeholder="Material Name"
        value={form.material_name}
        onChange={onChange}
        required
      />

      <input
        name="quantity"
        type="number"
        placeholder="Quantity"
        value={form.quantity}
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

      <input
        name="gst_amount"
        type="number"
        placeholder="GST Amount"
        value={form.gst_amount}
        onChange={onChange}
      />

      <textarea
        name="details"
        placeholder="Supplier / bill details"
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

export default SiteMaterialForm;