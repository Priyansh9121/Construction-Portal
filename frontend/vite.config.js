/**
 * File purpose:
 * Vite build and dev-server configuration for the frontend.
 *
 * Responsibilities:
 * - Register the React plugin (JSX transform and fast refresh)
 *
 * Connected to:
 * - `npm run dev`, `npm run build` and `npm run preview`
 * - Vercel runs `vite build` from frontend/vercel.json
 * - Entry point is index.html, which loads src/main.jsx
 *
 * Important notes:
 * - Deliberately minimal; the defaults are what this project needs.
 * - Environment variables prefixed VITE_ are inlined at BUILD time, so
 *   changing VITE_API_URL requires a rebuild, not a restart. Anything put
 *   in a VITE_ variable is published in the bundle and is public — never
 *   put a secret there.
 * - Source maps are off, which is the usual production choice: a source
 *   map publishes the original source.
 * - The build currently emits one ~1.9 MB chunk and warns about it. Code
 *   splitting would fix that; it has not been done.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  /*
   * THE DEV SERVER OWNS 5173, OR IT FAILS.
   *
   * Vite's default is to hunt for the next free port, which is how three
   * instances of this project ended up listening on 5173, 5174 and 5175 at
   * once -- each new session silently moved along and left the last one
   * running. Every capture harness and test run then had to be told which port
   * to use, and a stale server from a previous day could serve a stale build
   * to a probe that believed it was measuring current work.
   *
   * `strictPort` turns that silent drift into an immediate, named failure:
   * either 5173 is ours, or the run stops and says which process has it.
   *
   * Dev only. `vite build` and the production deployment are untouched.
   */
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
})