/**
 * File purpose:
 * ESLint configuration for the backend. `npm run lint` runs this.
 *
 * Why this exists:
 * The backend had no static analysis at all. Roughly 100 modules were
 * unchecked, so an unused import, an unreachable branch or a floating
 * promise was invisible until it caused a bug. The frontend has had a
 * linter throughout, which is why its findings were consistently stronger.
 *
 * Responsibilities:
 * - Apply the recommended JavaScript rules
 * - Declare Node.js globals for source, and Vitest globals for tests
 * - Catch the specific classes of defect this repository has produced
 *   before: dead exports, unused variables, unreachable code, accidental
 *   globals, and mishandled promises
 *
 * Connected to:
 * - `npm run lint` and `npm run lint:fix` in backend/package.json
 * - .github/workflows/ci.yml runs it on every push and pull request
 *
 * Important notes:
 * - CommonJS. Every backend file uses require/module.exports, so sourceType
 *   is "commonjs" rather than the flat-config default of "module".
 * - Test files get Vitest globals because vitest.config.mjs sets
 *   `globals: true` — the suites call describe/it/expect without importing
 *   them.
 * - `no-unused-vars` ignores arguments prefixed with `_`. Express error
 *   handlers must declare four parameters to be recognised as such, so
 *   `(err, req, res, _next)` is a legitimate shape, not a mistake.
 */

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "database/migrations/**",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.js"],

    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },

    rules: {
      /*
       * The rules this repository actually needs. Each one corresponds to a
       * defect class that has appeared here before.
       */

      // Dead bindings — e.g. `tenderRoutes` in server.js, imported and then
      // re-required inline at the mount.
      "no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Statements after return/throw/process.exit.
      "no-unreachable": "error",

      // Two declarations of the same name in one scope.
      "no-redeclare": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-duplicate-case": "error",

      // Assigning to an undeclared identifier creates a global. In a
      // long-lived server process that leaks across requests.
      "no-undef": "error",
      "no-implicit-globals": "error",

      // Promise handling.
      "no-async-promise-executor": "error",

      /*
       * `require-atomic-updates` is deliberately OFF.
       *
       * Every one of its four hits in this codebase was the same false
       * positive: assigning a property after an await, where the object is
       * request-scoped or test-local and cannot be shared.
       *
       *   authMiddleware.js:316   `req.user = {...}` after the DB lookup —
       *                           each request has its own `req`
       *   tenantIsolation.test.js `alphaIds.x = await ...` in sequence
       *
       * Turning it on would mean either restructuring security-critical
       * middleware to satisfy a checker, or scattering disable comments.
       * Neither buys real safety here.
       */
      "require-atomic-updates": "off",

      /*
       * `no-useless-assignment` is OFF for the same class of reason.
       * roleMiddleware.js initialises `let hasAccess = false` before an
       * exhaustive switch. The initialiser is technically dead, but it is
       * a deliberate fail-closed default in an authorisation path, and
       * fail-closed is worth one redundant assignment.
       */
      "no-useless-assignment": "off",

      // Conditions that can never evaluate as intended.
      "no-constant-condition": "error",
      "no-constant-binary-expression": "error",
      "no-self-compare": "error",

      // Comparing with == against null is idiomatic; everything else should
      // be strict.
      eqeqeq: ["error", "always", { null: "ignore" }],

      // A bare `catch {}` hides real errors. This repository already has a
      // documented case of a swallowed failure (notifyRole) that meant no
      // notification was ever written.
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },

  {
    /*
     * Test files. vitest.config.mjs sets `globals: true`, so describe, it,
     * expect, beforeAll and friends are ambient rather than imported.
     */
    files: ["tests/**/*.js"],

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
];
