/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Master data: the three reference registers of counterparties —
| investors, suppliers and clients — plus the investor statement.
|
| One parameterised controller serves all three tables. They share the same
| shape (name, contact details, status) and differ only in a couple of extra
| columns, so `:master` in the URL selects which table to act on. That
| choice is what makes resolveMaster() the most security-sensitive function
| in the file: the table name is interpolated into SQL.
|
| The investor statement is the exception to "these are just registers", and
| the reason the module is worth having. Before it, payments recorded a
| free-text investor_name, which made "what do we owe this investor across
| every tender" unanswerable.
|
| Responsibilities:
|   - Resolve :master to one of three allow-listed table configurations
|   - List, create, update and archive rows in any of them
|   - Compute an investor's statement, with interest accrued to date
|
| Exports (all Express handlers, all wrapped in asyncHandler here):
|   list, create, update, archive, getInvestorStatement
|
| Used by:
|   ./master.routes.js
|
| Depends on:
|   database/pool.js
|   utils/asyncHandler.js
|   utils/requestContext.js
|   modules/payments/payment.service.js — calculateInterest and money, so
|   the statement's arithmetic matches the Payments screen exactly
|
| Database tables touched:
|   investors, suppliers, clients  SELECT, INSERT, UPDATE
|   payments                       SELECT, for the statement
|   tenders                        SELECT, joined for the tender title
|
| API surface:
|   GET    /api/masters/:master              ?status= ?search=
|   POST   /api/masters/:master
|   PUT    /api/masters/:master/:id
|   DELETE /api/masters/:master/:id          archives rather than deletes
|   GET    /api/masters/investors/:id/statement
|
|   Office-only, mounted behind authMiddleware and requireOffice.
|
| Frontend consumers:
|   frontend/src/services/masterService.js -> MastersPage.jsx, and the
|   investor/supplier/client pickers on the payment forms.
|
| Security:
|   `config.table` is interpolated into every statement, because Postgres
|   cannot parameterise an identifier. It is safe ONLY because
|   resolveMaster looks the value up in the frozen MASTERS object and
|   answers 404 for anything else — the request never supplies a table name,
|   only a key that must already exist. Any change that loosens that lookup
|   turns every query here into an injection point.
|
|   All values are bound parameters.
|
| Note:
|   These three tables have no is_deleted column, so removal is a status
|   change. See the archive handler.
|
*/

const pool = require("../../database/pool");

const asyncHandler = require("../../utils/asyncHandler");

const {
  requireCompanyId,
  requireParamId,
  sendNotFound,
  cleanText,
  cleanLowerText,
} = require("../../utils/requestContext");

const {
  calculateInterest,
  money,
} = require("../payments/payment.service");

/*
|--------------------------------------------------------------------------
| Master data
|--------------------------------------------------------------------------
|
| investors, suppliers and clients already existed in the database but no
| code touched them, so payments could only record a free-text
| investor_name. That makes it impossible to answer "what do we owe this
| investor across every tender".
|
| The three tables share the same shape — name, contact details, status —
| so one parameterised controller serves all of them rather than three
| near-identical files.
|
*/

/*
 * The allow-list. A key here is the only thing `:master` may be, and the
 * only source of a table name in this file.
 *
 * Frozen so a later assignment cannot add an entry at runtime — which would
 * be a way to smuggle an arbitrary table name into the interpolation.
 */
const MASTERS = Object.freeze({
  investors: {
    table: "investors",
    label: "Investor",
    collection: "investors",
    // Columns beyond the shared set.
    extraColumns: [],
  },
  suppliers: {
    table: "suppliers",
    label: "Supplier",
    collection: "suppliers",
    extraColumns: ["gst_number"],
  },
  clients: {
    table: "clients",
    label: "Client",
    collection: "clients",
    extraColumns: ["gst_number"],
  },
});

/*
 * The columns all three tables have in common, in a fixed order.
 *
 * Order matters and is relied on twice: `name` must stay at index 0,
 * because create() overwrites values[1] — the slot after company_id — with
 * the validated name. Reordering this array silently writes the validated
 * name into the wrong column.
 */
const SHARED_COLUMNS = [
  "name",
  "phone",
  "email",
  "address",
  "status",
];

/**
 * Resolves the master config from the route, refusing anything not on the
 * allowlist. The table name is interpolated into SQL, so it must never come
 * from user input unchecked.
 *
 * Purpose:
 * Turns the `:master` path segment into a trusted table configuration, or
 * answers 404.
 *
 * Parameters:
 * req - Express request; reads req.params.master
 * res - Express response
 *
 * Returns:
 * The config object, or null having already sent a 404. Every caller must
 * `if (!config) return;` immediately.
 *
 * Side effects:
 * May write the response.
 *
 * Security:
 * The single most important function in this file. Five queries below
 * interpolate `config.table` directly into their SQL, and this lookup is
 * the only thing that makes that safe.
 *
 * The mechanism is a property lookup against a frozen object, so the
 * request cannot supply a table name — only a key that must already exist
 * as one of three. A missing key yields undefined and a 404; there is no
 * path by which an arbitrary string reaches the interpolation.
 *
 * Prototype pollution is not a concern here in practice: keys like
 * "constructor" or "__proto__" would resolve to an inherited property
 * rather than undefined, but the result has no `.table` string, so the
 * query would fail on an undefined identifier rather than execute
 * something unintended. Worth knowing if this ever grows a fallback.
 */
const resolveMaster = (req, res) => {
  const key = req.params.master;

  const config = MASTERS[key];

  if (!config) {
    res.status(404).json({
      success: false,
      message: "Unknown master type.",
    });

    return null;
  }

  return config;
};

/**
 * Columns this master accepts, in a stable order.
 *
 * Purpose:
 * Builds the per-table writable column list. This is the allow-list for
 * create and update — a body key not returned here is ignored, so a client
 * cannot set id, company_id or created_at.
 *
 * Parameters:
 * config - a resolved entry from MASTERS
 *
 * Returns:
 * An array of column names: the shared five, then the table's extras, then
 * `notes` for investors only.
 *
 * Notes:
 * "Stable order" is load-bearing. Both create and update build their
 * placeholder lists by mapping over this array, so the nth value must
 * always line up with the nth column. As long as both call it, they agree.
 *
 * `notes` is special-cased rather than declared in extraColumns, which is
 * where gst_number lives. Inconsistent — investors could simply have
 * `extraColumns: ["notes"]` — but the behaviour is identical. Left as
 * found.
 */
const columnsFor = (config) => [
  ...SHARED_COLUMNS,
  ...config.extraColumns,
  ...(config.table === "investors"
    ? ["notes"]
    : []),
];

/*
|--------------------------------------------------------------------------
| GET /api/masters/:master
|--------------------------------------------------------------------------
|
| Auth:     required
| Roles:    admin, manager (at the mount)
| Params:   :master — investors, suppliers or clients
| Query:    ?status= ?search=
| Response: 200 { success, [collection]: rows, items: rows }
|           404 unknown master type
|
| The response carries the rows twice: once under a per-type key
| (`investors`, `suppliers`, `clients`) and once under `items`. The
| duplicate is deliberate — a generic picker component can read `items`
| without knowing which master it asked for, while a screen that does know
| can read the named key.
|
| Capped at 500 rows with no pagination, unlike the paginated registers.
| These are reference lists sized in the tens; a company with more
| counterparties than that would need a page control adding.
|
| Ordered by name, since these lists are read alphabetically rather than
| newest-first.
|
*/
exports.list = asyncHandler(
  async (req, res) => {
    const config = resolveMaster(
      req,
      res
    );

    if (!config) return;

    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const conditions = [
      "m.company_id = $1",
    ];

    const values = [companyId];

    if (req.query.status) {
      values.push(req.query.status);

      conditions.push(
        `m.status = $${values.length}`
      );
    }

    /*
     * One bound pattern reused across all three columns — note the same
     * $n appears three times rather than the value being pushed three
     * times.
     *
     * COALESCE on phone and email because both are nullable, and
     * `NULL LIKE pattern` is NULL rather than false, which would drop the
     * row from the OR entirely. `name` is NOT NULL so needs no guard.
     */
    if (req.query.search) {
      values.push(
        `%${cleanLowerText(
          req.query.search
        )}%`
      );

      conditions.push(
        `(lower(m.name) LIKE $${values.length}
          OR lower(COALESCE(m.phone, '')) LIKE $${values.length}
          OR lower(COALESCE(m.email, '')) LIKE $${values.length})`
      );
    }

    const result = await pool.query(
      `
      SELECT m.*
      FROM ${config.table} m
      WHERE ${conditions.join(" AND ")}
      ORDER BY m.name
      LIMIT 500
      `,
      values
    );

    return res.status(200).json({
      success: true,
      [config.collection]: result.rows,
      // A stable key as well, so clients can read either shape.
      items: result.rows,
    });
  }
);

/*
|--------------------------------------------------------------------------
| POST /api/masters/:master
|--------------------------------------------------------------------------
|
| Auth:     required
| Roles:    admin, manager
| Params:   :master
| Body:     name required; phone, email, address, status and the per-type
|           extras optional
| Response: 201 { success, item }
|           400 name is missing
|           404 unknown master type
|
| Business rules:
| - Only `name` is required. These are reference records that often start
|   as little more than a name and are filled in later.
| - status defaults to "active".
| - Every other field becomes null when blank, rather than "".
|
| Security:
| company_id is prepended to the value list from the session, so it can
| never come from the body.
|
*/
exports.create = asyncHandler(
  async (req, res) => {
    const config = resolveMaster(
      req,
      res
    );

    if (!config) return;

    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const name = cleanText(
      req.body.name
    );

    if (!name) {
      return res.status(400).json({
        success: false,
        message: `${config.label} name is required.`,
      });
    }

    const columns =
      columnsFor(config);

    const values = [
      companyId,
      ...columns.map((column) =>
        column === "status"
          ? req.body.status || "active"
          : cleanText(
              req.body[column]
            ) || null
      ),
    ];

    /*
     * Overwrite the name slot with the validated value.
     *
     * Index 1 because company_id occupies index 0 and `name` is first in
     * SHARED_COLUMNS. The map above already produced a cleaned name, so
     * this is belt-and-braces rather than a correction — but it does mean
     * the validated value is definitively what gets written.
     *
     * Fragile in one specific way: if `name` ever stopped being first in
     * SHARED_COLUMNS, this would write the name into whichever column took
     * its place. See the note on that array.
     */
    values[1] = name;

    const placeholders = values
      .map((_, i) => `$${i + 1}`)
      .join(", ");

    const result = await pool.query(
      `
      INSERT INTO ${config.table}
        (company_id, ${columns.join(", ")})
      VALUES (${placeholders})
      RETURNING *
      `,
      values
    );

    return res.status(201).json({
      success: true,
      item: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| PUT /api/masters/:master/:id
|--------------------------------------------------------------------------
|
| Auth:     required
| Roles:    admin, manager
| Params:   :master, :id
| Body:     any subset of the writable columns
| Response: 200 { success, item }
|           400 invalid id
|           404 unknown master type, or no such row in this company
|
| Partial by construction — see the COALESCE note below. The corollary is
| that a field cannot be cleared back to null through this endpoint, only
| overwritten with a new value.
|
| Note that `status` is writable here, so this is also how an archived
| record is reactivated: the archive handler only sets status to inactive,
| and setting it back to active is an ordinary update.
|
*/
exports.update = asyncHandler(
  async (req, res) => {
    const config = resolveMaster(
      req,
      res
    );

    if (!config) return;

    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const id = requireParamId(
      req,
      res,
      "id",
      config.label.toLowerCase()
    );

    if (!id) return;

    const columns =
      columnsFor(config);

    // COALESCE keeps an omitted field at its current value, so a partial
    // update does not blank out everything it did not mention.
    //
    // The mechanism: every omitted field is bound as null by the map below,
    // and COALESCE(null, column) is the column. Every column is named in the
    // SET clause on every call — the partial behaviour comes from the nulls,
    // not from a dynamically shortened statement.
    const assignments = columns
      .map(
        (column, i) =>
          `${column} = COALESCE($${i + 1}, ${column})`
      )
      .join(", ");

    const values = columns.map(
      (column) =>
        cleanText(req.body[column]) ||
        null
    );

    values.push(id, companyId);

    const result = await pool.query(
      `
      UPDATE ${config.table}
      SET ${assignments}, updated_at = NOW()
      WHERE id = $${values.length - 1}
        AND company_id = $${values.length}
      RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        config.label
      );
    }

    return res.status(200).json({
      success: true,
      item: result.rows[0],
    });
  }
);

/*
|--------------------------------------------------------------------------
| DELETE /api/masters/:master/:id
|--------------------------------------------------------------------------
|
| These tables have no is_deleted column, so removal is a status change
| rather than a delete. That keeps historic payments pointing at a row that
| still resolves.
|
| Auth:     required
| Roles:    admin, manager
| Params:   :master, :id
| Response: 200 { success, message }
|           400 invalid id
|           404 unknown master type, or no such row in this company
|
| Business rules:
| - Sets status to 'inactive'. Nothing is removed, so a payment recorded
|   against this investor two years ago still resolves to a named row.
| - Reversible through the update handler, which can set status back to
|   'active' — there is no separate unarchive endpoint.
| - Archiving does not hide the record from list() by default. The status
|   filter is opt-in, so a caller wanting only live records must ask for
|   ?status=active. That is the opposite of the soft-delete registers,
|   where deleted rows are hidden unless requested.
|
| Note the DELETE verb for what is really a status update. Kept because the
| frontend already calls it that way, and because "remove this from my
| list" is what the user is doing.
|
*/
exports.archive = asyncHandler(
  async (req, res) => {
    const config = resolveMaster(
      req,
      res
    );

    if (!config) return;

    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const id = requireParamId(
      req,
      res,
      "id",
      config.label.toLowerCase()
    );

    if (!id) return;

    const result = await pool.query(
      `
      UPDATE ${config.table}
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING id
      `,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return sendNotFound(
        res,
        config.label
      );
    }

    return res.status(200).json({
      success: true,
      message: `${config.label} archived.`,
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/masters/investors/:id/statement
|--------------------------------------------------------------------------
|
| Everything taken from and returned to one investor, with interest accrued
| to date. This is the reason the investors table is worth wiring up.
|
| Auth:     required
| Roles:    admin, manager
| Params:   :id — an investor in the caller's company
| Response: 200 { success, investor, entries, summary }
|           400 invalid id
|           404 no such investor in this company
|
| The summary:
|   total_received    money taken IN from the investor
|   total_returned    money paid BACK to them
|   interest_accrued  interest on what was received, to today
|   outstanding       received + interest - returned
|
| Business rules:
| - Only payments with payment_sub_type 'INVESTOR' count. Other payments
|   to the same person in another capacity are not part of this statement.
| - Interest accrues only on money received, never on money returned — see
|   the branch below.
| - Interest is computed live from each payment's date and rate rather than
|   stored, so the statement is correct as of the moment it is read.
|
| Performance:
| Interest is calculated per row in JavaScript rather than in SQL. Fine for
| an investor's payment history; it would need reconsidering for thousands
| of rows, and there is no LIMIT on the query.
|
| Note:
| calculateInterest and money are imported from payment.service.js rather
| than reimplemented, so this statement and the Payments screen can never
| disagree about what an investor is owed.
|
*/
exports.getInvestorStatement =
  asyncHandler(async (req, res) => {
    const companyId =
      requireCompanyId(req, res);

    if (!companyId) return;

    const id = requireParamId(
      req,
      res,
      "id",
      "investor"
    );

    if (!id) return;

    const investorResult =
      await pool.query(
        `SELECT * FROM investors WHERE id = $1 AND company_id = $2`,
        [id, companyId]
      );

    if (
      investorResult.rows.length === 0
    ) {
      return sendNotFound(
        res,
        "Investor"
      );
    }

    const investor =
      investorResult.rows[0];

    /*
     * Match on the foreign key where it is set, and fall back to the
     * free-text name for rows created before investor_id existed.
     *
     * The OR is a migration bridge. Older payments carry only
     * investor_name, so matching on investor_id alone would silently omit
     * the earliest history from the statement — the figures would look
     * right and simply be too small.
     *
     * The name comparison is case-insensitive on both sides. It is also
     * inexact by nature: two investors with the same name would pool their
     * legacy rows together. Nothing here can resolve that; backfilling
     * investor_id is what eventually retires this clause.
     */
    const payments = await pool.query(
      `
      SELECT
        p.id,
        p.payment_direction,
        p.payment_sub_type,
        p.payment_date,
        p.amount,
        p.interest_percent,
        p.fd_site,
        p.payment_mode,
        p.details,
        p.tender_id,
        t.title AS tender_title
      FROM payments p
      LEFT JOIN tenders t
        ON t.id = p.tender_id AND t.company_id = p.company_id
      WHERE p.company_id = $1
        AND p.payment_sub_type = 'INVESTOR'
        AND (p.investor_id = $2 OR lower(p.investor_name) = lower($3))
        AND COALESCE(p.is_deleted, FALSE) = FALSE
      ORDER BY p.payment_date DESC, p.id DESC
      `,
      [companyId, id, investor.name]
    );

    let received = 0;

    let returned = 0;

    let interest = 0;

    const entries = payments.rows.map(
      (row) => {
        const accrual =
          calculateInterest({
            principal: row.amount,
            interestPercent:
              row.interest_percent,
            fromDate:
              row.payment_date,
          });

        /*
         * Direction decides which side of the statement a payment lands
         * on, and whether interest applies.
         *
         * "income" is money the company took IN from the investor — a
         * contribution. It increases what is owed, and it accrues interest
         * from its payment date.
         *
         * Anything else is money paid BACK. It reduces the balance and
         * accrues nothing: interest is charged on capital held, and
         * returned capital is no longer held.
         *
         * Note that accrual is computed for every row above, including
         * returns, but only added to the running interest on the income
         * branch. The unused figure still rides along in the per-entry
         * response, so a return row displays an interest_amount that does
         * not contribute to the summary.
         */
        if (
          row.payment_direction ===
          "income"
        ) {
          // Money taken in from the investor.
          received += money(
            row.amount
          );

          interest +=
            accrual.interest_amount;
        } else {
          returned += money(
            row.amount
          );
        }

        return {
          ...row,
          ...accrual,
        };
      }
    );

    return res.status(200).json({
      success: true,
      investor,
      entries,
      summary: {
        total_received: received,
        total_returned: returned,
        interest_accrued: interest,
        outstanding:
          received +
          interest -
          returned,
      },
    });
  });
