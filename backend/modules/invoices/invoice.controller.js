const {
  createScopedCrud,
} = require("../../utils/scopedCrud");

/*
|--------------------------------------------------------------------------
| Invoices
|--------------------------------------------------------------------------
|
| Company-scoped CRUD. The previous version listed every company's
| invoices and took company_id from the request body on create.
|
| tender_id is declared as a reference, so an invoice can only be attached
| to a tender in the same company.
|
*/

const invoices = createScopedCrud({
  table: "invoices",
  label: "Invoice",
  collection: "invoices",
  item: "invoice",

  columns: [
    {
      name: "invoice_number",
      type: "text",
      required: true,
    },
    {
      name: "amount",
      type: "number",
      required: true,
    },
    { name: "status", type: "text" },
    {
      name: "tender_id",
      type: "integer",
    },
  ],

  defaults: { status: "pending" },

  filters: ["status", "tender_id"],

  searchColumns: [
    "invoice_number",
    "status",
  ],

  references: [
    {
      column: "tender_id",
      table: "tenders",
      label: "Tender",
    },
  ],

  orderBy: "created_at DESC",
});

exports.getInvoices = invoices.list;
exports.getInvoiceById = invoices.getById;
exports.createInvoice = invoices.create;
exports.updateInvoice = invoices.update;
exports.deleteInvoice = invoices.remove;
