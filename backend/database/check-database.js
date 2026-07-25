const pool = require("./pool");

(async () => {
  try {
    console.log("DATABASE:");
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
    console.error(e);
  }

  process.exit();
})();