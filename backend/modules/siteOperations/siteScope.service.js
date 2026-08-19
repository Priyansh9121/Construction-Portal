/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| One question, asked the same way by all four site-operations controllers:
| *which site is this entry for, and does the caller's company own it?*
|
| WHY THIS EXISTS
|
| Every table this module writes carries `site_id` and `tender_id`, and
| until 2026-08-19 every controller declared them `site_id = null` and let
| the null through. The walk that found it recorded 50 bags of cement
| against no site and no tender, and the API answered 201.
|
| That is worse than a refusal. This product's value is per-tender costing,
| so an entry naming no site is a cost that can never be charged to the job
| it was incurred on — and it accumulates silently, one 201 at a time.
|
| WHAT IT GUARANTEES
|
| A resolved site row, owned by the caller's company, or a refusal. And
| because `sites.tender_id` is the authority on which tender a site belongs
| to, the tender is DERIVED here rather than taken from the request body.
| A client cannot file an entry under a site on one tender and a tender id
| from another; if it sends a contradicting `tender_id`, it is told so
| rather than having one of the two silently win.
|
|==========================================================================
*/

const pool = require("../../database/pool");

/**
 * Resolves the site an entry belongs to, or produces the refusal.
 *
 * @param {object}  options
 * @param {*}       options.siteId    site_id from the request body
 * @param {*}       options.tenderId  tender_id from the request body, if any
 * @param {number}  options.companyId the caller's company
 * @param {string}  options.subject   what is being recorded, for the message
 *
 * @returns {Promise<{ site: object } | { error: { status: number, body: object } }>}
 */
const resolveEntrySite = async ({
  siteId,
  tenderId = null,
  companyId,
  subject = "entry",
}) => {
  if (
    siteId === null ||
    siteId === undefined ||
    siteId === ""
  ) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          reason: "SITE_REQUIRED",
          message: `Select the site this ${subject} is for. An entry with no site cannot be costed to a tender.`,
        },
      },
    };
  }

  const numericSiteId = Number(siteId);

  if (
    !Number.isInteger(numericSiteId) ||
    numericSiteId <= 0
  ) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          reason: "SITE_REQUIRED",
          message: "That is not a valid site.",
        },
      },
    };
  }

  const result = await pool.query(
    `
    SELECT id, site_name, tender_id
      FROM sites
     WHERE id = $1
       AND company_id = $2
       AND COALESCE(is_deleted, FALSE) = FALSE
    `,
    [numericSiteId, companyId]
  );

  if (result.rows.length === 0) {
    return {
      error: {
        status: 404,
        body: {
          success: false,
          message: "Site not found.",
        },
      },
    };
  }

  const site = result.rows[0];

  /*
   * A tender in the body is accepted only as agreement. The site row is
   * what decides, so a mismatch is reported rather than resolved — a
   * caller that believes it is filing against tender A while the site
   * sits on tender B has a bug worth surfacing.
   */
  if (
    tenderId !== null &&
    tenderId !== undefined &&
    tenderId !== "" &&
    Number(tenderId) !== Number(site.tender_id)
  ) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message: `${site.site_name} belongs to a different tender than the one supplied.`,
        },
      },
    };
  }

  return { site };
};

module.exports = { resolveEntrySite };
