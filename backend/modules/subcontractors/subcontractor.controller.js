/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The subcontractors register: the firms and individuals the company
| engages, together with the banking details they are paid through.
|
| Structurally identical to the workers register — one createScopedCrud
| declaration and five re-exports — but with a materially different risk
| profile, because this table holds bank account numbers. See the security
| note below and the banner that follows.
|
| Responsibilities:
|   - Declare the subcontractors table's writable shape
|   - Re-export the generated handlers under module-specific names
|
| Exports:
|   getSubcontractors, getSubcontractorById, createSubcontractor,
|   updateSubcontractor, deleteSubcontractor
|
|   All five arrive pre-wrapped in asyncHandler from the factory.
|
| Used by:
|   ./subcontractor.routes.js
|
| Depends on:
|   utils/scopedCrud.js
|
| Database tables touched:
|   subcontractors — SELECT, INSERT, UPDATE, soft DELETE
|
| API surface:
|   GET    /api/subcontractors        list, ?search= ?status=
|   GET    /api/subcontractors/:id    one subcontractor
|   POST   /api/subcontractors        create
|   PUT    /api/subcontractors/:id    update
|   DELETE /api/subcontractors/:id    soft delete
|
|   Office-only: mounted behind authMiddleware and requireOffice, so a
|   subcontractor cannot read this register — including their own row.
|   Their own view is /api/subcontractor-portal.
|
| Frontend consumers:
|   frontend/src/services/subcontractorService.js -> SubcontractorsPage,
|   and the subcontractor picker on TenderSubcontractorsTab.
|
| Related:
|   modules/subcontractorPortal/  the subcontractor's own view
|   modules/payments/             payments made to these records
|
| Security:
|   Four columns here — bank_name, account_name, account_number,
|   ifsc_code — are payment credentials stored in plain text. The office
|   gate is the only thing protecting them, and any admin or manager can
|   read the full list. The equivalent worker data is encrypted in
|   worker_sensitive_details. See the banner below.
|
*/

const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  requireParamId,
  getUserRole,
  sendNotFound,
  sendForbidden,
  cleanLowerText,
} = require("../../utils/requestContext");

const {
  createScopedCrud,
} = require("../../utils/scopedCrud");

const {
  maskFinancialFields,
} = require("../../utils/maskSensitive");

/*
|--------------------------------------------------------------------------
| Who may see full payment details
|--------------------------------------------------------------------------
|
| Administrators only.
|
| The register itself is office-only, so a manager can already list
| subcontractors, create them and edit their contact details. What a
| manager does NOT get is the account number — reading a counterparty's
| payment credentials is a narrower need than managing the register, and
| least privilege says the two should not be the same permission.
|
| A manager editing a subcontractor is unaffected: omitted fields keep
| their stored values through the factory's COALESCE, so an edit that never
| saw the banking values cannot blank them.
|
| Checked against BOTH users.role and company_users.role, matching
| roleMiddleware's "either" source everywhere else — a user who is an admin
| through their company membership alone is still an admin here.
|
*/
const FINANCIAL_DETAIL_ROLES = new Set(["admin"]);

/**
 * Whether this caller may see unmasked payment details.
 *
 * Parameters:
 * req - the Express request, after authMiddleware
 *
 * Returns:
 * Boolean.
 *
 * Security:
 * Reads only from req.user, which authMiddleware populated from a verified
 * token and a fresh database read. Nothing here consults the request body
 * or query.
 */
const canSeeFinancialDetails = (req) => {
  const accountRole = getUserRole(req);

  const companyRole = cleanLowerText(
    req.user?.company_role
  );

  return (
    FINANCIAL_DETAIL_ROLES.has(accountRole) ||
    FINANCIAL_DETAIL_ROLES.has(companyRole)
  );
};

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
    /*
     * Banking details, in plain text.
     *
     * These four are returned in full by the list endpoint — scopedCrud
     * selects `t.*`, so every subcontractor's account number is in the
     * payload behind the Subcontractors screen, not merely on the detail
     * view.
     *
     * They are also excluded from the audit trail only by accident of
     * naming: activityLog's REDACTED_KEYS covers encrypted_account_number
     * and encrypted_bsb, not these column names. Nothing currently audits
     * this module, so no rows are written — but a logActivity added to
     * subcontractor.routes.js would start copying account numbers into
     * activity_logs.
     *
     * Recorded as F-12 in docs/repository-reference/findings.md.
     */
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

  /*
   * Strip the raw payment identifiers from every response this factory
   * produces — list, create and update alike (F-12).
   *
   * Applied uniformly rather than to the list alone: masking the list but
   * echoing the full value back from the create response would leak it the
   * moment a record was saved, which is exactly when the client is least
   * likely to notice.
   *
   * Full values are served only by getSubcontractorById below, behind the
   * administrator gate.
   */
  transformRow: maskFinancialFields,

  // A newly added subcontractor is engaged unless stated otherwise.
  defaults: { status: "active" },

  /*
   * Only status. Unlike workers there is no role dimension here — a
   * subcontractor is a counterparty, not a job title.
   */
  filters: ["status"],

  /*
   * The four identifying fields. business_name is included because a
   * subcontractor is as often looked up by their trading name as by the
   * contact's own name.
   *
   * Note what is absent: account_number and ifsc_code are NOT searchable.
   * That is deliberate — a searchable account number would let anyone with
   * office access confirm whether a given account is on file by probing
   * the search box, which is a disclosure the list view at least makes
   * obvious.
   */
  searchColumns: [
    "full_name",
    "business_name",
    "phone",
    "email",
  ],
});


/*
|--------------------------------------------------------------------------
| GET /api/subcontractors/:id — the full record
|--------------------------------------------------------------------------
|
| Auth:     required; office-only at the mount
| Roles:    administrator, for the unmasked payment details
| Params:   :id
| Response: 200 { success, subcontractor }  full account number and IFSC
|           400 invalid id
|           403 authenticated, in the right company, but not permitted to
|               see payment details
|           404 no such live subcontractor in THIS company
|
| Why this exists (F-12):
| The list endpoint used to return every counterparty's account number,
| because the Subcontractors screen populates its edit form and detail
| modal straight from the list response. The list is now masked, so this is
| where the real values come from — one record at a time, for one role.
|
| ORDER OF CHECKS, which matters:
|
|   1. company scope   404 if the record is not this company's
|   2. role            403 if the caller may not see financial details
|
| The company check runs FIRST and deliberately. Answering 403 for another
| tenant's id would confirm that the id exists — a caller could enumerate
| other companies' subcontractors by watching which code came back. A
| non-existent id and another company's id must be indistinguishable, and
| both are 404.
|
| The 403 is only ever reachable for a record the caller's own company
| owns, so it discloses nothing beyond "you personally may not see this".
|
*/
const getSubcontractorById = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const id = requireParamId(
      req,
      res,
      "id",
      "subcontractor"
    );

    if (!id) return;

    /*
     * Scoped on company_id, so another tenant's id matches nothing. The
     * projection names its columns rather than using t.* — a column added
     * to this table later should not start appearing in a response by
     * default.
     */
    const result = await pool.query(
      `
      SELECT
        id,
        company_id,
        full_name,
        phone,
        email,
        business_name,
        gst_number,
        bank_name,
        account_name,
        account_number,
        ifsc_code,
        status,
        user_id,
        created_at,
        updated_at
      FROM public.subcontractors
      WHERE id = $1
        AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE
      LIMIT 1
      `,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Subcontractor"
      );
    }

    /*
     * Existence is established before permission is considered, so the
     * 403 below can never be used to probe for records in another company.
     */
    if (!canSeeFinancialDetails(req)) {
      return sendForbidden(
        res,
        "You do not have permission to view subcontractor payment details."
      );
    }

    return res.status(200).json({
      success: true,
      subcontractor: result.rows[0],
    });
  }
);

/*
 * Re-exported under module-specific names, matching worker.controller.js.
 * Unlike that module, all five are actually routed here.
 */
exports.getSubcontractors =
  subcontractors.list;
/*
 * The hand-written detail handler, NOT the factory's getById.
 *
 * The factory version would return a masked row like the list does, which
 * is the opposite of what this endpoint is for. Exported under the same
 * name so the route file reads unchanged.
 */
exports.getSubcontractorById =
  getSubcontractorById;
exports.createSubcontractor =
  subcontractors.create;
exports.updateSubcontractor =
  subcontractors.update;
exports.deleteSubcontractor =
  subcontractors.remove;
