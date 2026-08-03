/*
|--------------------------------------------------------------------------
| Database connection diagnostic
|--------------------------------------------------------------------------
|
| A throwaway script, not part of the application. Nothing imports it; it is
| run by hand when a query fails with something that looks impossible:
|
|     node database/check-database.js
|
| It answers the question "am I even talking to the database I think I am".
| The usual cause of a mystifying 42P01 (relation does not exist) or 42703
| (column does not exist) is not a bug in the query — it is DATABASE_URL
| pointing at the wrong database, or a search_path that resolves an
| unqualified table name to a different schema.
|
| The three checks, in order:
|
|   1. Which database, schema and search_path this connection actually has.
|   2. Whether a table named `sites` exists, and in which schema — if it
|      turns up under something other than `public`, that is the answer.
|   3. The columns of `sites`, in ordinal order, to compare against what a
|      query expects.
|
| `sites` is hard-coded because that is the table being investigated when
| this was written. Change the two literals to look at a different one.
|
| Reuses database/pool.js, so it connects exactly the way the API does —
| same URL, same TLS settings, same type parsers. That is the point: a check
| against a separately configured connection would not prove anything about
| the one the application uses.
|
*/

const pool = require("./pool");

/*
 * Run immediately as an async IIFE. Top-level await is unavailable because
 * the backend is CommonJS ("type": "commonjs" in package.json).
 */
(async () => {
  try {
    console.log("DATABASE:");

    /*
     * current_database()  the database this connection is attached to
     * current_schema()    the first writable schema on the search path,
     *                     where an unqualified CREATE TABLE would land
     * search_path         the full resolution order for unqualified names
     *
     * console.table renders the single result row as a grid, which is far
     * easier to read at a glance than the nested object node-postgres
     * returns.
     */
    console.table(
      (
        await pool.query(`
          SELECT current_database(),
                 current_schema(),
                 current_setting('search_path');
        `)
      ).rows
    );

    console.log("\nTABLES NAMED 'sites':");

    /*
     * Deliberately not filtered by schema. If `sites` exists in more than
     * one — say a leftover copy outside `public` — both rows appear, and
     * that duplication is usually the explanation for a query reading data
     * that seems to be from nowhere.
     *
     * No rows here means the table genuinely does not exist and a migration
     * has not been run.
     */
    console.table(
      (
        await pool.query(`
          SELECT table_schema, table_name
          FROM information_schema.tables
          WHERE table_name='sites';
        `)
      ).rows
    );

    console.log("\nCOLUMNS:");

    /*
     * ORDER BY ordinal_position lists the columns in the order they were
     * declared rather than alphabetically, so the output can be compared
     * directly against the CREATE TABLE in the migration.
     *
     * This is what catches a query naming a column that does not exist —
     * the `tenders.site_id` class of bug, where the join looked reasonable
     * but the column was never there.
     */
    console.table(
      (
        await pool.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name='sites'
          ORDER BY ordinal_position;
        `)
      ).rows
    );

  } catch (e) {
    /*
     * Print and continue to the exit below. A connection failure is itself
     * a useful result here — it means the problem is DATABASE_URL or
     * network reachability, not the schema.
     */
    console.error(e);
  }

  /*
   * Forced exit rather than pool.end(). The pool keeps idle connections
   * open, so without this the process would hang after printing. Blunt, but
   * correct for a script that is finished the moment it has printed.
   */
  process.exit();
})();
