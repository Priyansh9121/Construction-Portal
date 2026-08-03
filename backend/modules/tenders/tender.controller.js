/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The HTTP layer for /api/tenders. Thirty-three handlers, all thin.
|
| Thin is the design. Each one does the same four things: pull the
| company, tender id and user from the request, read the body or query,
| call one service function, and shape the response. No SQL, no business
| rules, no authorisation decisions beyond what the route gate already
| applied.
|
| Everything else lives one layer down:
|
|   tender.routes.js      URLs, roles, audit
|   tender.controller.js  HTTP — request in, response out    <- this file
|   tender.service.js     business rules and orchestration
|   tenderQueries.js      SQL
|   tenderValidation.js   payload rules
|
| Responsibilities:
|   - Resolve companyId, tenderId and userId from the authenticated request
|   - Reject malformed route parameters with a 400 before any work happens
|   - Delegate to tender.service.js
|   - Return { success, ... } with the right status code
|
| Exports (all Express handlers; see tender.routes.js for the URL map):
|   Tender:     getTenders, getTenderStatistics, getTenderById,
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
|   ./tender.routes.js — nothing else should import this
|
| Depends on:
|   utils/requestContext.js  identity and parameter validation
|   ./tender.service.js      every rule and every query
|
| Database tables touched:
|   none directly. All access goes through the service.
|
| Frontend consumers:
|   frontend/src/services/tenderService.js and tenderDetailsService.js
|   -> useTenders.js -> TendersPage.jsx and TenderDetailsPage.jsx
|
| Error handling:
|   No try/catch anywhere in this file, and that is correct. The service
|   throws errors carrying statusCode and publicMessage; asyncHandler on
|   each route forwards them to errorHandler.js, which renders them. A
|   catch here would only be able to make the message worse.
|
| Security:
|   companyId and userId always come from the verified token via
|   requestContext, never from the body or the query string. Every handler
|   passes them down, and the service will not act without them.
|
*/

const {
  requireCompanyId,
  requireParamId,
  getUserId,
} = require("../../utils/requestContext");

const tenderService = require("./tender.service");

/*
|--------------------------------------------------------------------------
| Shared request context
|--------------------------------------------------------------------------
*/

/**
 * Resolves the three identifiers every tender-scoped handler needs.
 *
 * Purpose:
 * Twenty-nine of the handlers below operate on one tender and start with
 * exactly this preamble. Collecting it here means a handler cannot forget
 * the company check, and means an invalid :id is answered with a clean 400
 * before any service or database work happens.
 *
 * Parameters:
 * req, res - the Express pair
 *
 * Returns:
 * { companyId, tenderId, userId }, or null having ALREADY sent a 400. The
 * caller must return immediately on null:
 *
 *   const context = getTenderContext(req, res);
 *   if (!context) return;
 *
 * Forgetting that early return means writing a second response to an
 * already-sent reply.
 *
 * Side effects:
 * May write the response, via requireCompanyId or requireParamId.
 *
 * Security:
 * All three values come from the verified token or the route path, never
 * from the body. companyId in particular is the tenant boundary — see
 * getCompanyId in utils/requestContext.js.
 *
 * Note:
 * userId is read with getUserId rather than a require* helper, so it does
 * not fail the request when absent. It is used for attribution
 * (uploaded_by, deleted_by) rather than for access control, and the
 * service validates it where it matters.
 */
const getTenderContext = (req, res) => {
  const companyId = requireCompanyId(
    req,
    res
  );

  if (!companyId) {
    return null;
  }

  const tenderId = requireParamId(
    req,
    res,
    "id",
    "tender"
  );

  if (!tenderId) {
    return null;
  }

  return {
    companyId,
    tenderId,
    userId: getUserId(req),
  };
};

/**
 * Reads and validates a child-collection id from the route.
 *
 * Purpose:
 * A named wrapper over requireParamId, so the update and delete handlers
 * below read as "get the child id" rather than repeating the generic
 * helper with four positional arguments each time.
 *
 * Parameters:
 * req, res      - the Express pair
 * parameterName - which route parameter to read, e.g. "documentId"
 * label         - the noun for the error message, e.g. "document"
 *
 * Returns:
 * A positive integer, or null having already sent a 400. Callers must
 * return immediately on null, as with getTenderContext.
 *
 * Notes:
 * Currently a pure pass-through and adds no behaviour. It earns its place
 * by giving the child-id step a name at twenty call sites, and by being
 * the single place to change if child ids ever need different handling
 * from tender ids.
 */
const getChildId = (
  req,
  res,
  parameterName,
  label
) =>
  requireParamId(
    req,
    res,
    parameterName,
    label
  );

/*
|--------------------------------------------------------------------------
| Tender register and core operations
|--------------------------------------------------------------------------
*/

/**
 * GET /api/tenders — the tender register.
 *
 * Purpose:
 * Backs TendersPage.jsx. Returns one page of tenders plus the pagination
 * total and the summary statistics, so the screen renders from a single
 * request.
 *
 * Parameters:
 * req - Express request. The whole query string is passed to the service,
 *       which parses and allow-lists it in tenderValidation.
 * res - Express response
 *
 * Returns:
 * 200 { success, tenders, pagination, statistics }
 * 400 when the account has no company
 *
 * Notes:
 * Uses requireCompanyId directly rather than getTenderContext, because
 * there is no :id on this route — the shared helper would reject every
 * request for a missing tender parameter.
 *
 * req.query is forwarded wholesale. That is safe because the service
 * validates it against a fixed filter list; nothing here trusts it.
 */
exports.getTenders = async (
  req,
  res
) => {
  const companyId = requireCompanyId(
    req,
    res
  );

  if (!companyId) {
    return;
  }

  const result =
    await tenderService.listTenders({
      companyId,
      query: req.query,
    });

  return res.status(200).json({
    success: true,
    tenders: result.tenders,
    pagination: result.pagination,
    statistics: result.statistics,
  });
};

/**
 * GET /api/tenders/statistics
 */
exports.getTenderStatistics = async (
  req,
  res
) => {
  const companyId = requireCompanyId(
    req,
    res
  );

  if (!companyId) {
    return;
  }

  const statistics =
    await tenderService.getTenderStatistics({
      companyId,
    });

  return res.status(200).json({
    success: true,
    statistics,
  });
};

/**
 * GET /api/tenders/:id
 */
exports.getTenderById = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const tender =
    await tenderService.getTenderById({
      tenderId: context.tenderId,
      companyId: context.companyId,
    });

  return res.status(200).json({
    success: true,
    tender,
  });
};

/**
 * GET /api/tenders/:id/details
 */
/**
 * GET /api/tenders/:id/details — the tender and every child collection.
 *
 * Purpose:
 * The single request that populates TenderDetailsPage.jsx and all nine of
 * its tabs. Without it the page would fire eight parallel requests on
 * open; with it, switching tabs needs no network at all.
 *
 * Parameters:
 * req - Express request; :id identifies the tender
 * res - Express response
 *
 * Returns:
 * 200 { success, tender, documents, materials, banking, subcontractors,
 *       workers, finance, financeSummary, dailyUpdates }
 * 400 invalid id, or no company on the account
 * 404 no such live tender in this company
 *
 * Notes:
 * The service result is SPREAD into the response rather than nested, so
 * the frontend reads `response.data.documents` rather than
 * `response.data.details.documents`. Worth knowing if the service ever
 * gains a key that collides with `success`.
 *
 * Performance:
 * The largest response the API produces — nine queries' worth, with daily
 * updates unpaginated. Fine for a normal tender; a very long-running job
 * with hundreds of daily logs makes this heavy.
 */
exports.getTenderDetails = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const details =
    await tenderService.getTenderDetails({
      tenderId: context.tenderId,
      companyId: context.companyId,
    });

  return res.status(200).json({
    success: true,
    ...details,
  });
};

/**
 * POST /api/tenders
 */
exports.createTender = async (
  req,
  res
) => {
  const companyId = requireCompanyId(
    req,
    res
  );

  if (!companyId) {
    return;
  }

  const tender =
    await tenderService.createTender({
      companyId,
      userId: getUserId(req),
      payload: req.body,
    });

  return res.status(201).json({
    success: true,
    message:
      "Tender and tender sites created successfully.",
    tender,
  });
};

/**
 * PUT /api/tenders/:id
 */
exports.updateTender = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const tender =
    await tenderService.updateTender({
      tenderId: context.tenderId,
      companyId: context.companyId,
      userId: context.userId,
      payload: req.body,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender updated successfully.",
    tender,
  });
};

/**
 * DELETE /api/tenders/:id
 */
/**
 * DELETE /api/tenders/:id — soft-delete a tender and cascade to its sites.
 *
 * Purpose:
 * Removes a tender from the register without destroying it. Sites,
 * payments, assignments and finance records all reference a tender.
 *
 * Parameters:
 * req - Express request; :id identifies the tender
 * res - Express response
 *
 * Returns:
 * 200 { success, message, tender }
 * 400 invalid id
 * 404 no such live tender in this company
 * 409 active workers or subcontractors are still assigned
 *
 * Side effects:
 * Flags the tender and its live sites as deleted, recording userId as
 * deleted_by on each. Audited as tenders/delete by the route.
 *
 * Business rule:
 * The 409 comes from validateTenderCanBeDeleted in the service — a tender
 * with people still on it must be unassigned first, so the job does not
 * disappear from the portals of those working on it.
 *
 * Reversible through POST /api/tenders/:id/restore.
 */
exports.deleteTender = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const tender =
    await tenderService.deleteTender({
      tenderId: context.tenderId,
      companyId: context.companyId,
      userId: context.userId,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender and associated tender sites deleted successfully.",
    tender,
  });
};

/**
 * POST /api/tenders/:id/restore
 */
exports.restoreTender = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const tender =
    await tenderService.restoreTender({
      tenderId: context.tenderId,
      companyId: context.companyId,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender and associated tender sites restored successfully.",
    tender,
  });
};

/*
|--------------------------------------------------------------------------
| Tender documents
|--------------------------------------------------------------------------
|
| The first of six child collections, and the template for all of them.
| Each exposes four handlers with an identical shape:
|
|   get     context -> service.getX          -> 200 { success, xs }
|   create  context -> service.createX(body) -> 201 { success, x }
|   update  context + child id -> service    -> 200 { success, x }
|   delete  context + child id -> service    -> 200 { success, message }
|                                               404 when nothing matched
|
| Every one begins with getTenderContext and returns early on null. The
| update and delete handlers additionally pull the CHILD id from its own
| route parameter — :documentId, :materialId, :bankingId, :assignmentId,
| :financeId — using requireParamId, so a malformed child id is a 400
| rather than a query that matches nothing.
|
| The service proves tender ownership before touching any child, so a
| child id belonging to another tender answers 404. See
| prepareChildOperation in tender.service.js and F-17.
|
| Only deviations from this shape are documented individually below.
|
*/

/**
 * GET /api/tenders/:id/documents
 */
exports.getDocuments = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const documents =
    await tenderService.getDocuments({
      tenderId: context.tenderId,
      companyId: context.companyId,
    });

  return res.status(200).json({
    success: true,
    documents,
  });
};

/**
 * POST /api/tenders/:id/documents
 */
exports.createDocument = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const document =
    await tenderService.createDocument({
      tenderId: context.tenderId,
      companyId: context.companyId,
      userId: context.userId,
      payload: req.body,
    });

  return res.status(201).json({
    success: true,
    message:
      "Tender document added successfully.",
    document,
  });
};

/**
 * PUT /api/tenders/:id/documents/:documentId
 */
exports.updateDocument = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const documentId = getChildId(
    req,
    res,
    "documentId",
    "document"
  );

  if (!documentId) {
    return;
  }

  const document =
    await tenderService.updateDocument({
      tenderId: context.tenderId,
      documentId,
      companyId: context.companyId,
      payload: req.body,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender document updated successfully.",
    document,
  });
};

/**
 * DELETE /api/tenders/:id/documents/:documentId
 */
exports.deleteDocument = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const documentId = getChildId(
    req,
    res,
    "documentId",
    "document"
  );

  if (!documentId) {
    return;
  }

  const document =
    await tenderService.deleteDocument({
      tenderId: context.tenderId,
      documentId,
      companyId: context.companyId,
      userId: context.userId,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender document deleted successfully.",
    document,
  });
};

/*
|--------------------------------------------------------------------------
| Tender materials
|--------------------------------------------------------------------------
|
| The standard four-handler child shape. Child id parameter: :materialId.
|
| Planned materials for the job, distinct from the deliveries recorded on
| site through /api/site-operations.
|
*/

/**
 * GET /api/tenders/:id/materials
 */
exports.getMaterials = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const materials =
    await tenderService.getMaterials({
      tenderId: context.tenderId,
      companyId: context.companyId,
    });

  return res.status(200).json({
    success: true,
    materials,
  });
};

/**
 * POST /api/tenders/:id/materials
 */
exports.createMaterial = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const material =
    await tenderService.createMaterial({
      tenderId: context.tenderId,
      companyId: context.companyId,
      payload: req.body,
    });

  return res.status(201).json({
    success: true,
    message:
      "Tender material added successfully.",
    material,
  });
};

/**
 * PUT /api/tenders/:id/materials/:materialId
 */
exports.updateMaterial = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const materialId = getChildId(
    req,
    res,
    "materialId",
    "material"
  );

  if (!materialId) {
    return;
  }

  const material =
    await tenderService.updateMaterial({
      tenderId: context.tenderId,
      materialId,
      companyId: context.companyId,
      payload: req.body,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender material updated successfully.",
    material,
  });
};

/**
 * DELETE /api/tenders/:id/materials/:materialId
 */
exports.deleteMaterial = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const materialId = getChildId(
    req,
    res,
    "materialId",
    "material"
  );

  if (!materialId) {
    return;
  }

  const material =
    await tenderService.deleteMaterial({
      tenderId: context.tenderId,
      materialId,
      companyId: context.companyId,
      userId: context.userId,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender material deleted successfully.",
    material,
  });
};

/*
|--------------------------------------------------------------------------
| Tender banking
|--------------------------------------------------------------------------
|
| The standard four-handler child shape. Child id parameter: :bankingId.
|
| Guarantees, deposits and EMD held against the tender. These rows carry
| account_number and ARE audited, which is why account_number was added to
| REDACTED_KEYS in utils/activityLog.js — see F-12.
|
*/

/**
 * GET /api/tenders/:id/banking
 */
exports.getBanking = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const banking =
    await tenderService.getBanking({
      tenderId: context.tenderId,
      companyId: context.companyId,
    });

  return res.status(200).json({
    success: true,
    banking,
  });
};

/**
 * POST /api/tenders/:id/banking
 */
exports.createBanking = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const banking =
    await tenderService.createBanking({
      tenderId: context.tenderId,
      companyId: context.companyId,
      payload: req.body,
    });

  return res.status(201).json({
    success: true,
    message:
      "Tender banking record added successfully.",
    banking,
  });
};

/**
 * PUT /api/tenders/:id/banking/:bankingId
 */
exports.updateBanking = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const bankingId = getChildId(
    req,
    res,
    "bankingId",
    "banking record"
  );

  if (!bankingId) {
    return;
  }

  const banking =
    await tenderService.updateBanking({
      tenderId: context.tenderId,
      bankingId,
      companyId: context.companyId,
      payload: req.body,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender banking record updated successfully.",
    banking,
  });
};

/**
 * DELETE /api/tenders/:id/banking/:bankingId
 */
exports.deleteBanking = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const bankingId = getChildId(
    req,
    res,
    "bankingId",
    "banking record"
  );

  if (!bankingId) {
    return;
  }

  const banking =
    await tenderService.deleteBanking({
      tenderId: context.tenderId,
      bankingId,
      companyId: context.companyId,
      userId: context.userId,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender banking record deleted successfully.",
    banking,
  });
};

/*
|--------------------------------------------------------------------------
| Tender subcontractors
|--------------------------------------------------------------------------
|
| The standard four-handler child shape, with ASSIGN and REMOVE audit
| actions rather than CREATE and DELETE. Child id parameter:
| :assignmentId.
|
| Assigning also grants portal access: /api/subcontractor-portal reads
| these rows to decide which tenders a subcontractor may see.
|
*/

/**
 * GET /api/tenders/:id/subcontractors
 */
exports.getSubcontractors = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const subcontractors =
    await tenderService.getSubcontractors({
      tenderId: context.tenderId,
      companyId: context.companyId,
    });

  return res.status(200).json({
    success: true,
    subcontractors,
  });
};

/**
 * POST /api/tenders/:id/subcontractors
 */
exports.assignSubcontractor = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const assignment =
    await tenderService.assignSubcontractor({
      tenderId: context.tenderId,
      companyId: context.companyId,
      payload: req.body,
    });

  return res.status(201).json({
    success: true,
    message:
      "Subcontractor assigned to tender successfully.",
    assignment,
  });
};

/**
 * PUT /api/tenders/:id/subcontractors/:assignmentId
 */
exports.updateSubcontractor = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const assignmentId = getChildId(
    req,
    res,
    "assignmentId",
    "subcontractor assignment"
  );

  if (!assignmentId) {
    return;
  }

  const assignment =
    await tenderService.updateSubcontractor({
      tenderId: context.tenderId,
      assignmentId,
      companyId: context.companyId,
      payload: req.body,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender subcontractor assignment updated successfully.",
    assignment,
  });
};

/**
 * DELETE /api/tenders/:id/subcontractors/:assignmentId
 */
exports.removeSubcontractor = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const assignmentId = getChildId(
    req,
    res,
    "assignmentId",
    "subcontractor assignment"
  );

  if (!assignmentId) {
    return;
  }

  const assignment =
    await tenderService.removeSubcontractor({
      tenderId: context.tenderId,
      assignmentId,
      companyId: context.companyId,
      userId: context.userId,
    });

  return res.status(200).json({
    success: true,
    message:
      "Subcontractor removed from tender successfully.",
    assignment,
  });
};

/*
|--------------------------------------------------------------------------
| Tender workers
|--------------------------------------------------------------------------
|
| The standard four-handler child shape. Child id parameter: :assignmentId.
|
| Assigning grants worker-portal visibility and lets worker-money records
| be attributed to the job. An active assignment also blocks the tender
| from being deleted.
|
*/

/**
 * GET /api/tenders/:id/workers
 */
exports.getWorkers = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const workers =
    await tenderService.getWorkers({
      tenderId: context.tenderId,
      companyId: context.companyId,
    });

  return res.status(200).json({
    success: true,
    workers,
  });
};

/**
 * POST /api/tenders/:id/workers
 */
exports.assignWorker = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const assignment =
    await tenderService.assignWorker({
      tenderId: context.tenderId,
      companyId: context.companyId,
      userId: context.userId,
      payload: req.body,
    });

  return res.status(201).json({
    success: true,
    message:
      "Worker assigned to tender site successfully.",
    assignment,
  });
};

/**
 * PUT /api/tenders/:id/workers/:assignmentId
 */
exports.updateWorker = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const assignmentId = getChildId(
    req,
    res,
    "assignmentId",
    "worker assignment"
  );

  if (!assignmentId) {
    return;
  }

  const assignment =
    await tenderService.updateWorker({
      tenderId: context.tenderId,
      assignmentId,
      companyId: context.companyId,
      payload: req.body,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender worker assignment updated successfully.",
    assignment,
  });
};

/**
 * DELETE /api/tenders/:id/workers/:assignmentId
 */
exports.removeWorker = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const assignmentId = getChildId(
    req,
    res,
    "assignmentId",
    "worker assignment"
  );

  if (!assignmentId) {
    return;
  }

  const assignment =
    await tenderService.removeWorker({
      tenderId: context.tenderId,
      assignmentId,
      companyId: context.companyId,
      userId: context.userId,
    });

  return res.status(200).json({
    success: true,
    message:
      "Worker removed from tender successfully.",
    assignment,
  });
};

/*
|--------------------------------------------------------------------------
| Tender finance
|--------------------------------------------------------------------------
|
| Five handlers rather than four — getFinanceSummary is additional, and
| its route must stay above any future /finance/:financeId GET. Child id
| parameter: :financeId.
|
| Every write passes through calculateFinanceValues in the service, which
| derives the figures the record type implies.
|
*/

/**
 * GET /api/tenders/:id/finance
 */
exports.getFinanceRecords = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const records =
    await tenderService.getFinanceRecords({
      tenderId: context.tenderId,
      companyId: context.companyId,
    });

  return res.status(200).json({
    success: true,
    records,
  });
};

/**
 * GET /api/tenders/:id/finance/summary
 */
exports.getFinanceSummary = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const summary =
    await tenderService.getFinanceSummary({
      tenderId: context.tenderId,
      companyId: context.companyId,
    });

  return res.status(200).json({
    success: true,
    summary,
  });
};

/**
 * POST /api/tenders/:id/finance
 */
exports.createFinanceRecord = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const record =
    await tenderService.createFinanceRecord({
      tenderId: context.tenderId,
      companyId: context.companyId,
      payload: req.body,
    });

  return res.status(201).json({
    success: true,
    message:
      "Tender finance record created successfully.",
    record,
  });
};

/**
 * PUT /api/tenders/:id/finance/:financeId
 */
exports.updateFinanceRecord = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const financeId = getChildId(
    req,
    res,
    "financeId",
    "finance record"
  );

  if (!financeId) {
    return;
  }

  const record =
    await tenderService.updateFinanceRecord({
      tenderId: context.tenderId,
      financeId,
      companyId: context.companyId,
      payload: req.body,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender finance record updated successfully.",
    record,
  });
};

/**
 * DELETE /api/tenders/:id/finance/:financeId
 */
exports.deleteFinanceRecord = async (
  req,
  res
) => {
  const context = getTenderContext(
    req,
    res
  );

  if (!context) {
    return;
  }

  const financeId = getChildId(
    req,
    res,
    "financeId",
    "finance record"
  );

  if (!financeId) {
    return;
  }

  const record =
    await tenderService.deleteFinanceRecord({
      tenderId: context.tenderId,
      financeId,
      companyId: context.companyId,
      userId: context.userId,
    });

  return res.status(200).json({
    success: true,
    message:
      "Tender finance record deleted successfully.",
    record,
  });
};