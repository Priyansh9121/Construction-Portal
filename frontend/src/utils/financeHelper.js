import { formatCurrency } from "./currency";

export const money = formatCurrency;

export const getFinanceName = (payment) =>
  payment.investor_name ||
  payment.worker_name ||
  payment.material_name ||
  payment.category ||
  "-";

export const getTenderTitle = (tenders = [], tenderId) => {
  const tender = tenders.find((t) => Number(t.id) === Number(tenderId));
  return tender?.title || tender?.tender_name || "-";
};

export const buildFinancePayload = ({
  formData,
  mainTab,
  selectedSection,
  selectedChild,
  selectedTender,
  selectedTenderId,
  activeSubType,
}) => {
  let gstAmount = Number(formData.gst_amount || 0);

  if (activeSubType === "COMPANY_CHARGE") {
    const amount = Number(formData.amount || 0);
    const percent = Number(formData.interest_percent || 0);
    gstAmount = Number(formData.gst_amount || (amount * percent) / 100);
  }

  return {
    company_id: null,
    payment_type: mainTab,
    payment_scope: selectedSection.scope,
    payment_sub_type: activeSubType,
    category: selectedChild?.label || selectedSection.label,
    tender_id: selectedSection.requiresTender ? selectedTenderId : null,
    site_id: selectedTender?.site_id || null,
    amount: Number(formData.amount || 0),
    payment_date: formData.payment_date,
    gst_amount: gstAmount,
    collected_gst: Number(formData.collected_gst || 0),
    payment_mode: formData.payment_mode || null,
    description: formData.details || "",
    details: formData.details || "",
    investor_name: formData.investor_name || null,
    fd_site: formData.fd_site || null,
    worker_name: formData.worker_name || null,
    material_name: formData.material_name || null,
    quantity: Number(formData.quantity || 0),
    interest_percent: Number(formData.interest_percent || 0),
  };
};

export const mapPaymentToForm = (payment) => ({
  amount: payment.amount || "",
  payment_date: payment.payment_date?.slice(0, 10) || "",
  gst_amount: payment.gst_amount || "",
  collected_gst: payment.collected_gst || "",
  payment_mode: payment.payment_mode || "Bank",
  details: payment.details || payment.description || "",
  investor_name: payment.investor_name || "",
  fd_site: payment.fd_site || "",
  worker_name: payment.worker_name || "",
  material_name: payment.material_name || "",
  quantity: payment.quantity || "",
  interest_percent: payment.interest_percent || "",
});

export const exportToCSV = (filename, rows) => {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((field) => `"${String(row[field] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};