const {
  createScopedCrud,
} = require("../../utils/scopedCrud");

/*
|--------------------------------------------------------------------------
| Workers
|--------------------------------------------------------------------------
|
| Built from the company-scoped CRUD factory.
|
| The previous hand-written version listed every company's workers and took
| company_id from the request body on create, which let a client insert a
| worker into another company. Both are structurally impossible here:
| company_id always comes from the session and is always in the WHERE
| clause.
|
*/

const workers = createScopedCrud({
  table: "workers",
  label: "Worker",
  collection: "workers",
  item: "worker",

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
    {
      name: "salary",
      type: "number",
      required: true,
    },
    {
      name: "role",
      type: "text",
      required: true,
    },
    { name: "status", type: "text" },
    { name: "email", type: "text" },
    {
      name: "user_id",
      type: "integer",
    },
    {
      name: "hourly_rate",
      type: "number",
    },
    {
      name: "employment_type",
      type: "text",
    },
    {
      name: "joined_on",
      type: "raw",
    },
    {
      name: "license_number",
      type: "text",
    },
    {
      name: "emergency_contact_name",
      type: "text",
    },
    {
      name: "emergency_contact_phone",
      type: "text",
    },
  ],

  defaults: { status: "active" },

  filters: ["status", "role"],

  searchColumns: [
    "full_name",
    "phone",
    "email",
  ],
});

exports.getWorkers = workers.list;
exports.getWorkerById = workers.getById;
exports.createWorker = workers.create;
exports.updateWorker = workers.update;
exports.deleteWorker = workers.remove;
