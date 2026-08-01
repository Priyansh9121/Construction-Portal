const {
  createScopedCrud,
} = require("../../utils/scopedCrud");

/*
|--------------------------------------------------------------------------
| Subcontractors
|--------------------------------------------------------------------------
|
| Company-scoped CRUD. The previous version listed every company's
| subcontractors — including their bank details — and accepted company_id
| from the request body on create.
|
| Note the banking columns here are stored in plain text on the
| subcontractors table. worker_sensitive_details exists in the schema with
| encrypted columns for the equivalent worker data; moving subcontractor
| banking behind the same protection is worth doing before this holds real
| account numbers.
|
*/

const subcontractors = createScopedCrud({
  table: "subcontractors",
  label: "Subcontractor",
  collection: "subcontractors",
  item: "subcontractor",

  columns: [
    {
      name: "full_name",
      type: "text",
      required: true,
    },
    {
      name: "phone",
      type: "text",
      required: true,
    },
    { name: "email", type: "text" },
    {
      name: "business_name",
      type: "text",
    },
    {
      name: "gst_number",
      type: "text",
    },
    {
      name: "bank_name",
      type: "text",
    },
    {
      name: "account_name",
      type: "text",
    },
    {
      name: "account_number",
      type: "text",
    },
    {
      name: "ifsc_code",
      type: "text",
    },
    { name: "status", type: "text" },
    {
      name: "user_id",
      type: "integer",
    },
  ],

  defaults: { status: "active" },

  filters: ["status"],

  searchColumns: [
    "full_name",
    "business_name",
    "phone",
    "email",
  ],
});

exports.getSubcontractors =
  subcontractors.list;
exports.getSubcontractorById =
  subcontractors.getById;
exports.createSubcontractor =
  subcontractors.create;
exports.updateSubcontractor =
  subcontractors.update;
exports.deleteSubcontractor =
  subcontractors.remove;
