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
 * GET /api/tenders
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