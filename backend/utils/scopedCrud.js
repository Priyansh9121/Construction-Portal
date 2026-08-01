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

const columnCache = new Map();

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
  } = config;

  const notDeleted = softDelete
    ? "COALESCE(t.is_deleted, FALSE) = FALSE"
    : null;

  /**
   * Verifies every declared foreign key belongs to the caller's company.
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

      filters.forEach((column) => {
        const value =
          req.query[column];

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

      const limit = Math.min(
        Number(req.query.limit) ||
          200,
        500
      );

      const offset = Math.max(
        Number(req.query.offset) || 0,
        0
      );

      values.push(limit, offset);

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
        [collection]: result.rows,
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
        [item]: result.rows[0],
      });
    }
  );

  /*
  |------------------------------------------------------------------------
  | Create
  |------------------------------------------------------------------------
  */
  const create = asyncHandler(
    async (req, res) => {
      const companyId =
        requireCompanyId(req, res);

      if (!companyId) return;

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
      const allNames = [
        "company_id",
        ...names,
      ];

      const allValues = [
        companyId,
        ...values,
      ];

      // Only set created_by where the column exists.
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
        [item]: result.rows[0],
      });
    }
  );

  /*
  |------------------------------------------------------------------------
  | Update
  |------------------------------------------------------------------------
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

      values.push(id, companyId);

      const tableColumns =
        await getTableColumns(table);

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

      if (result.rows.length === 0) {
        return sendNotFound(res, label);
      }

      return res.status(200).json({
        success: true,
        [item]: result.rows[0],
      });
    }
  );

  /*
  |------------------------------------------------------------------------
  | Delete
  |------------------------------------------------------------------------
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
