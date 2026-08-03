/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The business layer for tenders. Sits between the HTTP controller and the
| SQL in tenderQueries.js, and owns every rule that is neither "how a
| request looks" nor "how a row is stored".
|
| Layering:
|
|   tender.routes.js      URLs, roles, audit
|   tender.controller.js  HTTP — request in, response out
|   tender.service.js     business rules and orchestration   <- this file
|   tenderQueries.js      SQL and nothing else
|   tenderValidation.js   payload shape and value rules
|
| Nothing here reads `req` or writes `res`. Functions take plain arguments
| and throw errors carrying statusCode and publicMessage, which
| errorHandler.js turns into responses.
|
| Responsibilities:
|   - Validate the caller's context (company, user, tender id)
|   - Run payload validation from tenderValidation.js
|   - Verify that every referenced record belongs to the caller's company
|   - Compose multi-statement writes inside transactions
|   - Derive finance values through utils/financeCalculations.js
|   - Prove tender ownership BEFORE any child-collection query runs
|
| The last of these matters even though the queries now defend themselves.
| Every child-collection query in tenderQueries.js is company-scoped as of
| F-17, but prepareChildOperation is still what produces the 404 that tells
| a caller the tender is not theirs — without it a cross-tenant request
| would return an empty collection, which reads as "this tender has no
| documents" rather than "this is not your tender".
|
| Exports:
|   Tender:     listTenders, getTenderStatistics, getTenderById,
|               getTenderDetails, createTender, updateTender,
|               deleteTender, restoreTender
|   Documents:  getDocuments, createDocument, updateDocument, deleteDocument
|   Materials:  getMaterials, createMaterial, updateMaterial, deleteMaterial
|   Banking:    getBanking, createBanking, updateBanking, deleteBanking
|   Subs:       getSubcontractors, assignSubcontractor,
|               updateSubcontractor, removeSubcontractor
|   Workers:    getWorkers, assignWorker, updateWorker, removeWorker
|   Finance:    getFinanceRecords, getFinanceSummary, createFinanceRecord,
|               updateFinanceRecord, deleteFinanceRecord
|
| Used by:
|   ./tender.controller.js — the only consumer
|
| Depends on:
|   database/pool.js              for transactions
|   utils/requestContext.js       withTransaction, toPositiveInteger
|   utils/financeCalculations.js  finance derivation
|   ./tenderValidation.js         payload rules
|   ./tenderQueries.js            all SQL
|
| Database tables touched (all through tenderQueries):
|   tenders, sites, clients, tender_documents, tender_materials,
|   tender_banking, tender_subcontractors, worker_assignments,
|   tender_finance_records, daily_site_logs
|
| Error convention:
|   createServiceError attaches statusCode and publicMessage. 400 for a bad
|   payload, 404 for something absent or belonging to another company.
|   Never 403 for a cross-tenant miss — a 403 would confirm the record
|   exists.
|
*/

const pool = require("../../database/pool");

const {
  withTransaction,
  toPositiveInteger,
} = require("../../utils/requestContext");

const {
  calculateFinanceValues,
} = require("../../utils/financeCalculations");

const {
  validateCreateTender,
  validateUpdateTender,
  validateTenderFilters,
  validateTenderDocument,
  validateTenderMaterial,
  validateTenderBanking,
  validateTenderSubcontractor,
  validateTenderWorker,
  validateTenderFinanceRecord,
} = require("./tenderValidation");

const tenderQueries = require("./tenderQueries");

/*
|--------------------------------------------------------------------------
| Shared errors and validation
|--------------------------------------------------------------------------
*/

/**
 * Builds an error the HTTP layer knows how to render.
 *
 * Purpose:
 * Lets this file signal failures without importing Express or knowing
 * about `res`. errorHandler.js reads statusCode for the response code and
 * publicMessage as permission to show the text to a user — an error
 * without publicMessage gets a generic message instead, so a raw database
 * error can never reach the client.
 *
 * Parameters:
 * message    - used as both the Error message and the public message; every
 *              string passed here is written to be user-facing
 * statusCode - defaults to 400, the common case for a rejected payload
 *
 * Returns:
 * An Error, to be thrown by the caller. Deliberately returned rather than
 * thrown so the throw stays visible at the call site.
 */
const createServiceError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.publicMessage = message;

  return error;
};

const requirePositiveId = (
  value,
  label
) => {
  const id = toPositiveInteger(value);

  if (!id) {
    throw createServiceError(
      `Invalid ${label} ID.`
    );
  }

  return id;
};

/**
 * Coerces and validates the identifiers every service call runs on.
 *
 * Purpose:
 * One place that turns the controller's raw values into trusted positive
 * integers, so no function below has to re-check them and none can be
 * reached with a NaN or a string.
 *
 * Parameters (one options object):
 * companyId - required; always from the authenticated session
 * userId    - optional; validated only when supplied
 * tenderId  - optional; validated only when supplied
 *
 * Returns:
 * { companyId, userId, tenderId } with each value either a positive
 * integer or null. Callers use the returned values, not their inputs.
 *
 * Throws:
 * 403 when there is no usable company — the account exists but is not
 *     linked, so the request cannot be scoped to anything
 * 401 when a supplied userId is unusable
 * 400 when a supplied tenderId is not a positive integer
 *
 * Notes:
 * The `!== undefined && !== null` guards distinguish "not supplied" from
 * "supplied but invalid". A plain truthiness check would treat an omitted
 * tenderId the same as tenderId: "abc", and let the second through as
 * null — which would then be silently used in a WHERE clause matching
 * nothing.
 */
const validateServiceContext = ({
  companyId,
  userId = null,
  tenderId = null,
}) => {
  const parsedCompanyId =
    toPositiveInteger(companyId);

  if (!parsedCompanyId) {
    throw createServiceError(
      "Your account is not linked to a company.",
      403
    );
  }

  const parsedUserId =
    userId === undefined ||
    userId === null
      ? null
      : toPositiveInteger(userId);

  if (
    userId !== undefined &&
    userId !== null &&
    !parsedUserId
  ) {
    throw createServiceError(
      "Invalid authenticated user.",
      401
    );
  }

  const parsedTenderId =
    tenderId === undefined ||
    tenderId === null
      ? null
      : toPositiveInteger(tenderId);

  if (
    tenderId !== undefined &&
    tenderId !== null &&
    !parsedTenderId
  ) {
    throw createServiceError(
      "Invalid tender ID."
    );
  }

  return {
    companyId: parsedCompanyId,
    userId: parsedUserId,
    tenderId: parsedTenderId,
  };
};

/**
 * Proves a tender exists and belongs to the caller's company.
 *
 * Purpose:
 * The tenant gate for the whole module. Every child operation runs this
 * before touching a child collection, so a tender that is not the
 * caller's produces a 404 rather than an empty result.
 *
 * Parameters (one options object):
 * tenderId  - already coerced by validateServiceContext
 * companyId - the caller's company
 * client    - pool or transaction client
 * forUpdate - when true, reads through getTenderRecordForUpdate, which
 *             locks the row FOR UPDATE. Use it on any path that will
 *             subsequently write the tender, and pass a transaction
 *             client with it — FOR UPDATE outside a transaction releases
 *             the lock immediately and protects nothing.
 *
 * Returns:
 * The tender row. The canonical shape when forUpdate is false; the
 * tender's own columns only when true.
 *
 * Throws:
 * 404 "Tender not found." when the tender does not exist, is soft-deleted,
 * or belongs to another company.
 *
 * Security:
 * The three cases are deliberately indistinguishable. Answering 403 for
 * another company's tender would confirm the id exists and let a caller
 * enumerate other tenants' tenders by watching which code came back.
 */
const ensureTenderExists = async ({
  tenderId,
  companyId,
  client = pool,
  forUpdate = false,
}) => {
  const tender = forUpdate
    ? await tenderQueries.getTenderRecordForUpdate({
        tenderId,
        companyId,
        client,
      })
    : await tenderQueries.getTenderById({
        tenderId,
        companyId,
        client,
      });

  if (!tender) {
    throw createServiceError(
      "Tender not found.",
      404
    );
  }

  return tender;
};

/*
|--------------------------------------------------------------------------
| Shared finance formatting
|--------------------------------------------------------------------------
|
| Turns the raw aggregate row from getTenderFinanceSummary into the shape
| the frontend renders, and normalises every figure to a number.
|
| The normalisation is not cosmetic: node-pg returns NUMERIC columns as
| STRINGS to avoid precision loss, so a summary passed through untouched
| would give the frontend "1500.00" rather than 1500 — and any arithmetic
| on it would concatenate instead of add.
|
*/

const formatFinanceSummary = (
  summary = {}
) => {
  const investorTotal = Number(
    summary.investor_total || 0
  );

  const governmentBillTotal = Number(
    summary.government_bill_total || 0
  );

  const subcontractorTotal = Number(
    summary.subcontractor_total || 0
  );

  const officeTotal = Number(
    summary.office_total || 0
  );

  const tdsTotal = Number(
    summary.tds_total || 0
  );

  const gstTotal = Number(
    summary.gst_total || 0
  );

  const gstDone = Number(
    summary.gst_done || 0
  );

  const companyChargeTotal = Number(
    summary.company_charge_total || 0
  );

  const companyChargeDone = Number(
    summary.company_charge_done || 0
  );

  const totalIncome = Number(
    summary.total_income || 0
  );

  const totalExpense = Number(
    summary.total_expense || 0
  );

  return {
    investor_total: investorTotal,
    government_bill_total:
      governmentBillTotal,
    subcontractor_total:
      subcontractorTotal,
    office_total: officeTotal,
    tds_total: tdsTotal,

    gst_total: gstTotal,
    gst_done: gstDone,
    gst_left:
      gstTotal - gstDone,

    company_charge_total:
      companyChargeTotal,

    company_charge_done:
      companyChargeDone,

    company_charge_left:
      companyChargeTotal -
      companyChargeDone,

    total_income:
      totalIncome,

    total_expense:
      totalExpense,

    net_profit:
      totalIncome -
      totalExpense,

    overall_done:
      gstDone +
      companyChargeDone,

    overall_left:
      gstTotal -
      gstDone +
      companyChargeTotal -
      companyChargeDone,
  };
};

const normaliseCalculatedFinance = (
  finance
) => {
  const calculated =
    calculateFinanceValues({
      record_type:
        finance.record_type,

      amount:
        finance.amount,

      gst_percent:
        finance.gst_percent,

      gst_total:
        finance.gst_total,

      gst_done:
        finance.gst_done,

      company_charge_percent:
        finance.company_charge_percent,

      company_charge_total:
        finance.company_charge_total,

      company_charge_done:
        finance.company_charge_done,

      tds_amount:
        finance.tds_amount,
    });

  return {
    ...finance,

    amount:
      calculated.amount,

    gst_percent:
      calculated.gst_percent,

    gst_total:
      calculated.gst_total,

    gst_done:
      calculated.gst_done,

    gst_left:
      calculated.gst_left,

    company_charge_percent:
      calculated.company_charge_percent,

    company_charge_total:
      calculated.company_charge_total,

    company_charge_done:
      calculated.company_charge_done,

    company_charge_left:
      calculated.company_charge_left,

    tds_amount:
      calculated.tds_amount,
  };
};

/*
|--------------------------------------------------------------------------
| Company-owned relationship validation
|--------------------------------------------------------------------------
|
| Every foreign key a tender payload can carry — client, site manager,
| subcontractor, worker — is client-supplied, and each is checked here
| before it is written.
|
| Without these a caller could post another tenant's id into one of those
| fields. The row itself would still be correctly scoped, because
| company_id comes from the session, but it would point at a record its
| own company cannot see: a tender whose client name never resolves, or a
| site whose manager is a stranger.
|
| All of them refuse with 404 rather than 403, so a failed check cannot be
| used to confirm that an id exists in another company.
|
| F-16 lived in this group: validateClient's underlying query filtered on
| a column the clients table does not have, so every tender created with a
| client returned a 500. Fixed — see validateClientOwnership in
| tenderQueries.js and tests/tenderClientValidation.test.js.
|
*/

const validateClient = async ({
  clientId,
  companyId,
  client = pool,
}) => {
  if (!clientId) {
    return;
  }

  const valid =
    await tenderQueries.validateClientOwnership({
      clientId,
      companyId,
      client,
    });

  if (!valid) {
    throw createServiceError(
      "The selected client was not found in your company.",
      404
    );
  }
};

const validateSiteManagers = async ({
  sites,
  companyId,
  client = pool,
}) => {
  if (!Array.isArray(sites)) {
    return;
  }

  const managerIds = [
    ...new Set(
      sites
        .map(
          (site) =>
            site.site_manager_id
        )
        .filter(Boolean)
        .map(Number)
    ),
  ];

  if (managerIds.length === 0) {
    return;
  }

  const result = await client.query(
    `
    SELECT id
    FROM public.workers
    WHERE company_id = $1
      AND id = ANY($2::INTEGER[])
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE
    `,
    [
      companyId,
      managerIds,
    ]
  );

  const validIds = new Set(
    result.rows.map(
      ({ id }) => Number(id)
    )
  );

  const invalidManagerId =
    managerIds.find(
      (id) =>
        !validIds.has(id)
    );

  if (invalidManagerId) {
    throw createServiceError(
      `Site manager ${invalidManagerId} was not found in your company.`,
      404
    );
  }
};

const validateExistingSiteOwnership = ({
  submittedSites,
  existingSiteIds,
}) => {
  if (!Array.isArray(submittedSites)) {
    return;
  }

  const validIds = new Set(
    existingSiteIds.map(Number)
  );

  const invalidSite =
    submittedSites.find(
      (site) =>
        site.id &&
        !validIds.has(
          Number(site.id)
        )
    );

  if (invalidSite) {
    throw createServiceError(
      `Tender site ${invalidSite.id} does not belong to this tender.`,
      404
    );
  }
};

const validateFinanceSite = async ({
  siteId,
  tenderId,
  companyId,
  client = pool,
}) => {
  if (!siteId) {
    return;
  }

  const valid =
    await tenderQueries.siteBelongsToTender({
      siteId,
      tenderId,
      companyId,
      client,
    });

  if (!valid) {
    throw createServiceError(
      "The selected site does not belong to this tender.",
      404
    );
  }
};

/*
|--------------------------------------------------------------------------
| Tender site synchronisation
|--------------------------------------------------------------------------
*/

const validateSitesCanBeRemoved = async ({
  siteIds,
  tenderId,
  companyId,
  client,
}) => {
  if (
    !Array.isArray(siteIds) ||
    siteIds.length === 0
  ) {
    return;
  }

  const result = await client.query(
    `
    SELECT
      s.id,

      EXISTS (
        SELECT 1
        FROM public.worker_assignments wa
        WHERE wa.site_id = s.id
          AND wa.tender_id = $2
          AND COALESCE(
            wa.is_deleted,
            FALSE
          ) = FALSE
          AND LOWER(
            COALESCE(
              wa.status,
              'active'
            )
          ) = 'active'
      ) AS has_active_workers,

      EXISTS (
        SELECT 1
        FROM public.daily_site_logs dsl
        WHERE dsl.site_id = s.id
          AND dsl.tender_id = $2
          AND dsl.company_id = $3
          AND COALESCE(
            dsl.is_deleted,
            FALSE
          ) = FALSE
      ) AS has_daily_updates

    FROM public.sites s

    WHERE s.id = ANY(
      $1::INTEGER[]
    )
      AND s.tender_id = $2
      AND s.company_id = $3
    `,
    [
      siteIds,
      tenderId,
      companyId,
    ]
  );

  const blockedSite =
    result.rows.find(
      (site) =>
        site.has_active_workers ||
        site.has_daily_updates
    );

  if (!blockedSite) {
    return;
  }

  const reasons = [];

  if (
    blockedSite.has_active_workers
  ) {
    reasons.push(
      "active worker assignments"
    );
  }

  if (
    blockedSite.has_daily_updates
  ) {
    reasons.push(
      "daily site updates"
    );
  }

  throw createServiceError(
    `Tender site ${blockedSite.id} cannot be removed because it has ${reasons.join(
      " and "
    )}.`,
    409
  );
};

/**
 * Reconciles a tender's sites against a submitted array.
 *
 * Purpose:
 * The Sites tab sends the complete intended set rather than individual
 * add/edit/remove operations, so this works out the difference: rows with
 * an id are updated, rows without one are created, and anything previously
 * present but now absent is soft-deleted.
 *
 * That shape is chosen for the UI's benefit — a user adds two sites,
 * renames one and removes another, then saves once — but it means this
 * function is where a mistake would quietly delete real data.
 *
 * Parameters (one options object):
 * tenderId  - the parent
 * companyId - the caller's company
 * userId    - recorded as deleted_by on removals
 * sites     - the intended set. A non-array is treated as "no change" and
 *             the current sites are returned untouched.
 * client    - the transaction client; this must not run outside one
 *
 * Returns:
 * The resulting site rows.
 *
 * Throws:
 * 404 when a submitted site id is not already a site of THIS tender, or
 * when an update matches nothing.
 *
 * Side effects:
 * One UPDATE per existing site, one INSERT per new one, and a soft delete
 * for each omitted site.
 *
 * Security:
 * validateExistingSiteOwnership is the important guard. A submitted
 * site.id is client-supplied, and without checking it against the tender's
 * own site ids a caller could pass another tender's site id — or another
 * company's — and have it updated through this path. Checking against the
 * fetched id list means an unrecognised id is rejected outright rather
 * than being handed to a query that might match it.
 *
 * Notes:
 * Sequential rather than parallel, deliberately: all these statements
 * share one transaction client, which node-pg serialises anyway, and
 * sequential execution keeps the error attributable to a specific site.
 *
 * The non-array early return is what makes `sites` optional on update —
 * see the note in updateTender about undefined meaning "leave alone".
 */
const synchroniseTenderSites = async ({
  tenderId,
  companyId,
  userId,
  sites,
  client,
}) => {
  if (!Array.isArray(sites)) {
    return tenderQueries.getTenderSites({
      tenderId,
      companyId,
      client,
    });
  }

  const existingSiteIds =
    await tenderQueries.getTenderSiteIds({
      tenderId,
      companyId,
      client,
    });

  validateExistingSiteOwnership({
    submittedSites: sites,
    existingSiteIds,
  });

  await validateSiteManagers({
    sites,
    companyId,
    client,
  });

  const savedSites = [];

  for (const site of sites) {
    if (site.id) {
      const updatedSite =
        await tenderQueries.updateTenderSite({
          siteId: site.id,
          tenderId,
          companyId,
          site,
          client,
        });

      if (!updatedSite) {
        throw createServiceError(
          `Tender site ${site.id} could not be updated.`,
          404
        );
      }

      savedSites.push(
        updatedSite
      );

      continue;
    }

    const createdSite =
      await tenderQueries.insertTenderSite({
        companyId,
        tenderId,
        site,
        client,
      });

    savedSites.push(
      createdSite
    );
  }

  const submittedExistingIds =
    new Set(
      sites
        .filter(
          (site) => site.id
        )
        .map(
          (site) =>
            Number(site.id)
        )
    );

  /*
   * Anything that exists but was not submitted is treated as removed.
   *
   * This is the destructive half of the reconcile, and it is why the
   * caller must send the COMPLETE intended set. A client that sent only
   * the sites it had edited would have every other site deleted — the
   * absence of an id is the delete instruction.
   *
   * A Set for the membership test rather than Array.includes: this runs
   * once per existing site, so the array version would be quadratic.
   */
  const removedSiteIds =
    existingSiteIds.filter(
      (siteId) =>
        !submittedExistingIds.has(
          siteId
        )
    );

  if (removedSiteIds.length > 0) {
    /*
     * Refuse to remove a site with activity recorded against it, rather
     * than orphaning daily logs and payments — the same rule
     * site.controller.js applies to a direct delete, enforced here too so
     * the tender edit screen cannot be used to bypass it.
     */
    await validateSitesCanBeRemoved({
      siteIds:
        removedSiteIds,
      tenderId,
      companyId,
      client,
    });

    await tenderQueries.softDeleteTenderSites({
      tenderId,
      companyId,
      siteIds:
        removedSiteIds,
      deletedBy:
        userId,
      client,
    });
  }

  return savedSites;
};

/*
|--------------------------------------------------------------------------
| Tender register
|--------------------------------------------------------------------------
*/

const listTenders = async ({
  companyId,
  query = {},
}) => {
  const context =
    validateServiceContext({
      companyId,
    });

  const filters =
    validateTenderFilters(query);

  const [
    tenders,
    total,
    statistics,
  ] = await Promise.all([
    tenderQueries.listTenders({
      companyId:
        context.companyId,
      filters,
    }),

    tenderQueries.countTenders({
      companyId:
        context.companyId,
      filters,
    }),

    tenderQueries.getTenderStatistics({
      companyId:
        context.companyId,
    }),
  ]);

  return {
    tenders,

    pagination: {
      total,
      limit:
        filters.limit,
      offset:
        filters.offset,
      returned:
        tenders.length,

      has_more:
        filters.offset +
          tenders.length <
        total,
    },

    statistics:
      formatTenderStatistics(
        statistics
      ),
  };
};

const formatTenderStatistics = (
  statistics = {}
) => ({
  total_tenders: Number(
    statistics.total_tenders ||
      0
  ),

  total_tender_value: Number(
    statistics.total_tender_value ||
      0
  ),

  running_tenders: Number(
    statistics.running_tenders ||
      0
  ),

  pending_tenders: Number(
    statistics.pending_tenders ||
      0
  ),

  completed_tenders: Number(
    statistics.completed_tenders ||
      0
  ),

  passed_tenders: Number(
    statistics.passed_tenders ||
      0
  ),
});

const getTenderStatistics = async ({
  companyId,
}) => {
  const context =
    validateServiceContext({
      companyId,
    });

  const statistics =
    await tenderQueries.getTenderStatistics({
      companyId:
        context.companyId,
    });

  return formatTenderStatistics(
    statistics
  );
};

/*
|--------------------------------------------------------------------------
| Tender reads
|--------------------------------------------------------------------------
*/

const getTenderById = async ({
  tenderId,
  companyId,
}) => {
  const context =
    validateServiceContext({
      tenderId,
      companyId,
    });

  return ensureTenderExists({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
  });
};

const getTenderDetails = async ({
  tenderId,
  companyId,
}) => {
  const context =
    validateServiceContext({
      tenderId,
      companyId,
    });

  const details =
    await tenderQueries.getCompleteTenderDetails({
      tenderId:
        context.tenderId,
      companyId:
        context.companyId,
    });

  if (!details) {
    throw createServiceError(
      "Tender not found.",
      404
    );
  }

  return {
    ...details,

    finance_summary:
      formatFinanceSummary(
        details.finance_summary
      ),
  };
};

/*
|--------------------------------------------------------------------------
| Tender creation and update
|--------------------------------------------------------------------------
*/

/**
 * Creates a tender together with its initial sites.
 *
 * Purpose:
 * A tender is not usable without at least one site — tenderValidation
 * enforces that — so the two are created as one unit rather than leaving
 * the caller to make a second request that might not arrive.
 *
 * Parameters (one options object):
 * companyId - the caller's company, from the session
 * userId    - the acting user
 * payload   - the request body, validated by validateCreateTender
 *
 * Returns:
 * The created tender in the canonical shape, sites array included.
 *
 * Throws:
 * 400 from validation; 404 when the client or a site manager is not the
 * caller's.
 *
 * Side effects:
 * One INSERT into tenders, one per site, and a final read — all inside one
 * transaction.
 *
 * Business rules:
 * - Ownership of every referenced record is checked BEFORE anything is
 *   written, so a bad reference cannot leave a half-built tender behind.
 * - company_id comes from the session and is passed explicitly to each
 *   insert; it is never read from the payload.
 *
 * Notes:
 * The sites are inserted sequentially rather than with Promise.all. That
 * is correct, not an oversight: they share one transaction client, and
 * node-pg serialises statements on a single client anyway — issuing them
 * concurrently would gain nothing and makes error attribution worse.
 *
 * The closing getTenderById re-reads through the transaction client so the
 * response has the same shape as every other tender read, including the
 * aggregated sites array that the inserts above do not return.
 */
const createTender = async ({
  companyId,
  userId,
  payload,
}) => {
  const context =
    validateServiceContext({
      companyId,
      userId,
    });

  const validated =
    validateCreateTender(
      payload
    );

  return withTransaction(
    async (client) => {
      await validateClient({
        clientId:
          validated.tender
            .client_id,
        companyId:
          context.companyId,
        client,
      });

      await validateSiteManagers({
        sites:
          validated.sites,
        companyId:
          context.companyId,
        client,
      });

      const tender =
        await tenderQueries.insertTender({
          companyId:
            context.companyId,
          tender:
            validated.tender,
          client,
        });

      for (
        const site of validated.sites
      ) {
        await tenderQueries.insertTenderSite({
          companyId:
            context.companyId,
          tenderId:
            tender.id,
          site,
          client,
        });
      }

      return tenderQueries.getTenderById({
        tenderId:
          tender.id,
        companyId:
          context.companyId,
        client,
      });
    }
  );
};

/**
 * Updates a tender and, when supplied, reconciles its sites.
 *
 * Purpose:
 * The edit path for the tender record itself. Sites are optional here: the
 * frontend sends them when the Sites tab was touched and omits them
 * otherwise.
 *
 * Parameters (one options object):
 * tenderId  - the tender to edit
 * companyId - the caller's company
 * userId    - the acting user, recorded on any site deletions
 * payload   - the request body
 *
 * Returns:
 * The updated tender in canonical shape.
 *
 * Throws:
 * 400 from validation; 404 when the tender, the client or a site manager
 * is not the caller's.
 *
 * Side effects:
 * A locking read, one UPDATE, optionally several site writes, and a final
 * read — all in one transaction.
 *
 * Concurrency:
 * `forUpdate: true` locks the tender row for the transaction. This is a
 * read-modify-write — validateUpdateTender merges the payload onto the
 * existing row — so without the lock two simultaneous edits would both
 * read the same before-state and the second would silently discard the
 * first user's changes.
 *
 * Business rules:
 * - The tender is loaded and locked BEFORE validation, because
 *   validateUpdateTender needs the existing row to fill in omitted fields.
 *   That ordering is what makes a partial update possible.
 * - `sites === undefined` means "leave the sites alone"; an empty array
 *   means "remove them all". The check is for undefined specifically, not
 *   truthiness, so the two cases stay distinguishable.
 * - The 404 after updateTender is defensive. The row was locked moments
 *   earlier so it cannot have vanished, but the query returns null on no
 *   match and returning that as success would report a write that did not
 *   happen.
 */
const updateTender = async ({
  tenderId,
  companyId,
  userId,
  payload,
}) => {
  const context =
    validateServiceContext({
      tenderId,
      companyId,
      userId,
    });

  return withTransaction(
    async (client) => {
      const existingTender =
        await ensureTenderExists({
          tenderId:
            context.tenderId,
          companyId:
            context.companyId,
          client,
          forUpdate: true,
        });

      const validated =
        validateUpdateTender(
          payload,
          existingTender
        );

      await validateClient({
        clientId:
          validated.tender
            .client_id,
        companyId:
          context.companyId,
        client,
      });

      const updatedTender =
        await tenderQueries.updateTender({
          tenderId:
            context.tenderId,
          companyId:
            context.companyId,
          tender:
            validated.tender,
          client,
        });

      if (!updatedTender) {
        throw createServiceError(
          "Tender could not be updated.",
          404
        );
      }

      if (
        validated.sites !==
        undefined
      ) {
        await synchroniseTenderSites({
          tenderId:
            context.tenderId,
          companyId:
            context.companyId,
          userId:
            context.userId,
          sites:
            validated.sites,
          client,
        });
      }

      return tenderQueries.getTenderById({
        tenderId:
          context.tenderId,
        companyId:
          context.companyId,
        client,
      });
    }
  );
};

/*
|--------------------------------------------------------------------------
| Tender deletion and restoration
|--------------------------------------------------------------------------
*/

/**
 * Refuses to delete a tender that still has people assigned to it.
 *
 * Purpose:
 * Deleting a tender with active workers or subcontractors on it would
 * strand those assignments — and, more visibly, would make the job vanish
 * from the worker and subcontractor portals of people still working on it.
 * The office is asked to unassign first, which makes the intent explicit.
 *
 * Parameters (one options object):
 * tenderId - the tender being deleted
 * client   - the transaction client
 *
 * Returns:
 * Nothing. Throws if the tender cannot be deleted.
 *
 * Throws:
 * 409 naming what is still attached, so the user knows what to clear.
 *
 * Side effects:
 * One SELECT.
 *
 * Notes:
 * Both EXISTS subqueries test "live AND active" — a soft-deleted
 * assignment, or one whose status is anything other than active, does not
 * block the delete. COALESCE(status, 'active') treats a null status as
 * active, matching how the rest of the codebase reads that column.
 *
 * Two EXISTS in one statement rather than two queries: cheaper, and the
 * answers cannot disagree with each other.
 *
 * Note this checks assignments only. Payments and finance records against
 * the tender do NOT block deletion — they are historical facts that
 * survive the tender being archived, and the soft delete keeps the
 * reference resolvable.
 */
const validateTenderCanBeDeleted =
  async ({
    tenderId,
    client,
  }) => {
    const result =
      await client.query(
        `
        SELECT
          EXISTS (
            SELECT 1
            FROM public.worker_assignments
            WHERE tender_id = $1
              AND COALESCE(
                is_deleted,
                FALSE
              ) = FALSE
              AND LOWER(
                COALESCE(
                  status,
                  'active'
                )
              ) = 'active'
          ) AS has_active_workers,

          EXISTS (
            SELECT 1
            FROM public.tender_subcontractors
            WHERE tender_id = $1
              AND COALESCE(
                is_deleted,
                FALSE
              ) = FALSE
              AND LOWER(
                COALESCE(
                  status,
                  'active'
                )
              ) = 'active'
          ) AS has_active_subcontractors
        `,
        [tenderId]
      );

    const blockers = [];

    if (
      result.rows[0]
        ?.has_active_workers
    ) {
      blockers.push(
        "active worker assignments"
      );
    }

    if (
      result.rows[0]
        ?.has_active_subcontractors
    ) {
      blockers.push(
        "active subcontractor assignments"
      );
    }

    if (blockers.length > 0) {
      throw createServiceError(
        `Tender cannot be deleted while it has ${blockers.join(
          " and "
        )}.`,
        409
      );
    }
  };

/**
 * Soft-deletes a tender and cascades to its sites.
 *
 * Purpose:
 * Removes a tender from the register without destroying it. Sites,
 * payments, assignments and finance records all reference a tender, so a
 * hard delete would orphan them.
 *
 * Parameters (one options object):
 * tenderId  - the tender
 * companyId - the caller's company
 * userId    - recorded as deleted_by on the tender and each site
 *
 * Returns:
 * The soft-deleted tender row.
 *
 * Throws:
 * 404 when the tender is not the caller's; 409 from
 * validateTenderCanBeDeleted when something still depends on it.
 *
 * Side effects:
 * Flags the tender and all its live sites as deleted, in one transaction.
 *
 * Business rules:
 * - The dependency check runs before anything is written, so a refused
 *   delete leaves no partial state.
 * - Sites cascade because they are meaningless without their tender and
 *   would otherwise linger in every site picker with no parent.
 * - Reversible through restoreTender. That is the point of soft deletion
 *   here — a tender carries too much history for an accidental delete to
 *   be acceptable.
 *
 * Notes:
 * Sites are deleted BEFORE the tender. Either order works inside a
 * transaction, but this way the cascade cannot be left half-done if the
 * tender delete throws — and softDeleteAllTenderSites deliberately skips
 * sites that were already deleted, so restore can be reasonably accurate.
 */
const deleteTender = async ({
  tenderId,
  companyId,
  userId,
}) => {
  const context =
    validateServiceContext({
      tenderId,
      companyId,
      userId,
    });

  return withTransaction(
    async (client) => {
      await ensureTenderExists({
        tenderId:
          context.tenderId,
        companyId:
          context.companyId,
        client,
        forUpdate: true,
      });

      await validateTenderCanBeDeleted({
        tenderId:
          context.tenderId,
        client,
      });

      await tenderQueries.softDeleteAllTenderSites({
        tenderId:
          context.tenderId,
        companyId:
          context.companyId,
        deletedBy:
          context.userId,
        client,
      });

      const tender =
        await tenderQueries.softDeleteTender({
          tenderId:
            context.tenderId,
          companyId:
            context.companyId,
          deletedBy:
            context.userId,
          client,
        });

      if (!tender) {
        throw createServiceError(
          "Tender could not be deleted.",
          404
        );
      }

      return tender;
    }
  );
};

/**
 * Restores a soft-deleted tender and its sites.
 *
 * Purpose:
 * The undo for deleteTender, reached through
 * POST /api/tenders/:id/restore.
 *
 * Parameters (one options object):
 * tenderId  - the tender to restore
 * companyId - the caller's company
 *
 * Returns:
 * The restored tender in canonical shape.
 *
 * Throws:
 * 404 when no such tender exists in this company;
 * 409 when it is not actually deleted.
 *
 * Side effects:
 * Clears the deletion flags on the tender and on its deleted sites, in one
 * transaction.
 *
 * Notes:
 * Reads with `includeDeleted: true` rather than through ensureTenderExists.
 * It has to: ensureTenderExists excludes soft-deleted rows, and the whole
 * point here is to address one.
 *
 * The "already active" case is 409 rather than a silent success, so a
 * double-click on Restore reports honestly instead of implying it did
 * something.
 *
 * Takes no userId, unlike deleteTender — there is no restored_by column to
 * record it in. The act is captured in the audit trail instead, via
 * logActivity("tenders", RESTORE) on the route.
 *
 * Known limitation: restoring brings back every deleted site under the
 * tender, including any deleted individually beforehand. See
 * restoreAllTenderSites in tenderQueries.js.
 */
const restoreTender = async ({
  tenderId,
  companyId,
}) => {
  const context =
    validateServiceContext({
      tenderId,
      companyId,
    });

  return withTransaction(
    async (client) => {
      const existingTender =
        await tenderQueries.getTenderById({
          tenderId:
            context.tenderId,
          companyId:
            context.companyId,
          client,
          includeDeleted: true,
        });

      if (!existingTender) {
        throw createServiceError(
          "Tender not found.",
          404
        );
      }

      if (
        !existingTender.is_deleted
      ) {
        throw createServiceError(
          "Tender is already active.",
          409
        );
      }

      const restoredTender =
        await tenderQueries.restoreTender({
          tenderId:
            context.tenderId,
          companyId:
            context.companyId,
          client,
        });

      if (!restoredTender) {
        throw createServiceError(
          "Tender could not be restored.",
          404
        );
      }

      await tenderQueries.restoreAllTenderSites({
        tenderId:
          context.tenderId,
        companyId:
          context.companyId,
        client,
      });

      return tenderQueries.getTenderById({
        tenderId:
          context.tenderId,
        companyId:
          context.companyId,
        client,
      });
    }
  );
};

/*
|--------------------------------------------------------------------------
| Shared child-record context
|--------------------------------------------------------------------------
|
| prepareChildOperation and the per-collection ownership checks. Everything
| below this point depends on them having run.
|
*/

/**
 * The standard preamble for every child-collection operation.
 *
 * Purpose:
 * Two steps that must always happen together and in this order: validate
 * the identifiers, then prove the tender is the caller's. Twenty-odd
 * functions below start with this call, which is why the guarantee holds
 * uniformly instead of depending on each one remembering.
 *
 * Parameters (one options object):
 * tenderId, companyId, userId - passed to validateServiceContext
 * client                      - pool or transaction client
 *
 * Returns:
 * The validated context { companyId, userId, tenderId }. Callers must use
 * these coerced values rather than their own inputs — that is the point of
 * returning them.
 *
 * Throws:
 * Whatever validateServiceContext throws (403 / 401 / 400), or 404 from
 * ensureTenderExists.
 *
 * Side effects:
 * One SELECT for the ownership check.
 *
 * Security:
 * Defence in depth alongside the queries' own scoping.
 *
 * Since F-17 every child query in tenderQueries.js filters on company_id
 * itself, so removing this call would no longer leak another tenant's
 * rows. It would still be wrong: the caller would receive an empty
 * collection and a 200 instead of a 404, which says "this tender has no
 * materials" rather than "this tender is not yours".
 *
 * Keep both. The query filter is the guarantee; this is the correct
 * answer.
 *
 * Notes:
 * Deliberately does NOT take forUpdate. Child operations lock the child
 * row, not the parent tender; locking every tender on a document edit
 * would serialise unrelated work on the same job.
 */
const prepareChildOperation = async ({
  tenderId,
  companyId,
  userId = null,
  client = pool,
}) => {
  const context =
    validateServiceContext({
      tenderId,
      companyId,
      userId,
    });

  await ensureTenderExists({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
    client,
  });

  return context;
};

/*
|--------------------------------------------------------------------------
| Tender documents
|--------------------------------------------------------------------------
|
| The first of six child collections. All six follow the same three-step
| shape, and it is worth reading once here rather than in twenty-four
| near-identical doc blocks:
|
|   1. prepareChildOperation({ tenderId, companyId, userId })
|      Validates the identifiers and proves the tender belongs to the
|      caller, throwing 404 if not. This is the tenant gate — see F-17 for
|      why it is load-bearing rather than merely tidy.
|
|   2. validateTenderX(payload)
|      Shape and value rules from tenderValidation.js. Throws 400.
|
|   3. tenderQueries.xxxTenderX({ ...context, ... })
|      The single statement. Always passed the COERCED values from the
|      returned context, never the raw arguments.
|
| Reads skip step 2. Deletes skip it too and return the affected row, so
| the controller can answer 404 when nothing matched.
|
| Only deviations from this shape are documented individually below.
|
| Documents specifically: uploadedBy is recorded from the session, so a
| document always names the real uploader rather than whoever the payload
| claims.
|
*/

const getDocuments = async ({
  tenderId,
  companyId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  return tenderQueries.getTenderDocuments({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
  });
};

const createDocument = async ({
  tenderId,
  companyId,
  userId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
      userId,
    });

  const document =
    validateTenderDocument(
      payload
    );

  return tenderQueries.insertTenderDocument({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
    uploadedBy:
      context.userId,
    document,
  });
};

const updateDocument = async ({
  tenderId,
  documentId,
  companyId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const id =
    requirePositiveId(
      documentId,
      "document"
    );

  const document =
    validateTenderDocument(
      payload
    );

  const updated =
    await tenderQueries.updateTenderDocument({
      documentId: id,
      tenderId:
        context.tenderId,
      document,
    });

  if (!updated) {
    throw createServiceError(
      "Tender document not found.",
      404
    );
  }

  return updated;
};

const deleteDocument = async ({
  tenderId,
  documentId,
  companyId,
  userId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
      userId,
    });

  const id =
    requirePositiveId(
      documentId,
      "document"
    );

  const deleted =
    await tenderQueries.softDeleteTenderDocument({
      documentId: id,
      tenderId:
        context.tenderId,
      deletedBy:
        context.userId,
    });

  if (!deleted) {
    throw createServiceError(
      "Tender document not found.",
      404
    );
  }

  return deleted;
};

/*
|--------------------------------------------------------------------------
| Tender materials
|--------------------------------------------------------------------------
*/

const getMaterials = async ({
  tenderId,
  companyId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  return tenderQueries.getTenderMaterials({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
  });
};

const createMaterial = async ({
  tenderId,
  companyId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const material =
    validateTenderMaterial(
      payload
    );

  return tenderQueries.insertTenderMaterial({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
    material,
  });
};

const updateMaterial = async ({
  tenderId,
  materialId,
  companyId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const id =
    requirePositiveId(
      materialId,
      "material"
    );

  const material =
    validateTenderMaterial(
      payload
    );

  const updated =
    await tenderQueries.updateTenderMaterial({
      materialId: id,
      tenderId:
        context.tenderId,
      material,
    });

  if (!updated) {
    throw createServiceError(
      "Tender material not found.",
      404
    );
  }

  return updated;
};

const deleteMaterial = async ({
  tenderId,
  materialId,
  companyId,
  userId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
      userId,
    });

  const id =
    requirePositiveId(
      materialId,
      "material"
    );

  const deleted =
    await tenderQueries.softDeleteTenderMaterial({
      materialId: id,
      tenderId:
        context.tenderId,
      deletedBy:
        context.userId,
    });

  if (!deleted) {
    throw createServiceError(
      "Tender material not found.",
      404
    );
  }

  return deleted;
};

/*
|--------------------------------------------------------------------------
| Tender banking
|--------------------------------------------------------------------------
*/

const getBanking = async ({
  tenderId,
  companyId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  return tenderQueries.getTenderBanking({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
  });
};

const createBanking = async ({
  tenderId,
  companyId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const banking =
    validateTenderBanking(
      payload
    );

  return tenderQueries.insertTenderBanking({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
    banking,
  });
};

const updateBanking = async ({
  tenderId,
  bankingId,
  companyId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const id =
    requirePositiveId(
      bankingId,
      "banking record"
    );

  const banking =
    validateTenderBanking(
      payload
    );

  const updated =
    await tenderQueries.updateTenderBanking({
      bankingId: id,
      tenderId:
        context.tenderId,
      banking,
    });

  if (!updated) {
    throw createServiceError(
      "Tender banking record not found.",
      404
    );
  }

  return updated;
};

const deleteBanking = async ({
  tenderId,
  bankingId,
  companyId,
  userId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
      userId,
    });

  const id =
    requirePositiveId(
      bankingId,
      "banking record"
    );

  const deleted =
    await tenderQueries.softDeleteTenderBanking({
      bankingId: id,
      tenderId:
        context.tenderId,
      deletedBy:
        context.userId,
    });

  if (!deleted) {
    throw createServiceError(
      "Tender banking record not found.",
      404
    );
  }

  return deleted;
};

/*
|--------------------------------------------------------------------------
| Tender subcontractors
|--------------------------------------------------------------------------
|
| The standard child shape, plus two extra checks before an assignment is
| created — these rows join two records that both already exist:
|
|   subcontractorBelongsToCompany  the subcontractor must be the caller's,
|                                  or the assignment would point at
|                                  another tenant's record
|   tenderSubcontractorExists      the same subcontractor cannot be
|                                  assigned to the same tender twice; the
|                                  schema does not enforce it
|
| Assigning is also a grant of ACCESS, not only a commercial record:
| /api/subcontractor-portal reads these rows to decide which tenders a
| subcontractor may see. Removing an assignment revokes that visibility.
|
*/

const getSubcontractors = async ({
  tenderId,
  companyId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  return tenderQueries.getTenderSubcontractors({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
  });
};

const assignSubcontractor = async ({
  tenderId,
  companyId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const assignment =
    validateTenderSubcontractor(
      payload
    );

  const valid =
    await tenderQueries.subcontractorBelongsToCompany({
      subcontractorId:
        assignment.subcontractor_id,
      companyId:
        context.companyId,
    });

  if (!valid) {
    throw createServiceError(
      "Subcontractor not found in your company.",
      404
    );
  }

  const exists =
    await tenderQueries.tenderSubcontractorExists({
      tenderId:
        context.tenderId,
      subcontractorId:
        assignment.subcontractor_id,
    });

  if (exists) {
    throw createServiceError(
      "Subcontractor is already assigned to this tender.",
      409
    );
  }

  return tenderQueries.insertTenderSubcontractor({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
    assignment,
  });
};

const updateSubcontractor = async ({
  tenderId,
  assignmentId,
  companyId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const id =
    requirePositiveId(
      assignmentId,
      "subcontractor assignment"
    );

  const assignment =
    validateTenderSubcontractor(
      payload,
      {
        requireSubcontractorId:
          false,
      }
    );

  const updated =
    await tenderQueries.updateTenderSubcontractor({
      assignmentId: id,
      tenderId:
        context.tenderId,
      assignment,
    });

  if (!updated) {
    throw createServiceError(
      "Tender subcontractor assignment not found.",
      404
    );
  }

  return updated;
};

const removeSubcontractor = async ({
  tenderId,
  assignmentId,
  companyId,
  userId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
      userId,
    });

  const id =
    requirePositiveId(
      assignmentId,
      "subcontractor assignment"
    );

  const deleted =
    await tenderQueries.softDeleteTenderSubcontractor({
      assignmentId: id,
      tenderId:
        context.tenderId,
      deletedBy:
        context.userId,
    });

  if (!deleted) {
    throw createServiceError(
      "Tender subcontractor assignment not found.",
      404
    );
  }

  return deleted;
};

/*
|--------------------------------------------------------------------------
| Tender worker assignments
|--------------------------------------------------------------------------
|
| The mirror of tender subcontractors, with the same two extra guards:
| workerBelongsToCompany and workerAssignmentExists.
|
| These rows drive three things beyond the tender page — which tenders a
| worker sees in /api/worker-portal, how worker-money allocations and
| expenses are attributed to a job, and whether validateTenderCanBeDeleted
| lets the tender be deleted at all.
|
*/

const getWorkers = async ({
  tenderId,
  companyId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  return tenderQueries.getTenderWorkers({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
  });
};

const assignWorker = async ({
  tenderId,
  companyId,
  userId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
      userId,
    });

  const assignment =
    validateTenderWorker(
      payload
    );

  const workerValid =
    await tenderQueries.workerBelongsToCompany({
      workerId:
        assignment.worker_id,
      companyId:
        context.companyId,
    });

  if (!workerValid) {
    throw createServiceError(
      "Worker not found in your company.",
      404
    );
  }

  const siteValid =
    await tenderQueries.siteBelongsToTender({
      siteId:
        assignment.site_id,
      tenderId:
        context.tenderId,
      companyId:
        context.companyId,
    });

  if (!siteValid) {
    throw createServiceError(
      "The selected site does not belong to this tender.",
      404
    );
  }

  const exists =
    await tenderQueries.workerAssignmentExists({
      tenderId:
        context.tenderId,
      siteId:
        assignment.site_id,
      workerId:
        assignment.worker_id,
    });

  if (exists) {
    throw createServiceError(
      "Worker is already assigned to this tender site.",
      409
    );
  }

  return tenderQueries.insertTenderWorker({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
    assignedBy:
      context.userId,
    assignment,
  });
};

const updateWorker = async ({
  tenderId,
  assignmentId,
  companyId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const id =
    requirePositiveId(
      assignmentId,
      "worker assignment"
    );

  const assignment =
    validateTenderWorker(
      payload,
      {
        requireAssignmentIds:
          false,
      }
    );

  const updated =
    await tenderQueries.updateTenderWorker({
      assignmentId: id,
      tenderId:
        context.tenderId,
      assignment,
    });

  if (!updated) {
    throw createServiceError(
      "Tender worker assignment not found.",
      404
    );
  }

  return updated;
};

const removeWorker = async ({
  tenderId,
  assignmentId,
  companyId,
  userId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
      userId,
    });

  const id =
    requirePositiveId(
      assignmentId,
      "worker assignment"
    );

  const deleted =
    await tenderQueries.softDeleteTenderWorker({
      assignmentId: id,
      tenderId:
        context.tenderId,
      deletedBy:
        context.userId,
    });

  if (!deleted) {
    throw createServiceError(
      "Tender worker assignment not found.",
      404
    );
  }

  return deleted;
};

/*
|--------------------------------------------------------------------------
| Tender finance
|--------------------------------------------------------------------------
|
| The standard child shape, with one addition: every write passes the
| validated payload through calculateFinanceValues from
| utils/financeCalculations.js, which derives the GST, company-charge and
| TDS figures the record type implies and recomputes the two outstanding
| balances.
|
| That derivation happens HERE rather than in the query, so create and
| update cannot disagree about what "GST left" means — see the header of
| financeCalculations.js.
|
| getFinanceRecords and getFinanceSummary pass companyId through to their
| queries, which filter on it directly. That was added in F-17; before it
| they relied entirely on prepareChildOperation having proven ownership.
|
*/

const getFinanceRecords = async ({
  tenderId,
  companyId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  return tenderQueries.getTenderFinanceRecords({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
  });
};

const getFinanceSummary = async ({
  tenderId,
  companyId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const summary =
    await tenderQueries.getTenderFinanceSummary({
      tenderId:
        context.tenderId,
      companyId:
        context.companyId,
    });

  return formatFinanceSummary(
    summary
  );
};

const createFinanceRecord = async ({
  tenderId,
  companyId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const validated =
    validateTenderFinanceRecord(
      payload
    );

  await validateFinanceSite({
    siteId:
      validated.site_id,
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
  });

  const finance =
    normaliseCalculatedFinance(
      validated
    );

  return tenderQueries.insertTenderFinanceRecord({
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
    finance,
  });
};

const updateFinanceRecord = async ({
  tenderId,
  financeId,
  companyId,
  payload,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
    });

  const id =
    requirePositiveId(
      financeId,
      "finance record"
    );

  const validated =
    validateTenderFinanceRecord(
      payload
    );

  await validateFinanceSite({
    siteId:
      validated.site_id,
    tenderId:
      context.tenderId,
    companyId:
      context.companyId,
  });

  const finance =
    normaliseCalculatedFinance(
      validated
    );

  const updated =
    await tenderQueries.updateTenderFinanceRecord({
      financeId: id,
      tenderId:
        context.tenderId,
      finance,
    });

  if (!updated) {
    throw createServiceError(
      "Tender finance record not found.",
      404
    );
  }

  return updated;
};

const deleteFinanceRecord = async ({
  tenderId,
  financeId,
  companyId,
  userId,
}) => {
  const context =
    await prepareChildOperation({
      tenderId,
      companyId,
      userId,
    });

  const id =
    requirePositiveId(
      financeId,
      "finance record"
    );

  const deleted =
    await tenderQueries.softDeleteTenderFinanceRecord({
      financeId: id,
      tenderId:
        context.tenderId,
      deletedBy:
        context.userId,
    });

  if (!deleted) {
    throw createServiceError(
      "Tender finance record not found.",
      404
    );
  }

  return deleted;
};

/*
|--------------------------------------------------------------------------
| Public service API
|--------------------------------------------------------------------------
*/

module.exports = {
  listTenders,
  getTenderStatistics,
  getTenderById,
  getTenderDetails,

  createTender,
  updateTender,
  deleteTender,
  restoreTender,

  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,

  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,

  getBanking,
  createBanking,
  updateBanking,
  deleteBanking,

  getSubcontractors,
  assignSubcontractor,
  updateSubcontractor,
  removeSubcontractor,

  getWorkers,
  assignWorker,
  updateWorker,
  removeWorker,

  getFinanceRecords,
  getFinanceSummary,
  createFinanceRecord,
  updateFinanceRecord,
  deleteFinanceRecord,
};