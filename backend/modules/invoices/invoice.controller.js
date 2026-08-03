/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The invoices register: amounts billed, their status, and the tender each
| belongs to.
|
| The third and last of the plain registers built from createScopedCrud. It
| is the only one that declares a `references` entry, which is what makes an
| invoice's tender link tenant-safe.
|
| Responsibilities:
|   - Declare the invoices table's writable shape
|   - Declare tender_id as a company-checked foreign key
|   - Re-export the generated handlers under module-specific names
|
| Exports:
|   getInvoices, getInvoiceById, createInvoice, updateInvoice, deleteInvoice
|
|   All pre-wrapped in asyncHandler by the factory.
|
| Used by:
|   ./invoice.routes.js
|
| Depends on:
|   utils/scopedCrud.js
|
| Database tables touched:
|   invoices  — SELECT, INSERT, UPDATE, soft DELETE
|   tenders   — SELECT, by the reference check on create and update
|
| API surface:
|   GET    /api/invoices        list, ?search= ?status= ?tender_id=
|   GET    /api/invoices/:id    exported but not routed — see F-10
|   POST   /api/invoices        create
|   PUT    /api/invoices/:id    update
|   DELETE /api/invoices/:id    soft delete
|
|   Office-only, mounted behind authMiddleware and requireOffice.
|
| Frontend consumers:
|   frontend/src/services/invoiceService.js -> useInvoices.js ->
|   InvoicesPage.jsx
|
| Related:
|   modules/tenders/   the parent record an invoice hangs off
|   modules/payments/  money actually received, as distinct from billed
|
| Note:
|   An invoice records what was BILLED. What was RECEIVED lives in payments.
|   The two are deliberately separate tables, and nothing here reconciles
|   them — an invoice's status is set by hand rather than derived from
|   payments against its tender.
|
*/

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

  // A new invoice is unpaid until someone says otherwise.
  defaults: { status: "pending" },

  /*
   * tender_id as a filter is what backs "show me this tender's invoices" —
   * the Finance tab on a tender detail page reads the list with it set.
   */
  filters: ["status", "tender_id"],

  /*
   * status appears in both `filters` and `searchColumns`, which is
   * redundant but harmless: the filter is an exact match for the dropdown,
   * the search is a substring match for the search box.
   *
   * amount is not searchable. Casting a NUMERIC to TEXT and matching
   * substrings against it gives surprising results — "100" would match
   * 1002.50 and 3100 — so it is left out rather than half-working.
   */
  searchColumns: [
    "invoice_number",
    "status",
  ],

  /*
   * The one reference declared by any register, and the reason invoices
   * needs it: an invoice points at a tender, and without this check a
   * client could post another company's tender_id and create a
   * cross-tenant link. The invoice row itself would still be correctly
   * scoped — company_id comes from the session — but it would reference a
   * tender its own company cannot see.
   *
   * checkReferences runs on both create and update, and answers 404 naming
   * "Tender" when the id does not resolve inside the caller's company.
   *
   * `table: "tenders"` is interpolated into SQL, so it must stay a literal
   * here. See the security note in scopedCrud.js.
   */
  references: [
    {
      column: "tender_id",
      table: "tenders",
      label: "Tender",
    },
  ],

  /*
   * Overrides the factory's default of "id DESC". Equivalent in practice
   * for a serial primary key, but ordering by creation date states the
   * intent — newest invoices first — rather than relying on ids happening
   * to ascend.
   */
  orderBy: "created_at DESC",
});

exports.getInvoices = invoices.list;
exports.getInvoiceById = invoices.getById;
exports.createInvoice = invoices.create;
exports.updateInvoice = invoices.update;
exports.deleteInvoice = invoices.remove;
