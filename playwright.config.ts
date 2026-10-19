import { defineConfig } from "@playwright/test";

// Testes E2E contra a app em modo dev, com DEV_AUTH_EMAIL, STORAGE_DRIVER=local e a Graph API simulada
// (tests/e2e/mock-graph.mjs). Ver README, secção "Testes".
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
});
