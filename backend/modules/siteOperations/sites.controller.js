/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The site picker for the site-operations screens.
|
| WHY THIS IS NOT /api/sites
|
| `/api/sites` is mounted behind `requireOffice` (server.js), so a
| supervisor gets 403 from it. That guard is correct for the site
| REGISTER — creating, editing and deleting sites is office work.
|
| But every write in this module now requires a site_id, and the role this
| module is built for cannot read the list to choose one. Rather than
| loosen the register's guard, this returns the minimum a picker needs:
| id, name, and which tender the site sits on.
|
| SCOPE
|
| Company-scoped, like everything else here, and open to any authenticated
| caller — the same posture as the recording endpoints it serves. It
| deliberately does NOT narrow a supervisor to their assigned sites:
| `worker_assignments` holds one row across all of production, and the
| assignment form cannot write (see docs/first-tender-walkthrough.md), so
| filtering on it would hand supervisors an empty picker and rebuild the
| wall this module just came out from behind.
|
|==========================================================================
*/

const pool = require("../../database/pool");
const asyncHandler = require("../../utils/asyncHandler");
const {
  requireCompanyId,
} = require("../../utils/requestContext");

/*
|--------------------------------------------------------------------------
| GET /api/site-operations/sites
|--------------------------------------------------------------------------
|
| Response: 200 { success, sites: [{ id, site_name, tender_id,
|                                    tender_title, status }] }
|
*/
exports.listSites = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const result = await pool.query(
      `
      SELECT s.id,
             s.site_name,
             s.status,
             s.tender_id,
             t.title AS tender_title
        FROM sites s
        LEFT JOIN tenders t
               ON t.id = s.tender_id
              AND t.company_id = s.company_id
       WHERE s.company_id = $1
         AND COALESCE(s.is_deleted, FALSE) = FALSE
       ORDER BY t.title NULLS LAST, s.site_name
      `,
      [companyId]
    );

    return res.status(200).json({
      success: true,
      sites: result.rows,
    });
  }
);
