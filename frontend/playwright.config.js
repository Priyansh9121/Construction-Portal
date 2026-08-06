/**
 * Playwright configuration — responsive smoke tests only.
 *
 * These drive a LOCAL dev server. E2E_BASE_URL must never point at
 * production: the suite navigates the real app and would exercise live data.
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "off",
    screenshot: "only-on-failure",
  },
});
