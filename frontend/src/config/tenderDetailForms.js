/*
 * The Finance tab reads payments rather than tender_finance_records, so
 * the form shape that used to sit here had no screen behind it.
 */

export const emptySubcontractorForm = {
    subcontractor_id: "",
    work_description: "",
    assigned_amount: "",
    status: "active",
  };
  
  export const emptyDocumentForm = {
    document_name: "",
    document_type: "PDF",
    file_url: "",
  };
  
  export const emptyMaterialForm = {
    section_name: "",
    material_name: "",
    quantity: "",
    unit: "",
    rate: "",
    vendor_name: "",
    notes: "",
  };
  
  export const emptyBankingForm = {
    payment_type: "",
    bank_name: "",
    account_name: "",
    account_number: "",
    amount: "",
    gst_amount: "",
    notes: "",
    payment_date: "",
  };