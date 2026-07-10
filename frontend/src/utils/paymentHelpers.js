import { formatCurrency } from "./currency";

export const money = formatCurrency;
  
  export const getSiteName = (sites = [], siteId) => {
    if (!siteId) return "-";
  
    const site = sites.find((item) => item.id === Number(siteId));
  
    return site?.site_name || `Site ${siteId}`;
  };
  
  export const getTenderName = (tenders = [], tenderId) => {
    if (!tenderId) return "-";
  
    const tender = tenders.find((item) => item.id === Number(tenderId));
  
    return tender?.title || `Tender ${tenderId}`;
  };
  
  export const buildPaymentPayload = (form) => {
    let finalGstAmount = Number(form.gst_amount || 0);
  
    if (
      form.payment_sub_type === "COMPANY_CHARGE" &&
      !Number(form.gst_amount || 0)
    ) {
      finalGstAmount =
        (Number(form.amount || 0) * Number(form.interest_percent || 0)) / 100;
    }
  
    return {
      company_id: null,
      payment_type: form.payment_type,
      payment_scope: form.payment_scope,
      payment_sub_type: form.payment_sub_type,
      category: form.category,
      amount: Number(form.amount || 0),
      payment_date: form.payment_date,
      description: form.description || "",
      tender_id: form.tender_id || null,
      site_id: form.site_id || null,
      material_name: form.material_name || null,
      quantity: Number(form.quantity || 0),
      gst_amount: finalGstAmount,
      collected_gst: Number(form.collected_gst || 0),
      payment_mode: form.payment_mode || null,
      details: form.details || null,
      worker_name: form.worker_name || null,
      investor_name: form.investor_name || null,
      interest_percent: Number(form.interest_percent || 0),
      fd_site: form.fd_site || null,
    };
  };