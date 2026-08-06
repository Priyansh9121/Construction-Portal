/**
 * File purpose:
 * ESLint configuration for the frontend. `npm run lint` runs this.
 *
 * Responsibilities:
 * - Apply the recommended JavaScript rules
 * - Enforce the React Hooks rules (dependency arrays, call ordering)
 * - Enforce react-refresh constraints for fast refresh
 * - Declare browser globals
 *
 * Connected to:
 * - `npm run lint`
 * - There is no separate typecheck step; this is the only static analysis
 *   the frontend has, and no test runner is configured.
 *
 * Important notes:
 * - The react-refresh rule is why contexts/authContext.js is split from
 *   AuthProvider.jsx: a module exporting both a component and other values
 *   cannot be hot-reloaded on its own.
 * - The hooks rules are load-bearing here. useCollection deliberately
 *   writes its fetch as a promise chain rather than async/await so every
 *   setState is visibly inside a callback and the effect rule stays
 *   satisfied.
 */

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'test-results', 'playwright-report']),

  /*
   * Playwright config and specs run in Node, not the browser, so they need
   * Node globals (process). Everything under src/ stays browser-only.
   */
  {
    files: ['playwright.config.js', 'tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
