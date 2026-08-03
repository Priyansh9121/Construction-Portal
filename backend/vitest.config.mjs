/**
 * File purpose:
 * Vitest configuration for the backend test suite. `npm test` runs this.
 *
 * Connected to:
 * - backend/tests/ — the eleven test files it discovers
 * - backend/tests/helpers/testDb.js, which seeds and tears down fixtures
 * - Requires a reachable PostgreSQL database; these are integration tests,
 *   not unit tests with a mocked driver
 *
 * Important notes:
 * - Every setting below is load-bearing. See the inline comments.
 */

import { defineConfig } from "vitest/config";

/*
 * Integration tests hit a real PostgreSQL database, so they run serially in
 * a single process. Parallel workers would each seed and tear down fixtures
 * in the same schema and interfere with one another.
 *
 * .mjs because the backend is CommonJS ("type": "commonjs") and this config
 * uses ESM syntax.
 */
export default defineConfig({
  test: {
    environment: "node",

    // CommonJS test files cannot `require("vitest")`, so the test APIs are
    // provided as globals instead.
    globals: true,

    include: ["tests/**/*.test.js"],

    fileParallelism: false,
    singleFork: true,

    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
