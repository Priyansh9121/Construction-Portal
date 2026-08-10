/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The workers register: the company's roster of labourers and site staff.
|
| Almost the whole file is one declaration. The five CRUD handlers are built
| by createScopedCrud from the table description below, so what this file
| really contains is the ANSWER to five questions — which columns are
| writable, which are required, which can be searched, which can be
| filtered, and what a new row defaults to.
|
| Responsibilities:
|   - Declare the workers table's writable shape
|   - Re-export the generated handlers under module-specific names
|
| Exports:
|   getWorkers, getWorkerById, createWorker, updateWorker, deleteWorker
|
|   All five are already wrapped in asyncHandler by the factory, so
|   worker.routes.js must mount them directly and must NOT wrap them again.
|
| Used by:
|   ./worker.routes.js
|
| Depends on:
|   utils/scopedCrud.js — read its header for how the generated handlers
|   behave: pagination, search, soft delete, and the company scoping that
|   is the point of the factory.
|
| Database tables touched:
|   workers — SELECT, INSERT, UPDATE, soft DELETE
|
| API surface:
|   GET    /api/workers          list, ?search= ?status= ?role= ?limit= ?offset=
|   GET    /api/workers/:id      one worker
|   POST   /api/workers          create
|   PUT    /api/workers/:id      update
|   DELETE /api/workers/:id      soft delete
|
|   All office-only: server.js mounts /api/workers behind authMiddleware
|   and requireOffice, so workers and subcontractors cannot reach their own
|   register. A worker sees their own record through /api/worker-portal.
|
| Frontend consumers:
|   frontend/src/services/workerService.js -> useWorkers.js -> WorkersPage,
|   plus the worker pickers on TenderWorkersTab and the WorkerMoney screens.
|
| Related:
|   modules/workerMoney/  allocations and expenses against these workers
|   modules/workerPortal/ the worker's own view of their record
|   validations/worker.validation.js
|
| Note:
|   The workers table has no created_by column. The factory checks the
|   catalog and omits it rather than failing the INSERT — the bug the
|   hand-written controller had. See getTableColumns in scopedCrud.js.
|
*/

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

  /*
   * The writable columns, in the order they appear in the INSERT.
   *
   * This list is also an allow-list: a key in the request body that is not
   * named here is ignored entirely. That is what stops a client setting
   * company_id, id, is_deleted or created_at directly.
   *
   * `required: true` means the field must be present and truthy on both
   * create and update. Note the truthiness caveat in scopedCrud's create
   * handler — it makes a required numeric column that could legitimately be
   * 0 unworkable, which is why `salary` being required is a mild trap for a
   * genuinely unpaid role.
   *
   * Types drive coercion in coerce(): "text" trims, "number" and "integer"
   * parse, "raw" passes through untouched for the date column.
   */
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
    /*
     * The optional link to a users row, which is what turns a worker record
     * into someone who can sign into the worker portal. Most workers have
     * none — they exist as payroll records only.
     *
     * Note this is NOT declared in `references`, so it is not checked
     * against the company. See the note on the config below.
     */
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
    /*
     * "raw" so the value reaches Postgres untouched and is parsed as a DATE
     * by the driver. Coercing it as text would work, but "number" or
     * "integer" would silently null it, and trimming a date adds nothing.
     */
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

  // A worker created without an explicit status is on the books.
  /*
   * F-11. `defaults: { status: "active" }` stood here and could never fire:
   * validateWorker requires status and rejects with 400 before the factory
   * runs. Removed rather than made reachable — making it reachable changes
   * what the API accepts, which is a policy decision rather than a cleanup.
   */

  /*
   * Query parameters accepted as exact-match filters. Only these two —
   * scopedCrud iterates this allow-list rather than req.query, so no other
   * column can be filtered on from outside.
   *
   * Both back the dropdowns on the Workers screen.
   */
  filters: ["status", "role"],

  /*
   * Columns ?search= matches against, OR-ed together and case-insensitive.
   *
   * The three a person is actually looked up by. Deliberately excludes
   * salary and hourly_rate: they are searchable in principle — the factory
   * casts every column to TEXT — but letting someone find a colleague by
   * typing a wage into a search box is not a feature anyone asked for.
   */
  searchColumns: [
    "full_name",
    "phone",
    "email",
  ],

  /*
   * No `references` entry, so user_id is not verified to belong to this
   * company. In practice the frontend only offers members of the current
   * company, and a mislinked worker would surface immediately in the
   * portal. Worth knowing if this ever becomes settable by an API client
   * rather than through the UI.
   *
   * softDelete and orderBy are left at their defaults: the workers table
   * has is_deleted, and "id DESC" puts the most recently added first.
   */
});

/*
 * Re-exported under module-specific names so the route file reads as
 * intent — `workerController.createWorker` rather than `workers.create` —
 * and so a future hand-written replacement for any one handler can be
 * swapped in here without touching the routes.
 */
exports.getWorkers = workers.list;
exports.getWorkerById = workers.getById;
exports.createWorker = workers.create;
exports.updateWorker = workers.update;
exports.deleteWorker = workers.remove;
