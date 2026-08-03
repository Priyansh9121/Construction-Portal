/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Daily site updates: the record that a given worker or subcontractor was
| at a given site on a given day, with notes and an optional photo.
|
| This is the office's view of the daily log — read, create and remove.
| Supervisors submit their own updates through /api/worker-portal and
| /api/site-operations, and those go through the approval queue in
| modules/dailyUpdateApprovals.
|
| The rule that gives this module its character is the backdating window:
| an update may be recorded for today or the recent past, but not for the
| future, and not further back than the configured window unless the
| caller is exempt or holds a granted access request for that date.
|
| Responsibilities:
|   - List logs, filtered by site, tender and date range
|   - Create a log, after checking every supplied foreign key
|   - Enforce the no-future and backdating-window rules
|   - Soft-delete a log
|
| Exports (all Express handlers, all wrapped in asyncHandler here):
|   getSiteLogs, createSiteLog, deleteSiteLog
|
|   There is no update handler. A daily log is a record of what happened on
|   a day; correcting one means deleting it and adding another, which the
|   audit trail then shows as two acts rather than a silent revision.
|
| Used by:
|   ./siteLog.routes.js
|
| Depends on:
|   database/pool.js
|   utils/asyncHandler.js
|   utils/requestContext.js
|   modules/siteOperations/entryWindow.service.js — the backdating rule
|
| Database tables touched:
|   daily_site_logs  SELECT, INSERT, UPDATE (soft delete)
|   sites            SELECT, ownership check and the name join
|   tenders          SELECT, ownership check and the title join
|   workers          SELECT, name join only
|   subcontractors   SELECT, name join only
|
| API surface:
|   GET    /api/site-logs      ?site_id= ?tender_id= ?from_date= ?to_date=
|   POST   /api/site-logs
|   DELETE /api/site-logs/:id
|
|   Office-only, mounted behind authMiddleware and requireOffice.
|
| Frontend consumers:
|   frontend/src/services/siteLogService.js -> useSiteLogs.js ->
|   DailySiteUpdatesPage.jsx, and TenderDailyProgressTab.jsx
|
| Related:
|   modules/dailyUpdateApprovals/  the approval queue for supervisor updates
|   modules/siteOperations/        entryWindow.service.js, which applies the
|                                  same backdating idea to material, labour
|                                  and banking entries
|
| Note:
|   The whole backdating decision — date arithmetic AND the permission
|   rule — is delegated to checkEntryWindow in entryWindow.service.js.
|   F-13, fixed in two parts:
|
|     the DATE side, so "today" is resolved in the configured timezone
|     rather than the server's;
|
|     the PERMISSION side, so this handler no longer carries its own
|     `role !== "admin"` check. Managers and holders of a granted access
|     request are now recognised here exactly as they are for material,
|     labour and banking entries.
|
|   There is one implementation of the rule, and no role name or
|   grant lookup appears in this file.
|
*/

const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  getUserId,
  getUserRole,
  requireParamId,
  sendNotFound,
  cleanText,
} = require("../../utils/requestContext");

/*
 * No config/env import here any more. The window length and the grace
 * period are read by entryWindow.service.js, which now owns the whole
 * decision — see F-13.
 */

/*
 * The canonical entry-window rule, shared with the site-operations
 * modules. Owns the whole backdating decision: what "today" is in the
 * configured timezone, how old an entry is, which roles bypass the window,
 * and whether a granted access request covers the date.
 *
 * Delegating to it rather than re-deriving the rule here is F-13.
 */
const {
  checkEntryWindow,
  consumeGrant,
  MODULES,
} = require("../siteOperations/entryWindow.service");

/*
|--------------------------------------------------------------------------
| Tenant scoping
|--------------------------------------------------------------------------
|
| daily_site_logs carries company_id. Every statement below filters on it.
|
| The previous implementation listed logs with no company filter at all and
| deleted by id alone, so any authenticated user could read and destroy
| another company's site history.
|
*/

/**
 * Confirms a site belongs to the caller's company.
 *
 * createSiteLog previously took site_id straight from the request body and
 * inserted without checking, which let a user write a log into another
 * company's site.
 *
 * Parameters:
 * siteId    - the client-supplied site
 * companyId - the caller's company, from the session
 *
 * Returns:
 * A promise of boolean. False for a missing site, another company's site,
 * or a soft-deleted one.
 *
 * Side effects:
 * One SELECT.
 *
 * Security:
 * The insert below would otherwise happily write a correctly-scoped log row
 * pointing at a site in another tenant. company_id on the log would be
 * right; site_id would not.
 *
 * Note:
 * Duplicates companyRecordExists from utils/requestContext.js, which does
 * exactly this and is used elsewhere. Left as found.
 */
const siteBelongsToCompany = async (
  siteId,
  companyId
) => {
  const result = await pool.query(
    `
    SELECT id
    FROM sites
    WHERE id = $1
      AND company_id = $2
      AND COALESCE(is_deleted, FALSE) = FALSE
    `,
    [siteId, companyId]
  );

  return result.rows.length > 0;
};

/**
 * Confirms a tender belongs to the caller's company.
 *
 * Parameters:
 * tenderId  - the client-supplied tender; optional on a log
 * companyId - the caller's company
 *
 * Returns:
 * A promise of boolean.
 *
 * Side effects:
 * One SELECT.
 *
 * Notes:
 * Called only when tender_id is actually supplied, since a log need not
 * belong to a tender — site work is not always billable to one.
 *
 * worker_id and subcontractor_id get NO equivalent check, even though both
 * are also client-supplied foreign keys. See F-14 in findings.md.
 */
const tenderBelongsToCompany = async (
  tenderId,
  companyId
) => {
  const result = await pool.query(
    `
    SELECT id
    FROM tenders
    WHERE id = $1
      AND company_id = $2
      AND COALESCE(is_deleted, FALSE) = FALSE
    `,
    [tenderId, companyId]
  );

  return result.rows.length > 0;
};

/*
|--------------------------------------------------------------------------
| GET /api/site-logs
|--------------------------------------------------------------------------
|
| Auth:     required
| Roles:    admin, manager (at the mount)
| Query:    ?site_id= ?tender_id= ?from_date= ?to_date= ?limit= ?offset=
| Response: 200 { success, siteLogs, pagination }
|           400 the account has no company
|
| The four filters combine, so "this site, this month" is one request.
| from_date and to_date are inclusive bounds on log_date.
|
| Each row is denormalised with the site, worker, subcontractor and tender
| names, so the table renders from one response rather than resolving four
| sets of ids afterwards.
|
| Ordered newest first, by log_date then id — the id breaks ties between
| several updates recorded for the same day, keeping paging stable.
|
*/
exports.getSiteLogs = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const conditions = [
      "dsl.company_id = $1",
      "COALESCE(dsl.is_deleted, FALSE) = FALSE",
    ];

    const values = [companyId];

    if (req.query.site_id) {
      values.push(
        req.query.site_id
      );

      conditions.push(
        `dsl.site_id = $${values.length}`
      );
    }

    if (req.query.tender_id) {
      values.push(
        req.query.tender_id
      );

      conditions.push(
        `dsl.tender_id = $${values.length}`
      );
    }

    if (req.query.from_date) {
      values.push(
        req.query.from_date
      );

      conditions.push(
        `dsl.log_date >= $${values.length}`
      );
    }

    if (req.query.to_date) {
      values.push(req.query.to_date);

      conditions.push(
        `dsl.log_date <= $${values.length}`
      );
    }

    const limit = Math.min(
      Number(req.query.limit) ||
        100,
      500
    );

    const offset = Math.max(
      Number(req.query.offset) || 0,
      0
    );

    values.push(limit, offset);

    const result = await pool.query(
      `
      SELECT
        dsl.id,
        dsl.site_id,
        s.site_name,
        dsl.worker_id,
        w.full_name AS worker_name,
        dsl.subcontractor_id,
        sc.full_name AS subcontractor_name,
        dsl.tender_id,
        t.title AS tender_title,
        dsl.log_date,
        dsl.notes,
        dsl.photo_url,
        dsl.created_at,
        COUNT(*) OVER () AS total_count
      FROM daily_site_logs dsl
      /*
       * Every join is LEFT and every one repeats the company_id condition.
       *
       * LEFT because each of these references is optional or may point at a
       * since-deleted record, and an inner join would make the whole log
       * row disappear rather than merely lose a name.
       *
       * The company_id condition on each join is what contains F-14: a log
       * carrying another company's worker_id resolves to NULL here instead
       * of leaking that worker's name. Putting these conditions in the
       * WHERE clause instead would convert the joins to inner ones and hide
       * such rows entirely.
       */
      LEFT JOIN sites s
        ON s.id = dsl.site_id
       AND s.company_id = dsl.company_id
      LEFT JOIN workers w
        ON w.id = dsl.worker_id
       AND w.company_id = dsl.company_id
      LEFT JOIN subcontractors sc
        ON sc.id = dsl.subcontractor_id
       AND sc.company_id = dsl.company_id
      LEFT JOIN tenders t
        ON t.id = dsl.tender_id
       AND t.company_id = dsl.company_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY dsl.log_date DESC, dsl.id DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values
    );

    return res.status(200).json({
      success: true,
      siteLogs: result.rows,
      pagination: {
        limit,
        offset,
        total: Number(
          result.rows[0]
            ?.total_count || 0
        ),
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/site-logs
|--------------------------------------------------------------------------
|
| Auth:     required
| Roles:    admin, manager (at the mount)
| Body:     site_id and log_date required; one of worker_id or
|           subcontractor_id required; tender_id, notes, photo_url and
|           photo_source optional
| Response: 201 { success, siteLog }
|           400 missing fields, or a future date
|           403 backdated beyond the window, by a non-admin
|           404 the site or tender is not this company's
|
| Business rules, in the order checked:
|   1. A log needs a site and a date.
|   2. A log must name a worker OR a subcontractor — an update about nobody
|      records nothing. Both may be given.
|   3. The site must be this company's; the tender too, if supplied.
|   4. The date may not be in the future.
|   5. It may not be older than the configured window, unless the caller
|      is exempt (admin or manager) or holds a granted access request for
|      that exact date. checkEntryWindow decides all of this.
|
| Order matters: the cheap body checks run before the two ownership
| queries, so a malformed request costs no database work.
|
| Note:
| photo_source is accepted and echoed back in the response but never
| stored — there is no such column. See the comment at the response.
|
*/
exports.createSiteLog = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const {
      site_id,
      tender_id = null,
      worker_id = null,
      subcontractor_id = null,
      log_date,
      notes,
      photo_url,
      photo_source = "unknown",
    } = req.body;

    if (!site_id || !log_date) {
      return res.status(400).json({
        success: false,
        message:
          "Site and log date are required.",
      });
    }

    if (
      !worker_id &&
      !subcontractor_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Worker or subcontractor is required.",
      });
    }

    // Ownership checks on every client-supplied foreign key.
    if (
      !(await siteBelongsToCompany(
        site_id,
        companyId
      ))
    ) {
      return sendNotFound(
        res,
        "Site"
      );
    }

    if (
      tender_id &&
      !(await tenderBelongsToCompany(
        tender_id,
        companyId
      ))
    ) {
      return sendNotFound(
        res,
        "Tender"
      );
    }

    /*
     * The backdating decision, delegated in full to entryWindow.service.js.
     *
     * F-13. This handler used to compute the age itself and then apply its
     * own `role !== "admin"` check, which diverged from the canonical rule
     * in two ways: it measured against the SERVER's midnight rather than
     * the site's, and it recognised neither managers nor granted access
     * requests.
     *
     * checkEntryWindow answers all of it in one call — invalid date, future
     * date, inside the window, exempt role, or a usable grant — and returns
     * the status code and message to reply with. The material, labour and
     * banking controllers already worked this way; daily updates now do
     * too, so there is one implementation of the rule rather than two.
     *
     * MODULES.DAILY_UPDATE scopes any access grant to this module, so a
     * grant issued to backdate a material entry does not also permit a
     * backdated daily update.
     */
    const windowCheck =
      await checkEntryWindow({
        companyId,
        userId: getUserId(req),
        userRole: getUserRole(req),
        module: MODULES.DAILY_UPDATE,
        entryDate: log_date,
      });

    if (!windowCheck.allowed) {
      return res
        .status(windowCheck.status)
        .json({
          success: false,
          message:
            windowCheck.message,
          reason: windowCheck.reason,
          days_old:
            windowCheck.daysOld,
        });
    }

    const result = await pool.query(
      `
      INSERT INTO daily_site_logs
      (
        company_id,
        site_id,
        tender_id,
        worker_id,
        subcontractor_id,
        log_date,
        notes,
        photo_url,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        companyId,
        site_id,
        tender_id || null,
        worker_id || null,
        subcontractor_id || null,
        log_date,
        cleanText(notes),
        photo_url || null,
        getUserId(req),
      ]
    );

    /*
     * Mark the access grant used, if one authorised this entry.
     *
     * A no-op when the entry was allowed on its own merits — inside the
     * window, or by an exempt role — because checkEntryWindow returns a
     * null accessRequestId in those cases.
     *
     * Done AFTER the insert on purpose: consuming a grant for a row that
     * then failed to write would burn the supervisor's permission and
     * leave them needing to ask again.
     */
    await consumeGrant(
      windowCheck.accessRequestId,
      companyId
    );

    /*
     * photo_source is spread onto the response but was never inserted —
     * daily_site_logs has no such column. The client sends it (to say
     * whether a photo came from the camera or the gallery), and it is
     * echoed straight back so the UI can render the record it just created
     * without a refetch.
     *
     * It does not survive. Reloading the page loses it, because the next
     * GET reads from the table.
     */
    return res.status(201).json({
      success: true,
      siteLog: {
        ...result.rows[0],
        photo_source,
      },
    });
  }
);

/*
|--------------------------------------------------------------------------
| DELETE /api/site-logs/:id
|--------------------------------------------------------------------------
|
| Auth:     required
| Roles:    admin, manager (at the mount)
| Params:   :id
| Response: 200 { success, message }
|           400 invalid id
|           404 no such live log in this company
|
| Soft, and recording who did it in deleted_by — a daily update is part of
| the site's history, and the fact that one was withdrawn is itself worth
| keeping.
|
| Note there is no window rule on deletion. A supervisor cannot ADD an
| update older than the window, but an office user can remove one of any
| age. That asymmetry is deliberate: the window exists to stop history
| being invented after the fact, not to stop it being corrected.
|
| Re-deleting an already-deleted log matches no row and returns 404, since
| the WHERE clause requires it to still be live.
|
*/
exports.deleteSiteLog = asyncHandler(
  async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) {
      return;
    }

    const logId = requireParamId(
      req,
      res,
      "id",
      "site log"
    );

    if (!logId) {
      return;
    }

    const result = await pool.query(
      `
      UPDATE daily_site_logs
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $3
      WHERE id = $1
        AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING id
      `,
      [
        logId,
        companyId,
        getUserId(req),
      ]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        "Site log"
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Site log deleted successfully.",
    });
  }
);
