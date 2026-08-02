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

  const removedSiteIds =
    existingSiteIds.filter(
      (siteId) =>
        !submittedExistingIds.has(
          siteId
        )
    );

  if (removedSiteIds.length > 0) {
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