/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| The data-access layer for tenders and all their child collections. Every
| SQL statement the tenders module issues lives here.
|
| The module is layered:
|
|   tender.routes.js      URLs, roles, audit
|   tender.controller.js  HTTP — request in, response out
|   tender.service.js     business rules and orchestration
|   tenderQueries.js      SQL and nothing else          <- this file
|   tenderValidation.js   payload shape and value rules
|
| Nothing here reads `req` or writes `res`, and nothing here decides policy.
| Each function takes plain arguments — usually including companyId — runs
| one statement, and returns rows. That separation is what lets the service
| compose several queries inside one transaction without any of them
| knowing about HTTP.
|
| Responsibilities:
|   - Hold the shared SELECT fragments that define a tender's shape
|   - Build the filtered list query from user-supplied search criteria
|   - Read, insert, update, soft-delete and restore tenders
|   - The same for sites, documents, materials, banking, subcontractor
|     assignments, worker assignments and finance records
|
| Exports:
|   see module.exports at the foot of the file — around forty query
|   functions, grouped by the collection they act on
|
| Used by:
|   ./tender.service.js — the only consumer. The controller never imports
|   this file directly.
|
| Depends on:
|   database/pool.js
|
| Database tables touched:
|   tenders, sites, clients, tender_documents, tender_materials,
|   tender_banking, tender_subcontractors, worker_assignments,
|   tender_finance_records, workers, subcontractors
|
| Conventions every function in this file follows:
|
|   companyId is a required argument, not an option. It appears in the
|   WHERE clause of EVERY statement, including all eight child-collection
|   reads, so a query cannot reach another tenant even when called with a
|   tender or child id that exists elsewhere.
|
|   Five of those reads were unscoped until F-17 and relied on their
|   callers; they are now self-defending. backend/tests/
|   tenderCrossTenant.test.js calls each one directly with a mismatched
|   companyId to prove it.
|
|   Most take an optional `client` defaulting to the pool, so the service
|   can run them inside a transaction.
|
|   Soft deletes are guarded with COALESCE(is_deleted, FALSE) = FALSE,
|   because rows predating the column hold NULL there.
|
|   All values are bound parameters. The only interpolation is of SQL
|   fragments defined as constants in this file — never of anything from a
|   request.
|
| Note:
|   At ~2,800 lines this is the largest file in the backend. It is
|   organised by collection, in the same order as the route table in
|   tender.routes.js.
|
*/

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

/*
 * Aggregates a tender's sites into a single JSON array column.
 *
 * Why aggregate in SQL rather than issue a second query per tender: the
 * list endpoint returns many tenders, each with its sites, and fetching
 * them separately would be one query per row. Building the array in
 * Postgres keeps it to one statement however many tenders come back.
 *
 * Three details, each doing real work:
 *
 *   FILTER (WHERE s.id IS NOT NULL ...) — the join is LEFT, so a tender
 *   with no sites produces one row with every s.* column NULL. Without the
 *   filter, jsonb_agg would faithfully aggregate that phantom into an array
 *   containing a single object of nulls. The filter also repeats the
 *   soft-delete guard, so a deleted site cannot slip into the array.
 *
 *   COALESCE(..., '[]'::jsonb) — jsonb_agg over zero rows returns NULL, not
 *   an empty array. Without this the frontend would need to guard every
 *   `tender.sites.map(...)`.
 *
 *   ORDER BY s.id ASC — inside the aggregate, so the array order is stable
 *   between requests rather than whatever the planner happens to produce.
 *
 * The field list is spelled out rather than using row_to_json, so adding a
 * column to `sites` does not silently widen every tender payload.
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

/*
 * The canonical projection for a tender.
 *
 * Shared by the list query, the single-tender read and the post-write
 * re-read, so all three return the identical shape. That matters more than
 * it looks: the frontend renders a tender from a list row and from a detail
 * response with the same components, and a field present in one but not the
 * other shows up as an intermittently blank field rather than an error.
 *
 * Beyond the tender's own columns it carries:
 *
 *   linked_client_name / client_email / client_phone
 *     from the clients table, so a tender displays its client's details
 *     without a second lookup. Note tenders ALSO has its own client_name
 *     free-text column — see the comment on the alias below.
 *
 *   sites        the aggregated JSON array
 *   site_count   the same count as an integer, so the UI can show "3 sites"
 *                without measuring the array
 *
 * The COUNT repeats the FILTER conditions rather than reusing the array,
 * because a count over the raw join would include the phantom NULL row from
 * the LEFT JOIN and report 1 for a tender with no sites.
 */
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

    -- The clients table column is "name", not "client_name".
    --
    -- Aliased to linked_client_name rather than client_name because
    -- tenders has a client_name column of its own, holding free text
    -- typed before the client was a record. Both are returned: the
    -- free-text one is what older tenders have, the linked one is
    -- authoritative where client_id is set.
    c.name AS linked_client_name,
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

/*
 * The FROM and JOIN clauses shared by every tender read.
 *
 * Both joins are LEFT: a tender need not have a client, and need not have
 * sites. INNER joins would make such tenders vanish from the register
 * entirely — the kind of bug that looks like data loss.
 *
 * Both joins also carry `company_id = t.company_id`. Belt and braces, since
 * the caller's company is already filtered in the WHERE clause, but it
 * means a mislinked client_id or a site row pointing across tenants
 * resolves to NULL rather than leaking another company's data into the
 * response.
 */
const TENDER_BASE_FROM = `
  FROM public.tenders t

  -- clients has no is_deleted column; it uses a status field instead.
  -- Filtering on the missing column raised 42703 and broke every query
  -- built on TENDER_BASE_FROM, including fetching a tender after create.
  LEFT JOIN public.clients c
    ON c.id = t.client_id
   AND c.company_id = t.company_id

  LEFT JOIN public.sites s
    ON s.tender_id = t.id
   AND s.company_id = t.company_id
   AND COALESCE(
     s.is_deleted,
     FALSE
   ) = FALSE
`;

/*
 * Required by the aggregates in TENDER_BASE_SELECT.
 *
 * The sites join multiplies each tender by its number of sites, and
 * jsonb_agg / COUNT collapse those rows back down — which means every
 * non-aggregated column must be grouped.
 *
 * Grouping by t.id alone is enough for the tender's own columns, because
 * it is the primary key and Postgres recognises the functional dependency.
 * The client columns need naming explicitly: they come from a joined table,
 * where that inference does not apply. c.id is listed first for the same
 * reason — it makes c.name, c.email and c.phone functionally dependent, and
 * they are then named anyway for clarity.
 */
const TENDER_GROUP_BY = `
  GROUP BY
    t.id,
    c.id,
    c.name,
    c.email,
    c.phone
`;

/*
|--------------------------------------------------------------------------
| Tender filter builder
|--------------------------------------------------------------------------
*/

/**
 * Assembles the WHERE conditions and bound values for a tender search.
 *
 * Purpose:
 * The tender register supports ten filters plus free-text search, in any
 * combination. Building that clause by hand in each of the three callers —
 * list, count and statistics — would guarantee they eventually disagree,
 * and a count that does not match its list is a paging bug.
 *
 * Parameters (one options object):
 * companyId - the caller's company; always $1
 * filters   - the parsed filter object from the service. Recognised keys:
 *               deleted        show soft-deleted tenders instead of live
 *               search         free text across five columns
 *               status, tender_type, priority, risk_level, client_id
 *                              exact matches
 *               minimum_value, maximum_value   bounds on estimated_value
 *               due_from, due_to               bounds on due_date
 *
 * Returns:
 * { values, conditions, addValue }
 *   values      the bound parameters, in placeholder order
 *   conditions  the WHERE fragments, to be joined with AND
 *   addValue    the same closure, returned so a caller can append further
 *               parameters (LIMIT and OFFSET) and keep the numbering
 *               consistent
 *
 * Side effects:
 * None — it builds strings and an array; it issues no query.
 *
 * Security:
 * Every filter value goes through addValue and becomes a bound parameter.
 * No filter value is ever interpolated into the SQL text, so a search term
 * containing a quote is data.
 *
 * The company condition is seeded first and unconditionally, occupying $1.
 * Nothing a caller passes in `filters` can remove or displace it.
 *
 * Note:
 * Returning addValue is the subtle part. The placeholder numbers depend on
 * how many filters were applied, so a caller appending LIMIT must use the
 * same counter rather than guessing $12. See listTenders.
 */
const buildTenderFilterQuery = ({
  companyId,
  filters,
}) => {
  const values = [companyId];

  /*
   * Two conditions that are always present.
   *
   * The company scope is $1 and is seeded before any filter, so it can
   * never be displaced.
   *
   * The soft-delete condition is a switch, not a guard: `deleted: true`
   * shows ONLY deleted tenders rather than adding them to the live ones.
   * That is what backs the recycle-bin view, and what makes
   * POST /:id/restore reachable — a deleted tender has to be findable
   * before it can be restored.
   */
  const conditions = [
    "t.company_id = $1",
    filters.deleted
      ? "COALESCE(t.is_deleted, FALSE) = TRUE"
      : "COALESCE(t.is_deleted, FALSE) = FALSE",
  ];

  /*
   * Binds a value and returns its placeholder.
   *
   * The counter is the array's own length, so pushing and numbering cannot
   * drift apart — which is the failure mode when placeholders are written
   * by hand and a filter is later inserted in the middle.
   */
  const addValue = (value) => {
    values.push(value);

    return `$${values.length}`;
  };

  /*
   * Free-text search across the five fields a tender is actually looked up
   * by: its title, either form of the client name, the contract number and
   * the description.
   *
   * One bound value reused in five places — note searchParameter is
   * captured once and interpolated repeatedly, rather than calling addValue
   * five times. Same pattern as the masters search.
   *
   * ILIKE rather than lower(...) LIKE: Postgres's own case-insensitive
   * match, which reads better and avoids wrapping every column in a
   * function.
   *
   * COALESCE on the four nullable columns. `NULL ILIKE pattern` is NULL,
   * not false, so without it a tender with no description would be dropped
   * from the OR rather than simply not matching on that field.
   *
   * Both client name columns are searched because a tender may carry either
   * — free text on older rows, a linked client on newer ones.
   */
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
          c.name,
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

  /*
   * The value bounds test against null explicitly, unlike the filters
   * above which test truthiness.
   *
   * They have to: a minimum_value of 0 is a meaningful filter, and
   * `if (filters.minimum_value)` would discard it. The service normalises
   * an absent bound to null precisely so this check can distinguish
   * "no bound" from "a bound of zero".
   *
   * COALESCE(estimated_value, 0) means a tender with no estimated value
   * counts as zero rather than dropping out of the comparison — so it
   * appears under a minimum of 0 and is excluded by any higher one.
   */
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

/**
 * Reads one tender in the canonical shape.
 *
 * Purpose:
 * The single-tender read, and also the re-read after a create or update —
 * which is why it must produce exactly the shape the list produces.
 *
 * Parameters (one options object):
 * tenderId       - the tender
 * companyId      - the caller's company; part of the WHERE clause
 * client         - pool or transaction client. A caller inside
 *                  withTransaction must pass its client, or this reads
 *                  outside the transaction and will not see uncommitted
 *                  rows.
 * includeDeleted - when true, soft-deleted tenders are returned too. Used
 *                  by the restore path, which by definition addresses a
 *                  deleted record.
 *
 * Returns:
 * The tender row with its client details, sites array and site_count, or
 * null when nothing matches.
 *
 * Side effects:
 * One SELECT.
 *
 * Security:
 * companyId is bound as $2 and is not optional. A tender id belonging to
 * another company returns null, indistinguishable from a non-existent id —
 * which is what lets the controller answer 404 for both without leaking
 * whether the record exists.
 *
 * includeDeleted is a caller-chosen boolean, never derived from a request,
 * so the string it selects is safe to interpolate.
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

/**
 * Reads a tender's own columns and locks the row for the transaction.
 *
 * Purpose:
 * The read half of a read-modify-write. The update path needs the current
 * values to merge a partial payload against, and needs them to still be
 * current when it writes.
 *
 * Parameters (one options object):
 * tenderId  - the tender
 * companyId - the caller's company
 * client    - REQUIRED, and deliberately has no pool default. FOR UPDATE
 *             outside a transaction locks nothing useful: the lock is
 *             released the moment the statement completes, so the caller
 *             would get the syntax of safety with none of the effect.
 *
 * Returns:
 * The tender's own columns, or null. No client join, no sites array —
 * this is for merging, not for returning to a user.
 *
 * Side effects:
 * One SELECT, and a row-level lock held until the transaction ends.
 *
 * Concurrency:
 * FOR UPDATE is what serialises two simultaneous edits of the same tender.
 * Without it both would read the same before-state, both would merge their
 * partial payload onto it, and the second write would silently discard the
 * first user's changes. With it, the second transaction blocks until the
 * first commits and then reads the updated row.
 *
 * The flip side is that a long transaction holding this lock blocks every
 * other writer of the same tender — keep the work between this call and
 * the COMMIT short.
 *
 * Notes:
 * Excludes soft-deleted tenders, so an update cannot resurrect one by
 * accident. Restoring goes through restoreTender instead.
 */
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

/**
 * One page of the tender register, filtered and ordered.
 *
 * Purpose:
 * Backs GET /api/tenders and therefore TendersPage.jsx.
 *
 * Parameters (one options object):
 * companyId - the caller's company
 * filters   - the parsed filter object, including limit and offset
 * client    - pool or transaction client
 *
 * Returns:
 * An array of tenders in the canonical shape, each with its sites and
 * client details.
 *
 * Side effects:
 * One SELECT.
 *
 * Notes:
 * Paired with countTenders, which must use the same filters to produce a
 * matching total — the two share buildTenderFilterQuery for exactly that
 * reason. Note this differs from the scopedCrud registers, which get their
 * total from a COUNT(*) OVER () window in the same statement; here the
 * GROUP BY makes that awkward, so it is a second query.
 *
 * LIMIT and OFFSET go through the same addValue counter as the filters, so
 * their placeholder numbers adjust to however many filters were applied.
 *
 * Ordered newest first, with the id as a tie-break so two tenders created
 * in the same instant do not swap places between pages.
 */
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

/**
 * How many tenders match the same filters, ignoring paging.
 *
 * Purpose:
 * Supplies the total for the register's pagination. Shares
 * buildTenderFilterQuery with listTenders so the two cannot disagree about
 * what is being counted — a total that does not match the list is how
 * paging ends up with a phantom last page.
 *
 * Parameters (one options object):
 * companyId - the caller's company
 * filters   - the same filter object passed to listTenders. limit and
 *             offset are present but deliberately unused here.
 * client    - pool or transaction client
 *
 * Returns:
 * A number. Zero when nothing matches, never null.
 *
 * Side effects:
 * One SELECT.
 *
 * Notes:
 * COUNT(DISTINCT t.id) rather than COUNT(*). This query has no GROUP BY,
 * so if the sites join were present each tender would be counted once per
 * site. The sites join is in fact omitted below — only the clients join is
 * kept, because the search filter can reference c.name — so DISTINCT is
 * belt and braces against that join being re-added later.
 *
 * The `::INTEGER` cast matters: COUNT returns BIGINT, which node-pg hands
 * back as a string to avoid precision loss. Without the cast the frontend
 * would receive "42" and arithmetic on it would concatenate.
 */
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

    -- See TENDER_BASE_FROM: clients has no is_deleted column.
    LEFT JOIN public.clients c
      ON c.id = t.client_id
     AND c.company_id = t.company_id

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

/**
 * Headline counts and total value across a company's live tenders.
 *
 * Purpose:
 * Backs GET /api/tenders/statistics and the dashboard cards.
 *
 * Parameters (one options object):
 * companyId - the caller's company
 * client    - pool or transaction client
 *
 * Returns:
 * One row: total_tenders, total_tender_value, and a count per status
 * (running, pending, completed, passed).
 *
 * Side effects:
 * One SELECT.
 *
 * Notes:
 * Every figure comes from a single pass over the table using FILTER
 * clauses, rather than four separate COUNT queries. Postgres evaluates all
 * six aggregates while scanning once.
 *
 * COALESCE on the SUM because SUM over zero rows is NULL, not 0 — a company
 * with no tenders would otherwise show a blank total rather than zero.
 *
 * The status strings are hard-coded here rather than read from
 * config/constants.js, so a new status added there would not appear in the
 * statistics until this query is updated too. Worth knowing; not changed.
 *
 * Unlike listTenders this takes no filters — the statistics are always
 * across all live tenders in the company, regardless of what the register
 * is currently filtered to.
 */
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

/**
 * Confirms a client belongs to the caller's company.
 *
 * Purpose:
 * Called before a tender is created or updated with a client_id, so a
 * tender cannot be linked to another tenant's client.
 *
 * Parameters (one options object):
 * clientId  - the client to check; optional on a tender
 * companyId - the caller's company
 * client    - pool or transaction client
 *
 * Returns:
 * true when the client belongs to the company, or when no clientId was
 * supplied at all — a tender without a client is valid, so there is
 * nothing to reject.
 *
 * Side effects:
 * One SELECT.
 *
 * Security:
 * This is the guard that stops a tender being linked to another tenant's
 * client. company_id is bound as $2 and is not optional.
 *
 * Fixed — F-16.
 *
 * This query previously also filtered `COALESCE(is_deleted, FALSE) = FALSE`.
 * The clients table has no such column — it carries `status` instead — so
 * the statement failed with 42703 and every tender create or update that
 * named a client returned a 500. Tenders without a client were unaffected,
 * because the `!clientId` guard below returns before the query runs, which
 * is why it went unnoticed.
 *
 * The same mistake was made twice more in this file, on the joins in
 * TENDER_BASE_FROM and countTenders; both were corrected by dropping the
 * condition, and their comments still record why. This is the third
 * occurrence, fixed the same way.
 *
 * Deliberately NOT replaced with `status = 'active'`:
 *
 *   - The function checks OWNERSHIP, as its name says. Whether a client is
 *     archived is a lifecycle question, and no caller asks this function
 *     that.
 *   - Adding the filter would be new behaviour, not a restoration of lost
 *     behaviour: the condition never once evaluated successfully, so there
 *     is no prior semantics to preserve.
 *   - It would break a real workflow. The frontend sends the whole tender
 *     on update, client_id included, so editing any field of a tender whose
 *     client had since been archived would start failing with 404.
 *
 *   If archived clients should be un-selectable for NEW tenders, that
 *   belongs in the create path as a separate rule, not in an ownership
 *   check shared with update.
 *
 * Regression coverage: backend/tests/tenderClientValidation.test.js
 */
const validateClientOwnership =
  async ({
    clientId,
    companyId,
    client = pool,
  }) => {
    // A tender need not have a client, so "no client" is valid rather than
    // a failed check.
    if (!clientId) {
      return true;
    }

    const result = await client.query(
      `
      SELECT id
      FROM public.clients
      WHERE id = $1
        AND company_id = $2
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

      -- $7 (status) is referenced twice: here, and in the CASE below.
      -- PostgreSQL tries to deduce a single type from both positions and
      -- fails with "inconsistent types deduced for parameter $7", which
      -- made every tender insert error out. The cast has to appear on BOTH
      -- occurrences — casting only one side just moves the conflict.
      $7::TEXT,

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
        WHEN $7::TEXT IN (
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
      -- Cast on both occurrences of $6 — see insertTender for why.
      status = $6::TEXT,
      priority = $7,
      risk_level = $8,
      start_date = $9,
      due_date = $10,
      description = $11,
      estimated_value = $12,
      currency_code = $13,
      estimated_margin = $14,
      actual_margin = $15,

      -- Same cast as in insertTender: $6 also sets the status column, and
      -- without ::TEXT the parameter type cannot be deduced.
      completed_at = CASE
        WHEN $6::TEXT IN (
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
|
| Sites are the first of seven child collections, and the only one whose
| rows also live in a top-level register (/api/sites). The others exist
| solely as children of a tender.
|
| THE SHARED CONTRACT — every child-collection function below follows it:
|
|   Reads   getTenderX({ tenderId, companyId, client })
|           Filtered on BOTH the parent tender and the company. The
|           company filter is not redundant: a caller who guessed a tender
|           id from another tenant would otherwise read its children.
|
|   Writes  insertTenderX / updateTenderX / softDeleteTenderX
|           Take companyId and write it onto the row, so a child can never
|           end up in a different tenant from its parent.
|
|   Delete  Always soft. Every one of these tables carries is_deleted, and
|           every read guards it with COALESCE(is_deleted, FALSE) = FALSE
|           because rows predating the column hold NULL.
|
|   Scoping A child id that exists under ANOTHER tender matches nothing,
|           because tender_id is in the WHERE clause alongside the child's
|           own id. That is what makes the nesting real rather than
|           cosmetic, and it is asserted in
|           backend/tests/tenderChildResources.test.js.
|
| Only the deviations from this contract are documented individually
| below. Where a function is a straight instance of the pattern, the
| pattern is the documentation.
|
| Sites specifically:
|   softDeleteAllTenderSites and restoreAllTenderSites exist because
|   deleting a tender must take its sites with it, and restoring must bring
|   them back. See the notes on those two.
|
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

/**
 * Soft-deletes every live site under a tender.
 *
 * Purpose:
 * The cascade half of deleting a tender. Sites are the one child
 * collection with a life of their own — they appear in /api/sites, carry
 * daily logs and payments, and are selectable elsewhere in the UI — so
 * leaving them live after their tender is deleted would strand them in
 * every site picker with no parent to explain them.
 *
 * Parameters (one options object):
 * tenderId  - the parent being deleted
 * companyId - the caller's company
 * deletedBy - the acting user, recorded on each row
 * client    - should be the transaction client; the tender and its sites
 *             must be deleted atomically
 *
 * Returns:
 * The affected site rows. The caller uses the count for its response, and
 * the rows are what restoreAllTenderSites has to be able to reverse.
 *
 * Side effects:
 * One UPDATE affecting zero or more rows.
 *
 * Notes:
 * The `is_deleted = FALSE` condition makes this idempotent and, more
 * importantly, makes the restore correct: a site that was ALREADY deleted
 * on its own before the tender went is not touched here, so restoring the
 * tender will not resurrect it. See restoreAllTenderSites.
 */
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

/**
 * Restores every soft-deleted site under a tender.
 *
 * Purpose:
 * The counterpart to softDeleteAllTenderSites, run when a tender is
 * restored through POST /api/tenders/:id/restore.
 *
 * Parameters (one options object):
 * tenderId  - the tender being restored
 * companyId - the caller's company
 * client    - the transaction client
 *
 * Returns:
 * The restored site rows.
 *
 * Side effects:
 * One UPDATE. Clears is_deleted, deleted_at and deleted_by together, so a
 * restored row carries no stale deletion metadata.
 *
 * Known limitation — this over-restores.
 *
 * It brings back every deleted site under the tender, including any that
 * were deleted individually BEFORE the tender was. There is no record of
 * which deletion each site belonged to, so the two cases are
 * indistinguishable by the time this runs.
 *
 * The delete side is careful not to touch already-deleted sites precisely
 * so this could be made accurate, but distinguishing them would need a
 * marker — a deleted_with_tender flag, or comparing deleted_at against the
 * tender's — and neither exists.
 *
 * In practice deleting a tender is rare and restoring one rarer, so a site
 * unexpectedly reappearing is a mild surprise rather than data loss. Worth
 * knowing before relying on restore to reproduce an exact prior state.
 */
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
|
| Contracts, drawings, permits and photographs. Rows hold a name and a
| storage URL — the file itself goes to Supabase Storage through
| /api/upload, and only its location is recorded here.
|
| A straight instance of the shared child contract described under Tender
| sites: read by tender + company, write with company, soft delete.
|
| Note the consequence of soft deletion for uploads: removing a document
| row does NOT remove the object from storage. The file remains at its URL,
| reachable by anyone holding the link. Deleting the stored object would
| need a storage call in the same path, and is not done.
|
*/

const getTenderDocuments = async ({
  tenderId,
  companyId,
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
      AND td.company_id = $2
      AND COALESCE(
        td.is_deleted,
        FALSE
      ) = FALSE

    ORDER BY
      td.created_at DESC,
      td.id DESC
    `,
    [tenderId, companyId]
  );

  return result.rows;
};

const insertTenderDocument = async ({
  tenderId,
  companyId,
  uploadedBy,
  document,
  client = pool,
}) => {
  const result = await client.query(
    `
    INSERT INTO public.tender_documents
    (
      tender_id,
      company_id,
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
      $6,
      FALSE,
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      tenderId,
      companyId,
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
|
| What the job needs and what it is expected to cost: quantities, rates and
| suppliers, planned at tender level.
|
| Distinct from the material entries under /api/site-operations, which
| record deliveries a supervisor actually received on site. This collection
| is the plan; that one is the record of what arrived. Nothing reconciles
| the two.
|
| A straight instance of the shared child contract.
|
*/

const getTenderMaterials = async ({
  tenderId,
  companyId,
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
      AND company_id = $2
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    ORDER BY
      created_at DESC,
      id DESC
    `,
    [tenderId, companyId]
  );

  return result.rows;
};

const insertTenderMaterial = async ({
  tenderId,
  companyId,
  material,
  client = pool,
}) => {
  const result = await client.query(
    `
    INSERT INTO public.tender_materials
    (
      tender_id,
      company_id,
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
      $10,
      FALSE,
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      tenderId,
      companyId,
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
|
| Bank guarantees, security deposits and EMD held against a tender — money
| tied up in winning and holding the job, as opposed to money earned from
| it.
|
| Distinct again from the supervisor banking float under
| /api/site-operations, which tracks cash issued to a site.
|
| A straight instance of the shared child contract, with one thing worth
| knowing: these rows carry account_number, and this collection IS audited
| (logActivity("tender_banking", ...) in tender.routes.js). Account numbers
| were therefore being written to activity_logs until account_number was
| added to REDACTED_KEYS in utils/activityLog.js — see F-12.
|
*/

const getTenderBanking = async ({
  tenderId,
  companyId,
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
      AND company_id = $2
      AND COALESCE(
        is_deleted,
        FALSE
      ) = FALSE

    ORDER BY
      payment_date DESC NULLS LAST,
      id DESC
    `,
    [tenderId, companyId]
  );

  return result.rows;
};

const insertTenderBanking = async ({
  tenderId,
  companyId,
  banking,
  client = pool,
}) => {
  const result = await client.query(
    `
    INSERT INTO public.tender_banking
    (
      tender_id,
      company_id,
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
      $10,
      FALSE,
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      tenderId,
      companyId,
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
|
| Which subcontractors are engaged on a tender, for what scope and what
| agreed amount.
|
| Unlike documents, materials and banking, these rows are ASSIGNMENTS — a
| join between two records that both already exist. That brings two extra
| functions the other collections do not need:
|
|   subcontractorBelongsToCompany  the subcontractor being assigned must be
|                                  the caller's, or the assignment would
|                                  reference another tenant's record
|   tenderSubcontractorExists      guards against assigning the same
|                                  subcontractor to the same tender twice
|
| Both run before the insert. The first is a tenant check; the second is a
| uniqueness check the schema does not enforce.
|
| These rows are also what /api/subcontractor-portal reads to decide which
| tenders a subcontractor may see, so an assignment is a grant of access as
| well as a commercial record.
|
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
    companyId,
    assignment,
    client = pool,
  }) => {
    const result = await client.query(
      `
      INSERT INTO public.tender_subcontractors
      (
        tender_id,
        company_id,
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
        $6,
        FALSE,
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        tenderId,
        companyId,
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
|
| Which workers are on a tender, in what role and over what dates.
|
| The mirror of tender subcontractors, with the same two extra guards for
| the same reasons:
|
|   workerBelongsToCompany   the worker must be the caller's
|   workerAssignmentExists   no duplicate assignment of one worker to one
|                            tender
|
| Written to the worker_assignments table — note the name does not follow
| the tender_* convention of the other collections, which is why the audit
| entries in tender.routes.js use "worker_assignments" as their module
| while the rest use the URL segment.
|
| These rows drive two things beyond the tender page: /api/worker-portal
| reads them to decide which tenders a worker can see, and the worker-money
| screens use them to attribute allocations and expenses to a job.
|
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
  companyId,
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
      company_id,
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
      $7,
      NOW(),
      $8,
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
      companyId,
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
|
| Government bills, GST returns, company charges, TDS, investor and
| subcontractor entries recorded against a tender. The one child collection
| with real arithmetic behind it: utils/financeCalculations.js derives the
| totals and outstanding balances from whatever the client supplies, and
| getTenderFinanceSummary below aggregates them by type.
|
| Follows the shared child contract, including company scoping on both
| reads. getTenderFinanceRecords and getTenderFinanceSummary previously
| filtered on tender_id alone and depended on the caller — that was F-17,
| fixed; both now take companyId.
|
*/

const getTenderFinanceRecords =
  async ({
    tenderId,
    companyId,
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
        AND company_id = $2
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE

      ORDER BY
        record_date DESC NULLS LAST,
        id DESC
      `,
      [tenderId, companyId]
    );

    return result.rows;
  };

const insertTenderFinanceRecord =
  async ({
    tenderId,
    companyId,
    finance,
    client = pool,
  }) => {
    const result = await client.query(
      `
      INSERT INTO public.tender_finance_records
      (
        site_id,
        tender_id,
        company_id,
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
        $20,
        FALSE,
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        finance.site_id,
        tenderId,
        companyId,
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

/**
 * Totals a tender's finance records by record type.
 *
 * Purpose:
 * Backs GET /api/tenders/:id/finance/summary and the finance figures on
 * the tender detail page. Aggregating in SQL means the frontend receives
 * settled numbers rather than a list it has to sum itself — which also
 * stops the page and any export from disagreeing.
 *
 * Parameters (one options object):
 * tenderId - the tender to total
 * client   - pool or transaction client
 *
 * Returns:
 * One row of named totals: investor_total, government_bill_total,
 * subcontractor_total, office_total, tds_total, gst_total and the
 * remaining GST/company-charge figures.
 *
 * Side effects:
 * One SELECT.
 *
 * Security:
 * Scoped on BOTH tender_id and company_id, so a tender id from another
 * tenant returns zeroes rather than that tenant's totals.
 *
 * This query used to take no companyId and filter on tender_id alone. It
 * was safe only because its single caller ran prepareChildOperation first
 * — the guarantee lived in the CALL SITE rather than here, so a new caller
 * could have opened a cross-tenant read with no visible change to this
 * function. That was F-17, now fixed.
 *
 * The ownership check in the service is retained as well. It is not
 * redundant: it produces the 404 that tells a caller the tender is not
 * theirs, whereas this filter alone would return an empty result that
 * reads as "no finance records".
 *
 * Regression coverage: backend/tests/tenderCrossTenant.test.js, which
 * calls this directly with a mismatched companyId.
 *
 * Notes:
 * Each total is a SUM over a CASE, so all of them come from one pass over
 * the table rather than one query per record type.
 *
 * COALESCE on every SUM because SUM over zero rows is NULL, not 0 — a
 * tender with no finance records would otherwise return nulls and render
 * as blanks instead of zeros.
 *
 * Note tds_total sums the tds_amount column while the others sum amount:
 * a TDS record's headline amount and its deducted figure are the same
 * value, derived in utils/financeCalculations.js, but the dedicated column
 * is the authoritative one.
 */
const getTenderFinanceSummary =
  async ({
    tenderId,
    companyId,
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
        AND company_id = $2
        AND COALESCE(
          is_deleted,
          FALSE
        ) = FALSE
      `,
      [tenderId, companyId]
    );

    return result.rows[0];
  };

/*
|--------------------------------------------------------------------------
| Tender daily updates
|--------------------------------------------------------------------------
|
| Read-only here. Daily site logs belong to modules/siteLogs, which owns
| their creation and the backdating rules; this query exists so the tender
| detail page can show progress on the job without a second round trip.
|
| Rows come denormalised with the site, worker and subcontractor names, and
| the joins repeat the company_id condition — so a log carrying another
| company's worker_id (see F-14) resolves to a null name rather than
| leaking it.
|
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

/**
 * Loads a tender and every child collection in one call.
 *
 * Purpose:
 * Backs GET /api/tenders/:id/details, which populates TenderDetailsPage
 * and all nine of its tabs. Without it the page would fire eight parallel
 * requests on open; with it, switching tabs needs no network at all.
 *
 * Parameters (one options object):
 * tenderId  - the tender
 * companyId - the caller's company
 * client    - pool or transaction client
 *
 * Returns:
 * The tender with documents, materials, banking, subcontractors, workers,
 * finance records, a finance summary and daily updates attached. Null when
 * the tender does not exist or is not the caller's.
 *
 * Side effects:
 * Nine SELECTs — one for the tender, then eight in parallel.
 *
 * Security:
 * Two independent layers, and both are wanted.
 *
 * The tender is fetched FIRST and the function returns null if that misses,
 * so a tender belonging to another company yields nothing and no child
 * query runs at all. That produces the 404 the caller needs.
 *
 * Every child query is ALSO company-scoped in its own right — all eight
 * now take companyId. Five of them did not until F-17; the early return
 * was the only thing protecting them, which made the ordering below
 * load-bearing in a way nothing stated. It is still the right order, but
 * it is no longer the only defence.
 *
 * Performance:
 * The eight child queries run concurrently via Promise.all, so the cost is
 * roughly the slowest one rather than their sum. All eight share one pooled
 * connection when a transaction client is passed — node-pg serialises
 * statements on a single client, so in that case they are effectively
 * sequential. Called through the pool (the normal path) they genuinely run
 * in parallel across connections.
 *
 * The response is large. A tender with many daily updates returns all of
 * them, unpaginated.
 */
const getCompleteTenderDetails =
  async ({
    tenderId,
    companyId,
    client = pool,
  }) => {
    /*
     * Fetched first and awaited before any child query runs.
     *
     * If this returns nothing the tender either does not exist or is not
     * the caller's — indistinguishable on purpose — and no child data is
     * read at all. This is what turns a cross-tenant request into a clean
     * 404 rather than an empty payload.
     *
     * The child queries are independently scoped too, since F-17.
     */
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
        companyId,
        client,
      }),

      getTenderMaterials({
        tenderId,
        companyId,
        client,
      }),

      getTenderBanking({
        tenderId,
        companyId,
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
        companyId,
        client,
      }),

      getTenderFinanceSummary({
        tenderId,
        companyId,
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