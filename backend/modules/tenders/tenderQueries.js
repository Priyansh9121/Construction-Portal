const pool = require("../../database/pool");

/*
|--------------------------------------------------------------------------
| Tender select fragments
|--------------------------------------------------------------------------
|
| These fragments remain private to this file.
| The service imports query functions only.
|
*/

const TENDER_SITE_JSON = `
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'company_id', s.company_id,
        'tender_id', s.tender_id,
        'site_name', s.site_name,
        'site_type', s.site_type,
        'address', s.address,
        'status', s.status,
        'progress_percent', s.progress_percent,
        'last_update_at', s.last_update_at,
        'city', s.city,
        'state', s.state,
        'postcode', s.postcode,
        'country', s.country,
        'start_date', s.start_date,
        'expected_finish_date', s.expected_finish_date,
        'actual_finish_date', s.actual_finish_date,
        'site_manager_id', s.site_manager_id,
        'budget', s.budget,
        'created_at', s.created_at,
        'updated_at', s.updated_at
      )
      ORDER BY s.id ASC
    )
    FILTER (
      WHERE s.id IS NOT NULL
        AND COALESCE(
          s.is_deleted,
          FALSE
        ) = FALSE
    ),
    '[]'::jsonb
  )
`;

const TENDER_BASE_SELECT = `
  SELECT
    t.id,
    t.company_id,
    t.client_id,
    t.client_name,
    t.title,
    t.contract_number,
    t.tender_type,
    t.status,
    t.priority,
    t.risk_level,
    t.start_date,
    t.due_date,
    t.description,
    t.estimated_value,
    t.currency_code,
    t.estimated_margin,
    t.actual_margin,
    t.completed_at,
    t.is_deleted,
    t.deleted_at,
    t.deleted_by,
    t.created_at,
    t.updated_at,

    c.client_name AS linked_client_name,
    c.email AS client_email,
    c.phone AS client_phone,

    ${TENDER_SITE_JSON} AS sites,

    COUNT(s.id) FILTER (
      WHERE s.id IS NOT NULL
        AND COALESCE(
          s.is_deleted,
          FALSE
        ) = FALSE
    )::INTEGER AS site_count
`;

const TENDER_BASE_FROM = `
  FROM public.tenders t

  LEFT JOIN public.clients c
    ON c.id = t.client_id
   AND c.company_id = t.company_id
   AND COALESCE(
     c.is_deleted,
     FALSE
   ) = FALSE

  LEFT JOIN public.sites s
    ON s.tender_id = t.id
   AND s.company_id = t.company_id
   AND COALESCE(
     s.is_deleted,
     FALSE
   ) = FALSE
`;

const TENDER_GROUP_BY = `
  GROUP BY
    t.id,
    c.id,
    c.client_name,
    c.email,
    c.phone
`;

/*
|--------------------------------------------------------------------------
| Tender filter builder
|--------------------------------------------------------------------------
*/

const buildTenderFilterQuery = ({
  companyId,
  filters,
}) => {
  const values = [companyId];

  const conditions = [
    "t.company_id = $1",
    "COALESCE(t.is_deleted, FALSE) = FALSE",
  ];

  const addValue = (value) => {
    values.push(value);

    return `$${values.length}`;
  };

  if (filters.search) {
    const searchParameter = addValue(
      `%${filters.search}%`
    );

    conditions.push(`
      (
        t.title ILIKE ${searchParameter}

        OR COALESCE(
          t.client_name,
          ''
        ) ILIKE ${searchParameter}

        OR COALESCE(
          c.client_name,
          ''
        ) ILIKE ${searchParameter}

        OR COALESCE(
          t.contract_number,
          ''
        ) ILIKE ${searchParameter}

        OR COALESCE(
          t.description,
          ''
        ) ILIKE ${searchParameter}
      )
    `);
  }

  if (filters.status) {
    conditions.push(
      `t.status = ${addValue(
        filters.status
      )}`
    );
  }

  if (filters.tender_type) {
    conditions.push(
      `t.tender_type = ${addValue(
        filters.tender_type
      )}`
    );
  }

  if (filters.priority) {
    conditions.push(
      `t.priority = ${addValue(
        filters.priority
      )}`
    );
  }

  if (filters.risk_level) {
    conditions.push(
      `t.risk_level = ${addValue(
        filters.risk_level
      )}`
    );
  }

  if (filters.client_id) {
    conditions.push(
      `t.client_id = ${addValue(
        filters.client_id
      )}`
    );
  }

  if (
    filters.minimum_value !==
    null
  ) {
    conditions.push(`
      COALESCE(
        t.estimated_value,
        0
      ) >= ${addValue(
        filters.minimum_value
      )}
    `);
  }

  if (
    filters.maximum_value !==
    null
  ) {
    conditions.push(`
      COALESCE(
        t.estimated_value,
        0
      ) <= ${addValue(
        filters.maximum_value
      )}
    `);
  }

  if (filters.due_from) {
    conditions.push(
      `t.due_date >= ${addValue(
        filters.due_from
      )}`
    );
  }

  if (filters.due_to) {
    conditions.push(
      `t.due_date <= ${addValue(
        filters.due_to
      )}`
    );
  }

  return {
    values,
    conditions,
    addValue,
  };
};

/*
|--------------------------------------------------------------------------
| Tender reads
|--------------------------------------------------------------------------
*/

const getTenderById = async ({
  tenderId,
  companyId,
  client = pool,
  includeDeleted = false,
}) => {
  const deletedFilter =
    includeDeleted
      ? ""
      : `
        AND COALESCE(
          t.is_deleted,
          FALSE
        ) = FALSE
      `;

  const result = await client.query(
    `
    ${TENDER_BASE_SELECT}
    ${TENDER_BASE_FROM}

    WHERE t.id = $1
      AND t.company_id = $2
      ${deletedFilter}

    ${TENDER_GROUP_BY}

    LIMIT 1
    `,
    [
      tenderId,
      companyId,
    ]
  );

  return result.rows[0] || null;
};

const getTenderRecordForUpdate =
  async ({
    tenderId,
    companyId,
    client,
  }) => {
    const result =
      await client.query(
        `
        SELECT
          id,
          company_id,
          client_id,
          client_name,
          title,
          contract_number,
          tender_type,
          status,
          priority,
          risk_level,
          start_date,
          due_date,
          description,
          estimated_value,
          currency_code,
          estimated_margin,
          actual_margin,
          completed_at,
          is_deleted,
          deleted_at,
          deleted_by,
          created_at,
          updated_at

        FROM public.tenders

        WHERE id = $1
          AND company_id = $2
          AND COALESCE(
            is_deleted,
            FALSE
          ) = FALSE

        FOR UPDATE
        `,
        [
          tenderId,
          companyId,
        ]
      );

    return result.rows[0] || null;
  };

const listTenders = async ({
  companyId,
  filters,
  client = pool,
}) => {
  const {
    values,
    conditions,
    addValue,
  } = buildTenderFilterQuery({
    companyId,
    filters,
  });

  const limitParameter =
    addValue(filters.limit);

  const offsetParameter =
    addValue(filters.offset);

  const result = await client.query(
    `
    ${TENDER_BASE_SELECT}
    ${TENDER_BASE_FROM}

    WHERE ${conditions.join(
      "\n AND "
    )}

    ${TENDER_GROUP_BY}

    ORDER BY
      t.created_at DESC,
      t.id DESC

    LIMIT ${limitParameter}
    OFFSET ${offsetParameter}
    `,
    values
  );

  return result.rows;
};

const countTenders = async ({
  companyId,
  filters,
  client = pool,
}) => {
  const {
    values,
    conditions,
  } = buildTenderFilterQuery({
    companyId,
    filters,
  });

  const result = await client.query(
    `
    SELECT
      COUNT(
        DISTINCT t.id
      )::INTEGER AS total

    FROM public.tenders t

    LEFT JOIN public.clients c
      ON c.id = t.client_id
     AND c.company_id = t.company_id
     AND COALESCE(
       c.is_deleted,
       FALSE
     ) = FALSE

    WHERE ${conditions.join(
      "\n AND "
    )}
    `,
    values
  );

  return Number(
    result.rows[0]?.total || 0
  );
};

const getTenderStatistics =
  async ({
    companyId,
    client = pool,
  }) => {
    const result = await client.query(
      `
      SELECT
        COUNT(*)::INTEGER
          AS total_tenders,

        COALESCE(
          SUM(estimated_value),
          0
        ) AS total_tender_value,

        COUNT(*) FILTER (
          WHERE status = 'running'
        )::INTEGER AS running_tenders,

        COUNT(*) FILTER (
          WHERE status = 'pending'
        )::INTEGER AS pending_tenders,

        COUNT(*) FILTER (
          WHERE status = 'completed'
        )::INTEGER AS completed_tenders,

        COUNT(*) FILTER (
          WHERE status = 'passed'
        )::INTEGER AS passed_tenders

      FROM public.tenders

      WHERE company_id = $1
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE
      `,
      [companyId]
    );

    return result.rows[0];
  };

/*
|--------------------------------------------------------------------------
| Tender ownership checks
|--------------------------------------------------------------------------
*/

const validateClientOwnership =
  async ({
    clientId,
    companyId,
    client = pool,
  }) => {
    if (!clientId) {
      return true;
    }

    const result = await client.query(
      `
      SELECT id
      FROM public.clients
      WHERE id = $1
        AND company_id = $2
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE
      LIMIT 1
      `,
      [
        clientId,
        companyId,
      ]
    );

    return result.rows.length > 0;
  };

/*
|--------------------------------------------------------------------------
| Tender writes
|--------------------------------------------------------------------------
*/

const insertTender = async ({
  companyId,
  tender,
  client = pool,
}) => {
  const result = await client.query(
    `
    INSERT INTO public.tenders
    (
      company_id,
      client_id,
      client_name,
      title,
      contract_number,
      tender_type,
      status,
      priority,
      risk_level,
      start_date,
      due_date,
      description,
      estimated_value,
      currency_code,
      estimated_margin,
      actual_margin,
      completed_at,
      created_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15,
      $16,

      CASE
        WHEN $7 IN (
          'completed',
          'passed'
        )
          THEN NOW()
        ELSE NULL
      END,

      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      companyId,
      tender.client_id,
      tender.client_name,
      tender.title,
      tender.contract_number,
      tender.tender_type,
      tender.status,
      tender.priority,
      tender.risk_level,
      tender.start_date,
      tender.due_date,
      tender.description,
      tender.estimated_value,
      tender.currency_code,
      tender.estimated_margin,
      tender.actual_margin,
    ]
  );

  return result.rows[0];
};

const updateTender = async ({
  tenderId,
  companyId,
  tender,
  client = pool,
}) => {
  const result = await client.query(
    `
    UPDATE public.tenders
    SET
      client_id = $1,
      client_name = $2,
      title = $3,
      contract_number = $4,
      tender_type = $5,
      status = $6,
      priority = $7,
      risk_level = $8,
      start_date = $9,
      due_date = $10,
      description = $11,
      estimated_value = $12,
      currency_code = $13,
      estimated_margin = $14,
      actual_margin = $15,

      completed_at = CASE
        WHEN $6 IN (
          'completed',
          'passed'
        )
          THEN COALESCE(
            completed_at,
            NOW()
          )
        ELSE NULL
      END,

      updated_at = NOW()

    WHERE id = $16
      AND company_id = $17
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    RETURNING *
    `,
    [
      tender.client_id,
      tender.client_name,
      tender.title,
      tender.contract_number,
      tender.tender_type,
      tender.status,
      tender.priority,
      tender.risk_level,
      tender.start_date,
      tender.due_date,
      tender.description,
      tender.estimated_value,
      tender.currency_code,
      tender.estimated_margin,
      tender.actual_margin,
      tenderId,
      companyId,
    ]
  );

  return result.rows[0] || null;
};

const softDeleteTender = async ({
  tenderId,
  companyId,
  deletedBy,
  client = pool,
}) => {
  const result = await client.query(
    `
    UPDATE public.tenders
    SET
      is_deleted = TRUE,
      deleted_at = NOW(),
      deleted_by = $1,
      updated_at = NOW()

    WHERE id = $2
      AND company_id = $3
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    RETURNING *
    `,
    [
      deletedBy,
      tenderId,
      companyId,
    ]
  );

  return result.rows[0] || null;
};

const restoreTender = async ({
  tenderId,
  companyId,
  client = pool,
}) => {
  const result = await client.query(
    `
    UPDATE public.tenders
    SET
      is_deleted = FALSE,
      deleted_at = NULL,
      deleted_by = NULL,
      updated_at = NOW()

    WHERE id = $1
      AND company_id = $2
      AND COALESCE(
        is_deleted,
        FALSE
      ) = TRUE

    RETURNING *
    `,
    [
      tenderId,
      companyId,
    ]
  );

  return result.rows[0] || null;
};

/*
|--------------------------------------------------------------------------
| Tender sites
|--------------------------------------------------------------------------
*/

const getTenderSites = async ({
  tenderId,
  companyId,
  client = pool,
  includeDeleted = false,
}) => {
  const deletedFilter =
    includeDeleted
      ? ""
      : `
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE
      `;

  const result = await client.query(
    `
    SELECT
      id,
      company_id,
      tender_id,
      site_name,
      site_type,
      address,
      status,
      progress_percent,
      last_update_at,
      city,
      state,
      postcode,
      country,
      start_date,
      expected_finish_date,
      actual_finish_date,
      site_manager_id,
      budget,
      is_deleted,
      deleted_at,
      deleted_by,
      created_at,
      updated_at

    FROM public.sites

    WHERE tender_id = $1
      AND company_id = $2
      ${deletedFilter}

    ORDER BY id ASC
    `,
    [
      tenderId,
      companyId,
    ]
  );

  return result.rows;
};

const getTenderSiteIds = async ({
  tenderId,
  companyId,
  client = pool,
}) => {
  const result = await client.query(
    `
    SELECT id

    FROM public.sites

    WHERE tender_id = $1
      AND company_id = $2
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    ORDER BY id ASC
    `,
    [
      tenderId,
      companyId,
    ]
  );

  return result.rows.map(
    ({ id }) => Number(id)
  );
};

const siteBelongsToTender = async ({
  siteId,
  tenderId,
  companyId,
  client = pool,
}) => {
  const result = await client.query(
    `
    SELECT id

    FROM public.sites

    WHERE id = $1
      AND tender_id = $2
      AND company_id = $3
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    LIMIT 1
    `,
    [
      siteId,
      tenderId,
      companyId,
    ]
  );

  return result.rows.length > 0;
};

const insertTenderSite = async ({
  companyId,
  tenderId,
  site,
  client = pool,
}) => {
  const result = await client.query(
    `
    INSERT INTO public.sites
    (
      company_id,
      tender_id,
      site_name,
      site_type,
      address,
      status,
      progress_percent,
      city,
      state,
      postcode,
      country,
      start_date,
      expected_finish_date,
      actual_finish_date,
      site_manager_id,
      budget,
      last_update_at,
      created_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $15,
      $16,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      companyId,
      tenderId,
      site.site_name,
      site.site_type,
      site.address,
      site.status,
      site.progress_percent,
      site.city,
      site.state,
      site.postcode,
      site.country,
      site.start_date,
      site.expected_finish_date,
      site.actual_finish_date,
      site.site_manager_id,
      site.budget,
    ]
  );

  return result.rows[0];
};

const updateTenderSite = async ({
  siteId,
  tenderId,
  companyId,
  site,
  client = pool,
}) => {
  const result = await client.query(
    `
    UPDATE public.sites
    SET
      site_name = $1,
      site_type = $2,
      address = $3,
      status = $4,
      progress_percent = $5,
      city = $6,
      state = $7,
      postcode = $8,
      country = $9,
      start_date = $10,
      expected_finish_date = $11,
      actual_finish_date = $12,
      site_manager_id = $13,
      budget = $14,
      last_update_at = NOW(),
      updated_at = NOW()

    WHERE id = $15
      AND tender_id = $16
      AND company_id = $17
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    RETURNING *
    `,
    [
      site.site_name,
      site.site_type,
      site.address,
      site.status,
      site.progress_percent,
      site.city,
      site.state,
      site.postcode,
      site.country,
      site.start_date,
      site.expected_finish_date,
      site.actual_finish_date,
      site.site_manager_id,
      site.budget,
      siteId,
      tenderId,
      companyId,
    ]
  );

  return result.rows[0] || null;
};

const softDeleteTenderSites =
  async ({
    tenderId,
    companyId,
    siteIds,
    deletedBy,
    client = pool,
  }) => {
    if (
      !Array.isArray(siteIds) ||
      siteIds.length === 0
    ) {
      return [];
    }

    const result = await client.query(
      `
      UPDATE public.sites
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1,
        updated_at = NOW()

      WHERE tender_id = $2
        AND company_id = $3
        AND id = ANY(
          $4::INTEGER[]
        )
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      RETURNING *
      `,
      [
        deletedBy,
        tenderId,
        companyId,
        siteIds,
      ]
    );

    return result.rows;
  };

const softDeleteAllTenderSites =
  async ({
    tenderId,
    companyId,
    deletedBy,
    client = pool,
  }) => {
    const result = await client.query(
      `
      UPDATE public.sites
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1,
        updated_at = NOW()

      WHERE tender_id = $2
        AND company_id = $3
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      RETURNING *
      `,
      [
        deletedBy,
        tenderId,
        companyId,
      ]
    );

    return result.rows;
  };

const restoreAllTenderSites =
  async ({
    tenderId,
    companyId,
    client = pool,
  }) => {
    const result = await client.query(
      `
      UPDATE public.sites
      SET
        is_deleted = FALSE,
        deleted_at = NULL,
        deleted_by = NULL,
        updated_at = NOW()

      WHERE tender_id = $1
        AND company_id = $2
        AND COALESCE(
          is_deleted,
          FALSE
        ) = TRUE

      RETURNING *
      `,
      [
        tenderId,
        companyId,
      ]
    );

    return result.rows;
  };

/*
|--------------------------------------------------------------------------
| Tender documents
|--------------------------------------------------------------------------
*/

const getTenderDocuments = async ({
  tenderId,
  client = pool,
}) => {
  const result = await client.query(
    `
    SELECT
      td.id,
      td.tender_id,
      td.document_name,
      td.document_type,
      td.file_url,
      td.uploaded_by,
      td.created_at,
      td.updated_at,
      u.full_name AS uploaded_by_name

    FROM public.tender_documents td

    LEFT JOIN public.users u
      ON u.id = td.uploaded_by

    WHERE td.tender_id = $1
      AND COALESCE(
        td.is_deleted,
        FALSE
      ) = FALSE

    ORDER BY
      td.created_at DESC,
      td.id DESC
    `,
    [tenderId]
  );

  return result.rows;
};

const insertTenderDocument = async ({
  tenderId,
  uploadedBy,
  document,
  client = pool,
}) => {
  const result = await client.query(
    `
    INSERT INTO public.tender_documents
    (
      tender_id,
      document_name,
      document_type,
      file_url,
      uploaded_by,
      is_deleted,
      created_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      FALSE,
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      tenderId,
      document.document_name,
      document.document_type,
      document.file_url,
      uploadedBy,
    ]
  );

  return result.rows[0];
};

const updateTenderDocument = async ({
  documentId,
  tenderId,
  document,
  client = pool,
}) => {
  const result = await client.query(
    `
    UPDATE public.tender_documents
    SET
      document_name = $1,
      document_type = $2,
      file_url = $3,
      updated_at = NOW()

    WHERE id = $4
      AND tender_id = $5
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    RETURNING *
    `,
    [
      document.document_name,
      document.document_type,
      document.file_url,
      documentId,
      tenderId,
    ]
  );

  return result.rows[0] || null;
};

const softDeleteTenderDocument =
  async ({
    documentId,
    tenderId,
    deletedBy,
    client = pool,
  }) => {
    const result = await client.query(
      `
      UPDATE public.tender_documents
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1,
        updated_at = NOW()

      WHERE id = $2
        AND tender_id = $3
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      RETURNING *
      `,
      [
        deletedBy,
        documentId,
        tenderId,
      ]
    );

    return result.rows[0] || null;
  };

/*
|--------------------------------------------------------------------------
| Tender materials
|--------------------------------------------------------------------------
*/

const getTenderMaterials = async ({
  tenderId,
  client = pool,
}) => {
  const result = await client.query(
    `
    SELECT
      id,
      tender_id,
      section_name,
      material_name,
      quantity,
      unit,
      rate,
      total_amount,
      vendor_name,
      notes,
      created_at,
      updated_at

    FROM public.tender_materials

    WHERE tender_id = $1
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    ORDER BY
      created_at DESC,
      id DESC
    `,
    [tenderId]
  );

  return result.rows;
};

const insertTenderMaterial = async ({
  tenderId,
  material,
  client = pool,
}) => {
  const result = await client.query(
    `
    INSERT INTO public.tender_materials
    (
      tender_id,
      section_name,
      material_name,
      quantity,
      unit,
      rate,
      total_amount,
      vendor_name,
      notes,
      is_deleted,
      created_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      FALSE,
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      tenderId,
      material.section_name,
      material.material_name,
      material.quantity,
      material.unit,
      material.rate,
      material.total_amount,
      material.vendor_name,
      material.notes,
    ]
  );

  return result.rows[0];
};

const updateTenderMaterial = async ({
  materialId,
  tenderId,
  material,
  client = pool,
}) => {
  const result = await client.query(
    `
    UPDATE public.tender_materials
    SET
      section_name = $1,
      material_name = $2,
      quantity = $3,
      unit = $4,
      rate = $5,
      total_amount = $6,
      vendor_name = $7,
      notes = $8,
      updated_at = NOW()

    WHERE id = $9
      AND tender_id = $10
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    RETURNING *
    `,
    [
      material.section_name,
      material.material_name,
      material.quantity,
      material.unit,
      material.rate,
      material.total_amount,
      material.vendor_name,
      material.notes,
      materialId,
      tenderId,
    ]
  );

  return result.rows[0] || null;
};

const softDeleteTenderMaterial =
  async ({
    materialId,
    tenderId,
    deletedBy,
    client = pool,
  }) => {
    const result = await client.query(
      `
      UPDATE public.tender_materials
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1,
        updated_at = NOW()

      WHERE id = $2
        AND tender_id = $3
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      RETURNING *
      `,
      [
        deletedBy,
        materialId,
        tenderId,
      ]
    );

    return result.rows[0] || null;
  };

/*
|--------------------------------------------------------------------------
| Tender banking
|--------------------------------------------------------------------------
*/

const getTenderBanking = async ({
  tenderId,
  client = pool,
}) => {
  const result = await client.query(
    `
    SELECT
      id,
      tender_id,
      payment_type,
      bank_name,
      account_name,
      account_number,
      amount,
      gst_amount,
      notes,
      payment_date,
      created_at,
      updated_at

    FROM public.tender_banking

    WHERE tender_id = $1
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    ORDER BY
      payment_date DESC NULLS LAST,
      id DESC
    `,
    [tenderId]
  );

  return result.rows;
};

const insertTenderBanking = async ({
  tenderId,
  banking,
  client = pool,
}) => {
  const result = await client.query(
    `
    INSERT INTO public.tender_banking
    (
      tender_id,
      payment_type,
      bank_name,
      account_name,
      account_number,
      amount,
      gst_amount,
      notes,
      payment_date,
      is_deleted,
      created_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      FALSE,
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      tenderId,
      banking.payment_type,
      banking.bank_name,
      banking.account_name,
      banking.account_number,
      banking.amount,
      banking.gst_amount,
      banking.notes,
      banking.payment_date,
    ]
  );

  return result.rows[0];
};

const updateTenderBanking = async ({
  bankingId,
  tenderId,
  banking,
  client = pool,
}) => {
  const result = await client.query(
    `
    UPDATE public.tender_banking
    SET
      payment_type = $1,
      bank_name = $2,
      account_name = $3,
      account_number = $4,
      amount = $5,
      gst_amount = $6,
      notes = $7,
      payment_date = $8,
      updated_at = NOW()

    WHERE id = $9
      AND tender_id = $10
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    RETURNING *
    `,
    [
      banking.payment_type,
      banking.bank_name,
      banking.account_name,
      banking.account_number,
      banking.amount,
      banking.gst_amount,
      banking.notes,
      banking.payment_date,
      bankingId,
      tenderId,
    ]
  );

  return result.rows[0] || null;
};

const softDeleteTenderBanking =
  async ({
    bankingId,
    tenderId,
    deletedBy,
    client = pool,
  }) => {
    const result = await client.query(
      `
      UPDATE public.tender_banking
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1,
        updated_at = NOW()

      WHERE id = $2
        AND tender_id = $3
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      RETURNING *
      `,
      [
        deletedBy,
        bankingId,
        tenderId,
      ]
    );

    return result.rows[0] || null;
  };

/*
|--------------------------------------------------------------------------
| Tender subcontractors
|--------------------------------------------------------------------------
*/

const getTenderSubcontractors =
  async ({
    tenderId,
    companyId,
    client = pool,
  }) => {
    const result = await client.query(
      `
      SELECT
        ts.id,
        ts.tender_id,
        ts.subcontractor_id,
        ts.work_description,
        ts.assigned_amount,
        ts.status,
        ts.created_at,
        ts.updated_at,

        sc.full_name,
        sc.phone,
        sc.email,
        sc.business_name,
        sc.gst_number,
        sc.bank_name,
        sc.account_name,
        sc.account_number

      FROM public.tender_subcontractors ts

      INNER JOIN public.subcontractors sc
        ON sc.id = ts.subcontractor_id
       AND sc.company_id = $2
       AND COALESCE(
         sc.is_deleted,
         FALSE
       ) = FALSE

      WHERE ts.tender_id = $1
        AND COALESCE(
          ts.is_deleted,
          FALSE
        ) = FALSE

      ORDER BY
        ts.created_at DESC,
        ts.id DESC
      `,
      [
        tenderId,
        companyId,
      ]
    );

    return result.rows;
  };

const subcontractorBelongsToCompany =
  async ({
    subcontractorId,
    companyId,
    client = pool,
  }) => {
    const result = await client.query(
      `
      SELECT id

      FROM public.subcontractors

      WHERE id = $1
        AND company_id = $2
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      LIMIT 1
      `,
      [
        subcontractorId,
        companyId,
      ]
    );

    return result.rows.length > 0;
  };

const tenderSubcontractorExists =
  async ({
    tenderId,
    subcontractorId,
    client = pool,
  }) => {
    const result = await client.query(
      `
      SELECT id

      FROM public.tender_subcontractors

      WHERE tender_id = $1
        AND subcontractor_id = $2
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      LIMIT 1
      `,
      [
        tenderId,
        subcontractorId,
      ]
    );

    return result.rows.length > 0;
  };

const insertTenderSubcontractor =
  async ({
    tenderId,
    assignment,
    client = pool,
  }) => {
    const result = await client.query(
      `
      INSERT INTO public.tender_subcontractors
      (
        tender_id,
        subcontractor_id,
        work_description,
        assigned_amount,
        status,
        is_deleted,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        FALSE,
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        tenderId,
        assignment.subcontractor_id,
        assignment.work_description,
        assignment.assigned_amount,
        assignment.status,
      ]
    );

    return result.rows[0];
  };

const updateTenderSubcontractor =
  async ({
    assignmentId,
    tenderId,
    assignment,
    client = pool,
  }) => {
    const result = await client.query(
      `
      UPDATE public.tender_subcontractors
      SET
        work_description = $1,
        assigned_amount = $2,
        status = $3,
        updated_at = NOW()

      WHERE id = $4
        AND tender_id = $5
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      RETURNING *
      `,
      [
        assignment.work_description,
        assignment.assigned_amount,
        assignment.status,
        assignmentId,
        tenderId,
      ]
    );

    return result.rows[0] || null;
  };

const softDeleteTenderSubcontractor =
  async ({
    assignmentId,
    tenderId,
    deletedBy,
    client = pool,
  }) => {
    const result = await client.query(
      `
      UPDATE public.tender_subcontractors
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1,
        status = 'inactive',
        updated_at = NOW()

      WHERE id = $2
        AND tender_id = $3
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      RETURNING *
      `,
      [
        deletedBy,
        assignmentId,
        tenderId,
      ]
    );

    return result.rows[0] || null;
  };

/*
|--------------------------------------------------------------------------
| Tender worker assignments
|--------------------------------------------------------------------------
*/

const getTenderWorkers = async ({
  tenderId,
  companyId,
  client = pool,
}) => {
  const result = await client.query(
    `
    SELECT
      wa.id,
      wa.worker_id,
      wa.site_id,
      wa.tender_id,
      wa.assigned_by,
      wa.notes,
      wa.status,
      wa.assigned_at,
      wa.ended_at,
      wa.created_at,
      wa.updated_at,

      w.full_name,
      w.phone,
      w.email,
      w.role,

      s.site_name

    FROM public.worker_assignments wa

    INNER JOIN public.workers w
      ON w.id = wa.worker_id
     AND w.company_id = $2
     AND COALESCE(
       w.is_deleted,
       FALSE
     ) = FALSE

    INNER JOIN public.sites s
      ON s.id = wa.site_id
     AND s.tender_id = wa.tender_id
     AND s.company_id = $2
     AND COALESCE(
       s.is_deleted,
       FALSE
     ) = FALSE

    WHERE wa.tender_id = $1
      AND COALESCE(
        wa.is_deleted,
        FALSE
      ) = FALSE

    ORDER BY
      wa.assigned_at DESC,
      wa.id DESC
    `,
    [
      tenderId,
      companyId,
    ]
  );

  return result.rows;
};

const workerBelongsToCompany =
  async ({
    workerId,
    companyId,
    client = pool,
  }) => {
    const result = await client.query(
      `
      SELECT id

      FROM public.workers

      WHERE id = $1
        AND company_id = $2
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      LIMIT 1
      `,
      [
        workerId,
        companyId,
      ]
    );

    return result.rows.length > 0;
  };

const workerAssignmentExists =
  async ({
    tenderId,
    siteId,
    workerId,
    client = pool,
  }) => {
    const result = await client.query(
      `
      SELECT id

      FROM public.worker_assignments

      WHERE tender_id = $1
        AND site_id = $2
        AND worker_id = $3
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      LIMIT 1
      `,
      [
        tenderId,
        siteId,
        workerId,
      ]
    );

    return result.rows.length > 0;
  };

const insertTenderWorker = async ({
  tenderId,
  assignedBy,
  assignment,
  client = pool,
}) => {
  const result = await client.query(
    `
    INSERT INTO public.worker_assignments
    (
      worker_id,
      site_id,
      tender_id,
      assigned_by,
      notes,
      status,
      assigned_at,
      ended_at,
      is_deleted,
      created_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      NOW(),
      $7,
      FALSE,
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      assignment.worker_id,
      assignment.site_id,
      tenderId,
      assignedBy,
      assignment.notes,
      assignment.status,
      assignment.ended_at,
    ]
  );

  return result.rows[0];
};

const updateTenderWorker = async ({
  assignmentId,
  tenderId,
  assignment,
  client = pool,
}) => {
  const result = await client.query(
    `
    UPDATE public.worker_assignments
    SET
      notes = $1,
      status = $2,
      ended_at = CASE
        WHEN $2 = 'active'
          THEN NULL
        ELSE COALESCE(
          $3,
          ended_at,
          NOW()
        )
      END,
      updated_at = NOW()

    WHERE id = $4
      AND tender_id = $5
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    RETURNING *
    `,
    [
      assignment.notes,
      assignment.status,
      assignment.ended_at,
      assignmentId,
      tenderId,
    ]
  );

  return result.rows[0] || null;
};

const softDeleteTenderWorker =
  async ({
    assignmentId,
    tenderId,
    deletedBy,
    client = pool,
  }) => {
    const result = await client.query(
      `
      UPDATE public.worker_assignments
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1,
        status = 'inactive',
        ended_at = COALESCE(
          ended_at,
          NOW()
        ),
        updated_at = NOW()

      WHERE id = $2
        AND tender_id = $3
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      RETURNING *
      `,
      [
        deletedBy,
        assignmentId,
        tenderId,
      ]
    );

    return result.rows[0] || null;
  };

/*
|--------------------------------------------------------------------------
| Tender finance
|--------------------------------------------------------------------------
*/

const getTenderFinanceRecords =
  async ({
    tenderId,
    client = pool,
  }) => {
    const result = await client.query(
      `
      SELECT
        id,
        tender_id,
        site_id,
        record_type,
        source_name,
        payment_mode,
        amount,
        interest_percent,
        gst_percent,
        gst_total,
        gst_done,
        gst_left,
        company_charge_percent,
        company_charge_total,
        company_charge_done,
        company_charge_left,
        tds_amount,
        record_date,
        notes,
        status,
        created_at,
        updated_at

      FROM public.tender_finance_records

      WHERE tender_id = $1
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      ORDER BY
        record_date DESC NULLS LAST,
        id DESC
      `,
      [tenderId]
    );

    return result.rows;
  };

const insertTenderFinanceRecord =
  async ({
    tenderId,
    finance,
    client = pool,
  }) => {
    const result = await client.query(
      `
      INSERT INTO public.tender_finance_records
      (
        site_id,
        tender_id,
        record_type,
        source_name,
        payment_mode,
        amount,
        interest_percent,
        gst_percent,
        gst_total,
        gst_done,
        gst_left,
        company_charge_percent,
        company_charge_total,
        company_charge_done,
        company_charge_left,
        tds_amount,
        record_date,
        notes,
        status,
        is_deleted,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        FALSE,
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        finance.site_id,
        tenderId,
        finance.record_type,
        finance.source_name,
        finance.payment_mode,
        finance.amount,
        finance.interest_percent,
        finance.gst_percent,
        finance.gst_total,
        finance.gst_done,
        finance.gst_left,
        finance.company_charge_percent,
        finance.company_charge_total,
        finance.company_charge_done,
        finance.company_charge_left,
        finance.tds_amount,
        finance.record_date,
        finance.notes,
        finance.status,
      ]
    );

    return result.rows[0];
  };

const updateTenderFinanceRecord =
  async ({
    financeId,
    tenderId,
    finance,
    client = pool,
  }) => {
    const result = await client.query(
      `
      UPDATE public.tender_finance_records
      SET
        site_id = $1,
        record_type = $2,
        source_name = $3,
        payment_mode = $4,
        amount = $5,
        interest_percent = $6,
        gst_percent = $7,
        gst_total = $8,
        gst_done = $9,
        gst_left = $10,
        company_charge_percent = $11,
        company_charge_total = $12,
        company_charge_done = $13,
        company_charge_left = $14,
        tds_amount = $15,
        record_date = $16,
        notes = $17,
        status = $18,
        updated_at = NOW()

      WHERE id = $19
        AND tender_id = $20
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      RETURNING *
      `,
      [
        finance.site_id,
        finance.record_type,
        finance.source_name,
        finance.payment_mode,
        finance.amount,
        finance.interest_percent,
        finance.gst_percent,
        finance.gst_total,
        finance.gst_done,
        finance.gst_left,
        finance.company_charge_percent,
        finance.company_charge_total,
        finance.company_charge_done,
        finance.company_charge_left,
        finance.tds_amount,
        finance.record_date,
        finance.notes,
        finance.status,
        financeId,
        tenderId,
      ]
    );

    return result.rows[0] || null;
  };

const softDeleteTenderFinanceRecord =
  async ({
    financeId,
    tenderId,
    deletedBy = null,
    client = pool,
  }) => {
    const result = await client.query(
      `
      UPDATE public.tender_finance_records
      SET
        is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = $1,
        updated_at = NOW()

      WHERE id = $2
        AND tender_id = $3
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      RETURNING *
      `,
      [
        deletedBy,
        financeId,
        tenderId,
      ]
    );

    return result.rows[0] || null;
  };

const getTenderFinanceSummary =
  async ({
    tenderId,
    client = pool,
  }) => {
    const result = await client.query(
      `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN record_type = 'INVESTOR'
                THEN amount
              ELSE 0
            END
          ),
          0
        ) AS investor_total,

        COALESCE(
          SUM(
            CASE
              WHEN record_type = 'GOVERNMENT_BILL'
                THEN amount
              ELSE 0
            END
          ),
          0
        ) AS government_bill_total,

        COALESCE(
          SUM(
            CASE
              WHEN record_type = 'SUBCONTRACTOR'
                THEN amount
              ELSE 0
            END
          ),
          0
        ) AS subcontractor_total,

        COALESCE(
          SUM(
            CASE
              WHEN record_type = 'OFFICE'
                THEN amount
              ELSE 0
            END
          ),
          0
        ) AS office_total,

        COALESCE(
          SUM(
            CASE
              WHEN record_type = 'TDS'
                THEN tds_amount
              ELSE 0
            END
          ),
          0
        ) AS tds_total,

        COALESCE(
          SUM(
            CASE
              WHEN record_type = 'GOVERNMENT_BILL'
                THEN gst_total
              ELSE 0
            END
          ),
          0
        ) AS gst_total,

        COALESCE(
          SUM(
            CASE
              WHEN record_type = 'GST_RETURN'
                THEN amount
              ELSE 0
            END
          ),
          0
        ) AS gst_done,

        COALESCE(
          SUM(
            CASE
              WHEN record_type IN (
                'COMPANY_CHARGE',
                'GOVERNMENT_BILL'
              )
                THEN company_charge_total
              ELSE 0
            END
          ),
          0
        ) AS company_charge_total,

        COALESCE(
          SUM(
            CASE
              WHEN record_type = 'COMPANY_CHARGE_PAYMENT'
                THEN amount
              ELSE 0
            END
          ),
          0
        ) AS company_charge_done,

        COALESCE(
          SUM(
            CASE
              WHEN record_type IN (
                'INVESTOR',
                'GOVERNMENT_BILL'
              )
                THEN amount
              ELSE 0
            END
          ),
          0
        ) AS total_income,

        COALESCE(
          SUM(
            CASE
              WHEN record_type IN (
                'SUBCONTRACTOR',
                'OFFICE',
                'TDS',
                'GST_RETURN',
                'COMPANY_CHARGE_PAYMENT'
              )
                THEN amount
              ELSE 0
            END
          ),
          0
        ) AS total_expense

      FROM public.tender_finance_records

      WHERE tender_id = $1
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE
      `,
      [tenderId]
    );

    return result.rows[0];
  };

/*
|--------------------------------------------------------------------------
| Tender daily updates
|--------------------------------------------------------------------------
*/

const getTenderDailyUpdates =
  async ({
    tenderId,
    companyId,
    client = pool,
  }) => {
    const result = await client.query(
      `
      SELECT
        dsl.*,

        s.site_name,

        w.full_name AS worker_name,

        sc.full_name
          AS subcontractor_name

      FROM public.daily_site_logs dsl

      LEFT JOIN public.sites s
        ON s.id = dsl.site_id
       AND s.company_id = $2

      LEFT JOIN public.workers w
        ON w.id = dsl.worker_id
       AND w.company_id = $2

      LEFT JOIN public.subcontractors sc
        ON sc.id =
          dsl.subcontractor_id
       AND sc.company_id = $2

      WHERE dsl.tender_id = $1
        AND dsl.company_id = $2
        AND COALESCE(
          dsl.is_deleted,
          FALSE
        ) = FALSE

      ORDER BY
        dsl.log_date DESC NULLS LAST,
        dsl.id DESC
      `,
      [
        tenderId,
        companyId,
      ]
    );

    return result.rows;
  };

/*
|--------------------------------------------------------------------------
| Complete Tender details
|--------------------------------------------------------------------------
*/

const getCompleteTenderDetails =
  async ({
    tenderId,
    companyId,
    client = pool,
  }) => {
    const tender =
      await getTenderById({
        tenderId,
        companyId,
        client,
      });

    if (!tender) {
      return null;
    }

    const [
      documents,
      materials,
      banking,
      subcontractors,
      workers,
      finance,
      financeSummary,
      dailyUpdates,
    ] = await Promise.all([
      getTenderDocuments({
        tenderId,
        client,
      }),

      getTenderMaterials({
        tenderId,
        client,
      }),

      getTenderBanking({
        tenderId,
        client,
      }),

      getTenderSubcontractors({
        tenderId,
        companyId,
        client,
      }),

      getTenderWorkers({
        tenderId,
        companyId,
        client,
      }),

      getTenderFinanceRecords({
        tenderId,
        client,
      }),

      getTenderFinanceSummary({
        tenderId,
        client,
      }),

      getTenderDailyUpdates({
        tenderId,
        companyId,
        client,
      }),
    ]);

    return {
      tender,
      documents,
      materials,
      banking,
      subcontractors,
      workers,
      finance,

      finance_summary:
        financeSummary,

      daily_updates:
        dailyUpdates,
    };
  };

/*
|--------------------------------------------------------------------------
| Public query API
|--------------------------------------------------------------------------
*/

module.exports = {
  getTenderById,
  getTenderRecordForUpdate,
  listTenders,
  countTenders,
  getTenderStatistics,
  validateClientOwnership,

  insertTender,
  updateTender,
  softDeleteTender,
  restoreTender,

  getTenderSites,
  getTenderSiteIds,
  siteBelongsToTender,
  insertTenderSite,
  updateTenderSite,
  softDeleteTenderSites,
  softDeleteAllTenderSites,
  restoreAllTenderSites,

  getTenderDocuments,
  insertTenderDocument,
  updateTenderDocument,
  softDeleteTenderDocument,

  getTenderMaterials,
  insertTenderMaterial,
  updateTenderMaterial,
  softDeleteTenderMaterial,

  getTenderBanking,
  insertTenderBanking,
  updateTenderBanking,
  softDeleteTenderBanking,

  getTenderSubcontractors,
  subcontractorBelongsToCompany,
  tenderSubcontractorExists,
  insertTenderSubcontractor,
  updateTenderSubcontractor,
  softDeleteTenderSubcontractor,

  getTenderWorkers,
  workerBelongsToCompany,
  workerAssignmentExists,
  insertTenderWorker,
  updateTenderWorker,
  softDeleteTenderWorker,

  getTenderFinanceRecords,
  insertTenderFinanceRecord,
  updateTenderFinanceRecord,
  softDeleteTenderFinanceRecord,
  getTenderFinanceSummary,

  getTenderDailyUpdates,
  getCompleteTenderDetails,
};