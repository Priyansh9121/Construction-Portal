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
})