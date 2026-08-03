/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| A factory that builds a complete, tenant-safe REST controller from a
| declarative table description. Given a config it returns the five standard
| handlers — list, getById, create, update, remove — already wired for
| pagination, search, soft delete, foreign-key checking and company scoping.
|
| Responsibilities:
|   - Guarantee company_id comes from the session on every read and write
|   - Build parameterised SQL for the five CRUD shapes
|   - Adapt to whichever audit columns a given table actually has
|   - Return the uniform { success, [key]: ... } response shape
|
| Exports:
|   createScopedCrud(config) -> { list, getById, create, update, remove }
|
| Used by:
|   backend/modules/workers/worker.controller.js
|   backend/modules/subcontractors/subcontractor.controller.js
|   backend/modules/invoices/invoice.controller.js
|
|   Those three are the plain registers. Modules with real business rules —
|   tenders, payments, site operations, the two portals — write their own
|   controllers and do not use this.
|
| Depends on:
|   database/pool.js      the connection pool
|   utils/asyncHandler.js each returned handler is pre-wrapped, so routes
|                         must NOT wrap them a second time
|   utils/requestContext.js  identity, validation and response helpers
|
| Database tables touched:
|   whichever table the config names, plus information_schema.columns for
|   the one-off introspection described below.
|
| API surface:
|   the handlers are mounted by worker.routes.js, subcontractor.routes.js
|   and invoice.routes.js, which supply their own auth and role middleware —
|   this factory assumes authMiddleware has already run and does not check
|   roles itself.
|
| Frontend consumers:
|   frontend/src/services/workerService.js, subcontractorService.js and
|   invoiceService.js, and through them the Workers, Subcontractors and
|   Invoices pages.
|
| Security note:
|   `table`, `orderBy`, column names and reference table names are
|   interpolated directly into SQL, because Postgres cannot parameterise
|   identifiers. They are safe only because every one comes from a literal
|   in a controller file. Never let any of them originate in a request. All
|   *values* are bound parameters.
|
*/

const pool = require("../database/pool");

const asyncHandler = require("./asyncHandler");

const {
  requireCompanyId,
  getUserId,
  requireParamId,
  sendNotFound,
  cleanText,
  toNumber,
} = require("./requestContext");

/*
|--------------------------------------------------------------------------
| Company-scoped CRUD
|--------------------------------------------------------------------------
|
| Several modules were thin CRUD controllers written by hand, and every one
| of them had the same two defects:
|
|   1. the list query had no company_id filter, so it returned every
|      company's rows
|   2. create took company_id from the request body, so a client could
|      write a record into another company
|
| Building them from one factory makes both mistakes impossible to repeat:
| company_id always comes from the authenticated session, and it is always
| part of the WHERE clause. A new module gets the guarantee for free.
|
| Modules with real business logic — tenders, payments, site operations —
| keep their own controllers. This is only for the plain registers.
|
*/

/*
|--------------------------------------------------------------------------
| Column introspection
|--------------------------------------------------------------------------
|
| Not every table carries the same audit columns. workers, subcontractors,
| invoices and sites have no created_by at all, yet the hand-written
| controllers all tried to insert one — so every create on those four
| endpoints failed with 42703 "column does not exist".
|
| Rather than hardcode which tables have what and risk the same drift, the
| factory asks the catalog once per table and caches the answer.
|
*/

/**
 * table name -> Set of its column names.
 *
 * Process-lifetime cache. The schema does not change while the server is
 * running, so one lookup per table is enough; a deploy restarts the process
 * and the cache with it. A migration applied against a live server would
 * leave this stale until the next restart — acceptable, since migrations
 * here are followed by a redeploy.
 */
const columnCache = new Map();

/**
 * Returns the set of columns a table actually has.
 *
 * Purpose:
 * Lets the factory adapt its INSERT and UPDATE to each table rather than
 * assuming a uniform audit-column set. See the note above for why.
 *
 * Parameters:
 * table - the table name; a trusted literal from a controller config
 *
 * Returns:
 * A Set of column-name strings. Empty if the table does not exist, which
 * would then surface as a normal SQL error on the first real query.
 *
 * Side effects:
 * One query against information_schema on the first call per table, then
 * none.
 *
 * Performance:
 * The cache is what makes this affordable. Without it every create and
 * update would pay an extra round trip to the catalog.
 *
 * Notes:
 * Bound as $1, so the table name is safe here even though it is
 * interpolated elsewhere in this file.
 */
const getTableColumns = async (table) => {
  if (columnCache.has(table)) {
    return columnCache.get(table);
  }

  const result = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    `,
    [table]
  );

  const columns = new Set(
    result.rows.map(
      (row) => row.column_name
    )
  );

  columnCache.set(table, columns);

  return columns;
};

/**
 * Coerces a value according to its declared column type.
 *
 * Purpose:
 * JSON gives everything to us as a string. This turns each field into
 * whatever its column expects, so a numeric column never receives "12" and
 * a text column never receives an object.
 *
 * Parameters:
 * value - the raw body field
 * type  - the column's declared type from the config:
 *           "number"  any finite number, defaulting to 0
 *           "integer" whole numbers only; anything else becomes null
 *           "raw"     passed through untouched, for JSON and array columns
 *           anything else (including undefined) is treated as text
 *
 * Returns:
 * The coerced value, or null.
 *
 * Business rule:
 * Blank input — undefined, null or "" — always becomes null, never 0 or "".
 * This is what makes the COALESCE trick in `update` work: a field the client
 * omitted arrives as null and the COALESCE leaves the stored value alone.
 * The consequence is that a scoped-CRUD update cannot clear a column back to
 * null; clearing requires a hand-written controller.
 *
 * Notes:
 * "integer" returning null for a fractional value means a bad id is dropped
 * rather than rounded — the insert then fails a NOT NULL or FK constraint,
 * which is louder and safer than writing the wrong row.
 */
const coerce = (value, type) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (type === "number") {
    return toNumber(value, 0);
  }

  if (type === "integer") {
    const parsed = Number(value);

    return Number.isInteger(parsed)
      ? parsed
      : null;
  }

  if (type === "raw") {
    return value;
  }

  return cleanText(value) || null;
};

/**
 * Builds a company-scoped CRUD controller.
 *
 * config:
 *   table          the table name (never taken from user input)
 *   label          singular human name, used in messages
 *   collection     response key for the list, e.g. "workers"
 *   item           response key for one record, e.g. "worker"
 *   columns        [{ name, type, required }] — the writable columns
 *   defaults       { column: value } applied when the field is absent
 *   searchColumns  columns matched by ?search=
 *   filters        query params allowed as exact-match filters
 *   references     [{ column, table, label }] checked to be in-company
 *   softDelete     whether the table has is_deleted (default true)
 *   orderBy        ORDER BY clause, defaults to "id DESC"
 *   transformRow   optional (row) => row, applied to every row before it
 *                  is put in a response. Used to mask sensitive fields —
 *                  see the note below.
 *
 * Purpose:
 * Produces five Express handlers that share one guarantee: no query this
 * factory builds can read or write outside the caller's company.
 *
 * Parameters:
 * config - as documented above. `table`, `label`, `collection` and `item`
 *          are effectively required; the rest have defaults.
 *
 * Returns:
 * { list, getById, create, update, remove } — each already wrapped in
 * asyncHandler and ready to pass straight to a router.
 *
 * Side effects:
 * None at build time. The handlers query when called.
 *
 * Security:
 * Every identifier in `config` is interpolated into SQL. They must be
 * literals in the controller file, never anything derived from a request.
 *
 * Notes:
 * The returned handlers are already wrapped — routes should mount them
 * directly, not pass them through asyncHandler again.
 *
 * transformRow, when supplied, runs on EVERY row this factory returns —
 * list, getById, create and update alike. That uniformity is the point: a
 * masking rule applied to the list but not to the create response would
 * leak the value back the moment a record was saved. The subcontractors
 * register uses it to strip account numbers (F-12); full values are served
 * only by a separate, role-gated endpoint.
 *
 * Usage:
 *   const workers = createScopedCrud({
 *     table: "workers",
 *     label: "Worker",
 *     collection: "workers",
 *     item: "worker",
 *     columns: [{ name: "full_name", type: "text", required: true }],
 *   });
 *   router.get("/", workers.list);
 */
const createScopedCrud = (config) => {
  const {
    table,
    label,
    collection,
    item,
    columns = [],
    defaults = {},
    searchColumns = [],
    filters = [],
    references = [],
    softDelete = true,
    orderBy = "id DESC",
    transformRow = null,
  } = config;

  /**
   * Applies transformRow to one row, or passes it through unchanged.
   *
   * Defined once so all four response points below cannot diverge — a
   * masking rule that were applied to three of them would leak through
   * the fourth.
   */
  const shape = (row) =>
    typeof transformRow === "function" && row
      ? transformRow(row)
      : row;

  /*
   * Built once at factory time rather than per request, since it depends
   * only on the config. COALESCE covers rows written before the column
   * existed, where is_deleted is NULL — a bare `= FALSE` would treat those
   * legacy rows as deleted and hide them from every list.
   */
  const notDeleted = softDelete
    ? "COALESCE(t.is_deleted, FALSE) = FALSE"
    : null;

  /**
   * Verifies every declared foreign key belongs to the caller's company.
   *
   * Purpose:
   * A worker row carries a site_id, an invoice a tender_id. Without this
   * check a client could post another company's id into that field and
   * create a cross-tenant link — the row itself would be correctly scoped,
   * but it would point somewhere it must not.
   *
   * Parameters:
   * body      - the request body, read for each configured reference column
   * companyId - the caller's company
   *
   * Returns:
   * The `label` of the first reference that failed, or null when all pass.
   * A label rather than a boolean so the caller can name the offending
   * entity in its 404.
   *
   * Side effects:
   * One SELECT per non-empty reference column.
   *
   * Business rule:
   * A falsy value is skipped, not rejected. Optional foreign keys are
   * common, and requiredness is enforced separately via `columns`.
   *
   * Security:
   * `ref.table` is interpolated; id and company are bound. Same rule as the
   * rest of the file — reference tables come from controller literals.
   *
   * Performance:
   * Sequential rather than parallel. With at most a couple of references per
   * table that is not worth a Promise.all, and stopping at the first failure
   * avoids queries whose answer no longer matters.
   */
  const checkReferences = async (
    body,
    companyId
  ) => {
    for (const ref of references) {
      const value = body[ref.column];

      if (!value) continue;

      const result = await pool.query(
        `SELECT 1 FROM ${ref.table}
          WHERE id = $1 AND company_id = $2`,
        [value, companyId]
      );

      if (result.rows.length === 0) {
        return ref.label;
      }
    }

    return null;
  };

  /*
  |------------------------------------------------------------------------
  | List
  |------------------------------------------------------------------------
  |
  | GET /  — paginated, filterable, searchable list for one company.
  |
  | Auth:      required (authMiddleware, mounted by the route file)
  | Roles:     whatever the route file allows; not checked here
  | Query:     ?search=   substring match across searchColumns
  |            ?limit=    page size, default 200, hard ceiling 500
  |            ?offset=   rows to skip, floored at 0
  |            plus any parameter named in `filters`, matched exactly
  | Response:  200 { success, [collection]: rows, pagination }
  |
  | The WHERE clause is assembled incrementally: company scope first and
  | unconditionally, then soft delete, then filters, then search. Because
  | $1 is always the company id, no later clause can displace the scope.
  |
  */
  const list = asyncHandler(
    async (req, res) => {
      const companyId =
        requireCompanyId(req, res);

      if (!companyId) return;

      const conditions = [
        "t.company_id = $1",
      ];

      if (notDeleted) {
        conditions.push(notDeleted);
      }

      const values = [companyId];

      /*
       * Only parameters named in the config's `filters` list are honoured.
       * Iterating the allow-list rather than req.query is what stops a
       * client filtering on an arbitrary column — including one it should
       * not be able to probe, such as another tenant's company_id.
       */
      filters.forEach((column) => {
        const value =
          req.query[column];

        // Absent and empty are both "no filter". An empty string would
        // otherwise match only rows whose column is literally "".
        if (
          value === undefined ||
          value === ""
        ) {
          return;
        }

        values.push(value);

        conditions.push(
          `t.${column} = $${values.length}`
        );
      });

      /*
       * Free-text search: one bound pattern tested against every configured
       * column, OR-ed together and wrapped in parentheses so the group binds
       * as a single condition rather than dissolving into the surrounding
       * ANDs.
       *
       * Both sides are lowercased for a case-insensitive match, and each
       * column is cast to TEXT so numeric and date columns can be searched
       * too. COALESCE turns a NULL into '' — without it, NULL LIKE pattern
       * is NULL rather than false, and the row silently drops out.
       *
       * The pattern is bound as a parameter, so a search term containing a
       * quote is data, not SQL. It is not escaped for LIKE, though: a term
       * containing % or _ acts as a wildcard. Harmless for a search box.
       */
      if (
        req.query.search &&
        searchColumns.length > 0
      ) {
        values.push(
          `%${String(
            req.query.search
          ).toLowerCase()}%`
        );

        const index = values.length;

        conditions.push(
          `(${searchColumns
            .map(
              (c) =>
                `lower(COALESCE(t.${c}::TEXT, '')) LIKE $${index}`
            )
            .join(" OR ")})`
        );
      }

      /*
       * Pagination bounds, clamped rather than validated — a nonsensical
       * value is corrected instead of rejected, because a bad page size is
       * not worth failing a read over.
       *
       * The 500 ceiling exists so one request cannot ask for an entire
       * table; `|| 200` also catches NaN from a non-numeric limit, since
       * NaN is falsy.
       */
      const limit = Math.min(
        Number(req.query.limit) ||
          200,
        500
      );

      // Floored at 0: a negative OFFSET is a Postgres error, not a query
      // that quietly returns nothing.
      const offset = Math.max(
        Number(req.query.offset) || 0,
        0
      );

      values.push(limit, offset);

      /*
       * COUNT(*) OVER () is a window function evaluated before LIMIT, so it
       * returns the total number of matching rows while the result set is
       * still just one page. That gives the frontend a page count without a
       * second COUNT query, and without the two disagreeing if a row is
       * written between them.
       *
       * The cost is that the count rides along on every returned row. Fine
       * at these page sizes.
       */
      const result = await pool.query(
        `
        SELECT t.*, COUNT(*) OVER () AS total_count
        FROM ${table} t
        WHERE ${conditions.join(" AND ")}
        ORDER BY t.${orderBy}
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
        `,
        values
      );

      return res.status(200).json({
        success: true,
        [collection]: result.rows.map(shape),
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
  |------------------------------------------------------------------------
  | Read one
  |------------------------------------------------------------------------
  |
  | GET /:id
  |
  | Auth:      required
  | Params:    :id must be a positive integer
  | Response:  200 { success, [item]: row }
  |            400 invalid id
  |            404 no such row, or it belongs to another company
  |
  | The 404 covers both "missing" and "not yours" deliberately — see
  | sendNotFound in requestContext.js for why the two must be
  | indistinguishable.
  |
  */
  const getById = asyncHandler(
    async (req, res) => {
      const companyId =
        requireCompanyId(req, res);

      if (!companyId) return;

      const id = requireParamId(
        req,
        res,
        "id",
        label.toLowerCase()
      );

      if (!id) return;

      const result = await pool.query(
        `
        SELECT t.* FROM ${table} t
        WHERE t.id = $1 AND t.company_id = $2
        ${notDeleted ? `AND ${notDeleted}` : ""}
        `,
        [id, companyId]
      );

      if (result.rows.length === 0) {
        return sendNotFound(res, label);
      }

      return res.status(200).json({
        success: true,
        [item]: shape(result.rows[0]),
      });
    }
  );

  /*
  |------------------------------------------------------------------------
  | Create
  |------------------------------------------------------------------------
  |
  | POST /
  |
  | Auth:       required
  | Validation: every column marked `required` must be present and truthy;
  |             every configured reference must resolve inside the company
  | Response:   201 { success, [item]: row }
  |             400 with the missing field names
  |             404 when a referenced record is not the company's
  |
  | Order matters here: cheap in-memory validation runs before the reference
  | queries, so a request missing a required field costs no database work.
  |
  */
  const create = asyncHandler(
    async (req, res) => {
      const companyId =
        requireCompanyId(req, res);

      if (!companyId) return;

      /*
       * Collect every missing required field in one pass so the user is
       * told about all of them at once, rather than fixing one and
       * resubmitting to discover the next.
       *
       * Underscores become spaces so "full_name" reads as "full name" in
       * the message — the column name doubles as the user-facing label.
       *
       * Note the truthiness test: 0 and false count as missing. Fine for
       * the required text fields these registers use, but a required
       * numeric column that may legitimately be 0 would need a real
       * controller.
       */
      const missing = columns
        .filter(
          (c) =>
            c.required &&
            !req.body[c.name]
        )
        .map((c) =>
          c.name.replace(/_/g, " ")
        );

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          // Singular or plural verb, so the message reads properly either
          // way rather than "name are required".
          message: `${missing.join(
            ", "
          )} ${
            missing.length === 1
              ? "is"
              : "are"
          } required.`,
        });
      }

      const badReference =
        await checkReferences(
          req.body,
          companyId
        );

      if (badReference) {
        return sendNotFound(
          res,
          badReference
        );
      }

      /*
       * Build the column list and the value list from the same `columns`
       * array, in the same order, so placeholder $n always lines up with
       * the nth name. `defaults` fills in anything the client omitted.
       */
      const names = columns.map(
        (c) => c.name
      );

      const values = columns.map(
        (c) => {
          const raw =
            req.body[c.name] ??
            defaults[c.name];

          return coerce(raw, c.type);
        }
      );

      const tableColumns =
        await getTableColumns(table);

      // company_id comes from the session, never the body. This is the
      // whole point of the factory.
      //
      // It is prepended rather than appended so it occupies $1, matching
      // the convention in the read paths and making the scope the first
      // thing visible in any logged query.
      const allNames = [
        "company_id",
        ...names,
      ];

      const allValues = [
        companyId,
        ...values,
      ];

      // Only set created_by where the column exists. workers,
      // subcontractors, invoices and sites do not have it, and inserting
      // into a column that is not there fails the whole statement with
      // 42703 — which is exactly the bug the hand-written controllers had.
      if (
        tableColumns.has("created_by")
      ) {
        allNames.push("created_by");
        allValues.push(getUserId(req));
      }

      const placeholders =
        allValues
          .map((_, i) => `$${i + 1}`)
          .join(", ");

      const result = await pool.query(
        `
        INSERT INTO ${table} (${allNames.join(", ")})
        VALUES (${placeholders})
        RETURNING *
        `,
        allValues
      );

      return res.status(201).json({
        success: true,
        [item]: shape(result.rows[0]),
      });
    }
  );

  /*
  |------------------------------------------------------------------------
  | Update
  |------------------------------------------------------------------------
  |
  | PUT /:id
  |
  | Auth:       required
  | Validation: same required-field and reference checks as create
  | Response:   200 { success, [item]: updated row }
  |             400 invalid id or missing required field
  |             404 no such live row in this company
  |
  | Partial by construction: omitted fields keep their stored value via
  | COALESCE. The corollary is that this endpoint cannot set a column back
  | to NULL — see coerce() above.
  |
  */
  const update = asyncHandler(
    async (req, res) => {
      const companyId =
        requireCompanyId(req, res);

      if (!companyId) return;

      const id = requireParamId(
        req,
        res,
        "id",
        label.toLowerCase()
      );

      if (!id) return;

      const missing = columns
        .filter(
          (c) =>
            c.required &&
            !req.body[c.name]
        )
        .map((c) =>
          c.name.replace(/_/g, " ")
        );

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${missing.join(
            ", "
          )} ${
            missing.length === 1
              ? "is"
              : "are"
          } required.`,
        });
      }

      const badReference =
        await checkReferences(
          req.body,
          companyId
        );

      if (badReference) {
        return sendNotFound(
          res,
          badReference
        );
      }

      // COALESCE so an omitted optional field keeps its current value
      // instead of being blanked by a partial update.
      const assignments = columns
        .map(
          (c, i) =>
            `${c.name} = COALESCE($${i + 1}, ${c.name})`
        )
        .join(", ");

      const values = columns.map(
        (c) =>
          coerce(
            req.body[c.name],
            c.type
          )
      );

      /*
       * The id and company go on the end, after the column placeholders,
       * which is why the WHERE clause below refers to them as
       * $length-1 and $length rather than fixed numbers.
       */
      values.push(id, companyId);

      const tableColumns =
        await getTableColumns(table);

      // Same reason as created_by on the insert path: not every table in
      // this schema has updated_at, and naming a missing column would fail
      // the statement outright.
      const touchUpdatedAt =
        tableColumns.has("updated_at")
          ? ", updated_at = NOW()"
          : "";

      const result = await pool.query(
        `
        UPDATE ${table}
        SET ${assignments}${touchUpdatedAt}
        WHERE id = $${values.length - 1}
          AND company_id = $${values.length}
          ${
            softDelete
              ? "AND COALESCE(is_deleted, FALSE) = FALSE"
              : ""
          }
        RETURNING *
        `,
        values
      );

      /*
       * Zero rows means the UPDATE matched nothing — the id does not exist,
       * belongs to another company, or is already soft-deleted. All three
       * are reported as 404 for the same reason the read path does.
       */
      if (result.rows.length === 0) {
        return sendNotFound(res, label);
      }

      return res.status(200).json({
        success: true,
        [item]: shape(result.rows[0]),
      });
    }
  );

  /*
  |------------------------------------------------------------------------
  | Delete
  |------------------------------------------------------------------------
  |
  | DELETE /:id
  |
  | Auth:      required
  | Response:  200 { success, message }
  |            400 invalid id
  |            404 no such live row in this company
  |
  | Soft by default: the row is flagged rather than removed, which keeps
  | historical payments and audit rows pointing at something real. A config
  | with softDelete: false gets a genuine DELETE instead, for tables where
  | nothing references the row.
  |
  | Note the response carries no record — which is why activityLog's
  | resolveRecordId falls back to reading the id from the path.
  |
  */
  const remove = asyncHandler(
    async (req, res) => {
      const companyId =
        requireCompanyId(req, res);

      if (!companyId) return;

      const id = requireParamId(
        req,
        res,
        "id",
        label.toLowerCase()
      );

      if (!id) return;

      const tableColumns =
        await getTableColumns(table);

      /*
       * The SET clauses are assembled rather than written out because
       * deleted_by and updated_at are optional per table. is_deleted and
       * deleted_at are assumed present on any table configured for soft
       * delete — that pairing is what softDelete: true asserts.
       */
      const softDeleteSets = [
        "is_deleted = TRUE",
        "deleted_at = NOW()",
      ];

      const softDeleteValues = [
        id,
        companyId,
      ];

      if (
        tableColumns.has("deleted_by")
      ) {
        softDeleteValues.push(
          getUserId(req)
        );

        softDeleteSets.push(
          `deleted_by = $${softDeleteValues.length}`
        );
      }

      if (
        tableColumns.has("updated_at")
      ) {
        softDeleteSets.push(
          "updated_at = NOW()"
        );
      }

      /*
       * The soft path re-checks `COALESCE(is_deleted, FALSE) = FALSE` so a
       * second delete of the same row matches nothing and returns 404,
       * rather than reporting success and overwriting the original
       * deleted_at with a later timestamp.
       */
      const result = softDelete
        ? await pool.query(
            `
            UPDATE ${table}
            SET ${softDeleteSets.join(", ")}
            WHERE id = $1 AND company_id = $2
              AND COALESCE(is_deleted, FALSE) = FALSE
            RETURNING id
            `,
            softDeleteValues
          )
        : await pool.query(
            `DELETE FROM ${table}
              WHERE id = $1 AND company_id = $2
              RETURNING id`,
            [id, companyId]
          );

      if (result.rows.length === 0) {
        return sendNotFound(res, label);
      }

      return res.status(200).json({
        success: true,
        message: `${label} deleted successfully.`,
      });
    }
  );

  return {
    list,
    getById,
    create,
    update,
    remove,
  };
};

module.exports = { createScopedCrud };
